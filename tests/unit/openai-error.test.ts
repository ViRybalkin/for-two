import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import { getOpenAIClientError, getOpenAIErrorDiagnostic } from "@/lib/openai-error";
import { MEAL_PLAN_AI_REQUEST_OPTIONS, MEAL_PLAN_AI_TIMEOUT_MS } from "@/lib/meal-plan-ai-request";

describe("OpenAI error handling", () => {
  it("reports rejected API keys without exposing them", () => {
    const result = getOpenAIClientError(Object.assign(new Error("Incorrect API key provided"), { status: 401, code: "invalid_api_key" }));
    expect(result.error.code).toBe("AI_AUTH_ERROR");
    expect(JSON.stringify(result)).not.toContain("sk-");
  });

  it("distinguishes unavailable models and exhausted quota", () => {
    expect(getOpenAIClientError({ status: 404, code: "model_not_found" }).error.code).toBe("AI_MODEL_NOT_FOUND");
    expect(getOpenAIClientError({ status: 429, code: "insufficient_quota" }).error.code).toBe("AI_QUOTA_EXCEEDED");
    expect(getOpenAIClientError({ status: 429, code: "rate_limit_exceeded" }).error.code).toBe("AI_RATE_LIMIT");
  });

  it("keeps only safe diagnostic fields", () => {
    const diagnostic = getOpenAIErrorDiagnostic({
      status: 403,
      code: "permission_denied",
      type: "invalid_request_error",
      request_id: "req_test",
      apiKey: "must-not-be-copied"
    });
    expect(diagnostic).toEqual({
      status: 403,
      code: "permission_denied",
      type: "invalid_request_error",
      requestId: "req_test",
      message: "Unknown OpenAI error"
    });
  });

  it("returns a clear error when OpenAI exceeds the application deadline", () => {
    const result = getOpenAIClientError(new OpenAI.APIConnectionTimeoutError());
    expect(result).toEqual({
      status: 503,
      error: { code: "AI_TIMEOUT", message: "Генерация заняла слишком много времени. Попробуйте ещё раз." }
    });
  });

  it("leaves time for Vercel to return the timeout response", () => {
    expect(MEAL_PLAN_AI_REQUEST_OPTIONS).toEqual({ timeout: 240_000, maxRetries: 0 });
    expect(MEAL_PLAN_AI_TIMEOUT_MS).toBeLessThan(300_000);
  });
});
