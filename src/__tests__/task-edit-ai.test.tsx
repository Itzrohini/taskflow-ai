import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import { localToday } from "@/lib/dates";
import type { Task } from "@/lib/types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const task: Task = {
  id: "task-1",
  title: "Write update",
  description: "A brief status.",
  priority: "low",
  completed: false,
  due_date: "2026-11-24",
  estimated_duration: 30,
  subtasks: [],
  created_at: `${localToday()}T09:00:00Z`,
  updated_at: `${localToday()}T09:00:00Z`,
  completed_at: null,
};

it("applies an AI suggestion without saving and Undo restores the original fields", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        title: "Prepare a clear customer update",
        description: "Share the current status with customers.",
        priority: "high",
        due_date: "2026-11-28",
      }),
    } as Response),
  );
  const onSave = vi.fn(async () => true);
  render(<TaskEditDialog task={task} onSave={onSave} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit Write update" }));
  const title = await screen.findByLabelText("Title");
  fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));

  await waitFor(() => {
    expect(title).toHaveValue("Prepare a clear customer update");
  });
  expect(
    screen.getByText("AI suggestion applied. Review before saving."),
  ).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Undo AI changes" }));
  expect(screen.getByLabelText("Title")).toHaveValue("Write update");
  expect(screen.getByLabelText("Description")).toHaveValue("A brief status.");
  expect(screen.getByLabelText("Due date")).toHaveValue("2026-11-24");
  expect(onSave).not.toHaveBeenCalled();
});
