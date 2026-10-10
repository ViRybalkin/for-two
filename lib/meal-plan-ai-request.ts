export const MEAL_PLAN_AI_TIMEOUT_MS = 240_000;

export const MEAL_PLAN_AI_REQUEST_OPTIONS = {
  timeout: MEAL_PLAN_AI_TIMEOUT_MS,
  maxRetries: 0
} as const;
