import { z } from 'zod';

export const ErrorCodeSchema = z.enum(['BOOTSTRAP_FAILED', 'QUERY_FAILED', 'INVALID_REQUEST', 'UNAVAILABLE', 'DUPLICATE_TRADE_ID', 'RUN_IN_PROGRESS', 'PERSISTENCE_FAILED', 'RUN_NOT_FOUND', 'RESULT_NOT_FOUND', 'REPORT_INELIGIBLE', 'REPORT_FAILED']);

export const FailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    retryable: z.boolean(),
    field: z.string().optional()
  })
});

export const success = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), data });
export const result = <T extends z.ZodType>(data: T) => z.union([success(data), FailureSchema]);
export type Failure = z.infer<typeof FailureSchema>;
