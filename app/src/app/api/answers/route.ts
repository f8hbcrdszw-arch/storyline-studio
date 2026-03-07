import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { withErrorHandler } from "@/lib/api/error-handler";
import { rateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { submitAnswerSchema, answerSchemaByType } from "@/lib/schemas/answer";
import { evaluateSkipLogic } from "@/lib/skip-logic";
import type { SkipLogicRule } from "@/lib/types/json-fields";

// POST /api/answers — submit an answer for a question
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate limit: 60 answer submissions per minute per IP
  const limited = rateLimit(request, "submitAnswer", RATE_LIMITS.submitAnswer);
  if (limited) return limited;

  const body = await request.json();
  const { responseId, questionId, value } = submitAnswerSchema.parse(body);

  // Verify respondent owns this response
  const respondentId = request.cookies.get("respondent_id")?.value;
  if (!respondentId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const response = await prisma.response.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      respondentId: true,
      status: true,
      studyId: true,
    },
  });

  if (!response || response.respondentId !== respondentId) {
    return NextResponse.json({ error: "Invalid response" }, { status: 403 });
  }

  if (response.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Response already completed" },
      { status: 400 }
    );
  }

  // Get the question to validate the answer
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      type: true,
      studyId: true,
      isScreening: true,
      skipLogic: true,
      order: true,
    },
  });

  if (!question || question.studyId !== response.studyId) {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 }
    );
  }

  // Validate answer value against question type schema
  const schema = answerSchemaByType[question.type];
  if (schema) {
    const result = schema.safeParse(value);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid answer format", details: result.error.issues },
        { status: 400 }
      );
    }
  }

  // Upsert the answer (allows re-answering if back navigation is enabled)
  const answer = await prisma.answer.upsert({
    where: {
      responseId_questionId: {
        responseId,
        questionId,
      },
    },
    create: {
      responseId,
      questionId,
      value: value as Prisma.InputJsonValue,
    },
    update: {
      value: value as Prisma.InputJsonValue,
      answeredAt: new Date(),
    },
  });

  // Dual-write for VIDEO_DIAL: insert DialDataPoint + DialEvent rows
  if (question.type === "VIDEO_DIAL") {
    const dialValue = value as {
      feedback?: Record<string, number>;
      lightbulbs?: number[];
      actions?: Record<string, number[]>;
    };

    // Write dial data points (per-second values)
    if (dialValue.feedback) {
      const dataPoints = Object.entries(dialValue.feedback).map(
        ([second, val]) => ({
          answerId: answer.id,
          questionId,
          responseId,
          second: Number(second),
          value: Number(val),
        })
      );

      if (dataPoints.length > 0) {
        // Delete existing data points for this answer (in case of re-submission)
        await prisma.dialDataPoint.deleteMany({
          where: { answerId: answer.id },
        });
        await prisma.dialDataPoint.createMany({ data: dataPoints });
      }
    }

    // Write dial events (lightbulbs + action button taps)
    const events: { answerId: string; questionId: string; responseId: string; eventType: string; timestamp: number }[] = [];

    if (dialValue.lightbulbs) {
      for (const ts of dialValue.lightbulbs) {
        events.push({
          answerId: answer.id,
          questionId,
          responseId,
          eventType: "lightbulb",
          timestamp: ts,
        });
      }
    }

    if (dialValue.actions) {
      for (const [actionId, timestamps] of Object.entries(dialValue.actions)) {
        for (const ts of timestamps) {
          events.push({
            answerId: answer.id,
            questionId,
            responseId,
            eventType: `action:${actionId}`,
            timestamp: ts,
          });
        }
      }
    }

    if (events.length > 0) {
      await prisma.dialEvent.deleteMany({
        where: { answerId: answer.id },
      });
      await prisma.dialEvent.createMany({ data: events });
    }
  }

  // Server-side screening logic evaluation for screening questions
  let screenOut = false;
  let skipToQuestionId: string | undefined;

  if (question.isScreening || question.skipLogic) {
    // Get all answers for this response to evaluate skip logic
    const allAnswers = await prisma.answer.findMany({
      where: { responseId },
      select: { questionId: true, value: true },
    });

    const answersMap: Record<string, unknown> = {};
    for (const a of allAnswers) {
      answersMap[a.questionId] = a.value;
    }

    const rules = question.skipLogic as unknown as SkipLogicRule[] | null;
    const result = evaluateSkipLogic(rules, answersMap);

    if (result) {
      screenOut = result.screenOut;
      skipToQuestionId = result.skipToQuestionId;
    }

    // If screened out, mark response as such
    if (screenOut) {
      await prisma.response.update({
        where: { id: responseId },
        data: { status: "SCREENED_OUT", completedAt: new Date() },
      });
    }
  }

  return NextResponse.json({
    answer,
    screenOut,
    skipToQuestionId,
  });
});
