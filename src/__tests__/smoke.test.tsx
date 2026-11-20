import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/constants";

function SmokeComponent() {
  return (
    <div>
      <h1>{APP_NAME} Smoke Test</h1>
      <p>Verifying jsdom, React, tsconfig alias, and jest-dom matchers.</p>
    </div>
  );
}

describe("Smoke Test", () => {
  it("renders a trivial inline component proving jsdom, React, the alias and jest-dom work", () => {
    render(<SmokeComponent />);
    const heading = screen.getByRole("heading", { level: 1, name: "TaskFlow AI Smoke Test" });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/Verifying jsdom/i)).toBeInTheDocument();
  });
});
