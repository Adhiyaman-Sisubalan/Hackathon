import { z } from 'zod';

export const AnomalyThresholdsSchema = z.object({
  minimumPercentagePointIncrease: z.number().nonnegative(),
  minimumBaselineMultiple: z.number().positive()
}).readonly();

/** Typed bootstrap configuration is the sole owner of anomaly threshold values. */
export const reconciliationBootstrapConfig = {
  anomalyThresholds: AnomalyThresholdsSchema.parse({
    minimumPercentagePointIncrease: 0.05,
    minimumBaselineMultiple: 2
  })
} as const;
