import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanDialog } from "@/components/ai/plan-dialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function response(body: unknown): Response {
  return {
    status: 200,
    ok: true,
    json: async () => body,
  } as Response;
}

const planResponse = {
  summary: "Start with launch preparation.",
  plan: [
    {
      task_id: "task-1",
      title: "Prepare launch",
      priority: "high",
      due_date: "2026-11-20",
      minutes: 60,
      reason: "It is time-sensitive.",
    },
    {
      task_id: "task-2",
      title: "Send weekly update",
      priority: "medium",
      due_date: null,
      minutes: 30,
      reason: "Keep the team informed.",
    },
  ],
  postponed: [
    {
      task_id: "task-3",
      title: "Organize notes",
      reason: "Lower urgency today.",
    },
  ],
  warnings: ["There is more work than available time."],
  total_minutes: 90,
};

describe("PlanDialog", () => {
  it("renders warnings and postponed tasks, edits the total, and accepts the final plan", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          items: [{ id: "task-1" }],
          total: 2,
        }),
      )
      .mockResolvedValueOnce(response(planResponse));
    vi.stubGlobal("fetch", fetchMock);
    const onAccept = vi.fn();
    render(<PlanDialog pendingCount={2} onAccept={onAccept} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan my day" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate plan" }));
    expect(await screen.findByText("There is more work than available time.")).toBeInTheDocument();
    expect(screen.getByText("Organize notes")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Send weekly update from plan",
      }),
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minutes" }), {
      target: { value: "300" },
    });
    expect(await screen.findByText(/300 \/ 240 min/)).toBeInTheDocument();
    expect(screen.getByText("This plan exceeds the available time.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Accept plan" }));
    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith({
        ...planResponse,
        plan: [{ ...planResponse.plan[0], minutes: 300 }],
        total_minutes: 300,
      });
    });
  });

  it("shows an empty state without calling the AI when there are no pending tasks", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    render(<PlanDialog pendingCount={0} onAccept={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Plan my day" }));

    expect(screen.getByText("No pending tasks to plan right now.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
