import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (client) return client;
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured");
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
