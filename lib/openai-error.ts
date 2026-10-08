type ErrorRecord = Record<string, unknown>;

export type OpenAIErrorDiagnostic = {
  status?: number;
  code?: string;
  type?: string;
  requestId?: string;
  message: string;
};

function asRecord(value: unknown): ErrorRecord {
  return value && typeof value === "object" ? value as ErrorRecord : {};
}

export function getOpenAIErrorDiagnostic(error: unknown): OpenAIErrorDiagnostic {
  const outer = asRecord(error);
  const inner = asRecord(outer.error);
  const headers = outer.headers instanceof Headers ? outer.headers : null;
  const status = typeof outer.status === "number" ? outer.status : undefined;
  const code = typeof outer.code === "string" ? outer.code : typeof inner.code === "string" ? inner.code : undefined;
  const type = typeof outer.type === "string" ? outer.type : typeof inner.type === "string" ? inner.type : undefined;
  const requestId = typeof outer.request_id === "string"
    ? outer.request_id
    : typeof outer.requestID === "string"
      ? outer.requestID
      : headers?.get("x-request-id") || undefined;
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown OpenAI error";

  return { status, code, type, requestId, message };
}

export function getOpenAIClientError(error: unknown) {
  const diagnostic = getOpenAIErrorDiagnostic(error);

  if (diagnostic.status === 401) {
    return { status: 503, error: { code: "AI_AUTH_ERROR", message: "Vercel не может авторизоваться в OpenAI. Проверьте OPENAI_API_KEY." } };
  }
  if (diagnostic.status === 403) {
    return { status: 503, error: { code: "AI_ACCESS_DENIED", message: "У ключа OpenAI нет доступа к выбранной модели." } };
  }
  if (diagnostic.code === "model_not_found" || diagnostic.status === 404) {
    return { status: 503, error: { code: "AI_MODEL_NOT_FOUND", message: "Модель из OPENAI_TEXT_MODEL недоступна этому проекту OpenAI." } };
  }
  if (diagnostic.code === "insufficient_quota") {
    return { status: 503, error: { code: "AI_QUOTA_EXCEEDED", message: "В проекте OpenAI закончилась доступная квота." } };
  }
  if (diagnostic.status === 429) {
    return { status: 503, error: { code: "AI_RATE_LIMIT", message: "OpenAI временно ограничил частоту запросов. Попробуйте позже." } };
  }

  return { status: 503, error: { code: "AI_UNAVAILABLE", message: "Не удалось составить меню. Попробуйте ещё раз." } };
}
