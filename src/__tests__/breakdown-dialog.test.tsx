import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BreakdownDialog } from "@/components/ai/breakdown-dialog";
import { localToday } from "@/lib/dates";
import type { Task } from "@/lib/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const task: Task = {
  id: "task-1",
  title: "Prepare product launch",
  description: "Coordinate launch activities.",
  priority: "high",
  completed: false,
  due_date: null,
  estimated_duration: null,
  subtasks: [],
  created_at: `${localToday()}T09:00:00Z`,
  updated_at: `${localToday()}T09:00:00Z`,
  completed_at: null,
};

function breakdownResponse() {
  return {
    status: 200,
    ok: true,
    json: async () => ({
      subtasks: [
        { title: "Draft announcement", description: "Prepare copy." },
        { title: "Notify partners", description: "Share launch timing." },
        { title: "Review metrics", description: null },
      ],
    }),
  } as Response;
}

describe("BreakdownDialog", () => {
  it("adds only selected, edited rows in one bulk callback", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(breakdownResponse());
    vi.stubGlobal("fetch", fetchMock);
    const onAdd = vi.fn(async () => true);
    render(<BreakdownDialog task={task} onAdd={onAdd} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Break down Prepare product launch" }),
    );
    await screen.findByLabelText("Subtask 1 title");
    fireEvent.change(screen.getByLabelText("Subtask 1 title"), {
      target: { value: "Edited launch copy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove subtask 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Add another subtask" }));
    fireEvent.change(screen.getByLabelText("Subtask 3 title"), {
      target: { value: "Confirm launch assets" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include subtask 2" }));

    fireEvent.click(screen.getByRole("button", { name: "Add 2 subtasks" }));
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledOnce();
    });
    expect(onAdd).toHaveBeenCalledWith("task-1", [
      { title: "Edited launch copy", description: "Prepare copy." },
      { title: "Confirm launch assets", description: undefined },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("disables submission when nothing is selected or a selected title is empty", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(breakdownResponse()));
    render(<BreakdownDialog task={task} onAdd={vi.fn(async () => true)} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Break down Prepare product launch" }),
    );
    await screen.findByLabelText("Subtask 1 title");
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((checkbox) => fireEvent.click(checkbox));
    expect(screen.getByRole("button", { name: "Add 0 subtasks" })).toBeDisabled();

    fireEvent.click(checkboxes[0]!);
    fireEvent.change(screen.getByLabelText("Subtask 1 title"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Add 1 subtasks" })).toBeDisabled();
  });
});
