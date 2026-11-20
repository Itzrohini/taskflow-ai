import { ApiError } from "@/lib/api";

const AI_ERROR_MESSAGES: Record<string, string> = {
  ai_not_configured:
    "AI isn't set up on the server. You can still manage tasks manually.",
  ai_timeout: "The AI took too long. Please try again.",
  ai_rate_limited: "Too many AI requests. Wait a moment and try again.",
  ai_invalid_output:
    "The AI returned an unusable response. Please try again.",
  ai_provider_error:
    "The AI returned an unusable response. Please try again.",
};

export function aiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && AI_ERROR_MESSAGES[error.code]) {
      return AI_ERROR_MESSAGES[error.code];
    }
    if (error.status === 0) {
      if (error.message.toLowerCase().includes("timed out")) {
        return "The AI took too long. Please try again.";
      }
      return "Couldn't reach the server.";
    }
  }
  return "Something went wrong. Please try again.";
}
