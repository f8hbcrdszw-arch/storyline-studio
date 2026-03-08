import type { QuestionData } from "@/lib/types/question";

export interface QuestionBodyProps {
  question: QuestionData;
  answer: unknown;
  onChange: (value: unknown) => void;
}
