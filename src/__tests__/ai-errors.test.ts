import { describe, expect, it } from "vitest";
import { aiErrorMessage } from "@/lib/ai-errors";
import { ApiError } from "@/lib/api";

describe("AI error messages", () => {
  it.each([
    [
      "ai_not_configured",
      "AI isn't set up on the server. You can still manage tasks manually.",
    ],
    ["ai_timeout", "The AI took too long. Please try again."],
    [
      "ai_rate_limited",
      "Too many AI requests. Wait a moment and try again.",
    ],
    [
      "ai_invalid_output",
      "The AI returned an unusable response. Please try again.",
    ],
    [
      "ai_provider_error",
      "The AI returned an unusable response. Please try again.",
    ],
  ])("maps %s to a friendly message", (code, message) => {
    expect(aiErrorMessage(new ApiError("provider detail", 503, code))).toBe(
      message,
    );
  });

  it("maps network and client-timeout errors", () => {
    expect(aiErrorMessage(new ApiError("backend unavailable", 0))).toBe(
      "Couldn't reach the server.",
    );
    expect(
      aiErrorMessage(new ApiError("The request timed out.", 0)),
    ).toBe("The AI took too long. Please try again.");
  });
});
