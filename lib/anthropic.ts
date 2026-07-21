import Anthropic from "@anthropic-ai/sdk";

// Server-only Claude client. The API key never reaches the browser.
let client: Anthropic | null = null;

export const MODEL = "claude-sonnet-5";

export function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY must be set");
    }
    client = new Anthropic();
  }
  return client;
}
