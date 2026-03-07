import { z } from "zod";

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
    })
    .optional(),
});

export const updateStudySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
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
    })
    .optional(),
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
export type UpdateStudyInput = z.infer<typeof updateStudySchema>;
