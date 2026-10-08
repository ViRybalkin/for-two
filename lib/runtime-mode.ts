import "server-only";

export function isDemoMode() {
  return process.env.APP_ENABLE_DEMO_MODE === "true";
}

export const configurationError = {
  error: { code: "CONFIGURATION_ERROR", message: "Интеграция не настроена на сервере" }
};
