import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color");

const surveyThemeSchema = z.object({
  primaryColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  textColor: hexColorSchema,
  accentColor: hexColorSchema,
  buttonStyle: z.enum(["rounded", "pill", "square"]),
  progressBarStyle: z.enum(["line", "dots", "fraction", "hidden"]),
});

export const STUDY_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
  "ARCHIVED",
] as const;

export type StudyStatus = (typeof STUDY_STATUSES)[number];

/** Valid status transitions: from → allowed targets */
export const VALID_TRANSITIONS: Record<StudyStatus, readonly StudyStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "CLOSED"],
  PAUSED: ["ACTIVE", "CLOSED"],
  CLOSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export const createStudySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  settings: z
    .object({
      allowBackNavigation: z.boolean().optional(),
      showProgress: z.boolean().optional(),
      completionRedirectUrl: z
        .string()
        .url()
        .max(2000)
        .optional(),
      quota: z.number().int().positive().max(100000).optional(),
      theme: surveyThemeSchema.optional(),
      thankYouHeading: z.string().max(200).optional(),
      thankYouBody: z.string().max(2000).optional(),
      thankYouCtaLabel: z.string().max(100).optional(),
      thankYouCtaUrl: z.string().url().max(2000).optional(),
    })
    .optional(),
});

export const updateStudySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(STUDY_STATUSES).optional(),
  settings: z
    .object({
      allowBackNavigation: z.boolean().optional(),
      showProgress: z.boolean().optional(),
      completionRedirectUrl: z
        .string()
        .url()
        .max(2000)
        .optional()
        .nullable(),
      quota: z.number().int().positive().max(100000).optional().nullable(),
      theme: surveyThemeSchema.optional().nullable(),
      thankYouHeading: z.string().max(200).optional().nullable(),
      thankYouBody: z.string().max(2000).optional().nullable(),
      thankYouCtaLabel: z.string().max(100).optional().nullable(),
      thankYouCtaUrl: z.string().url().max(2000).optional().nullable(),
    })
    .optional(),
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
export type UpdateStudyInput = z.infer<typeof updateStudySchema>;
