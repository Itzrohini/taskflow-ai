import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/tasks/empty-state";
import { ErrorState } from "@/components/tasks/error-state";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskItem } from "@/components/tasks/task-item";
import { localToday } from "@/lib/dates";
import type { Task } from "@/lib/types";

afterEach(cleanup);

const taskFixture: Task = {
  id: "task-1",
  title: "Finish the release notes",
  description: "Summarize the changes for customers.",
  priority: "high",
  completed: false,
  due_date: localToday(),
  estimated_duration: 30,
  subtasks: [],
  created_at: "2026-11-20T08:00:00Z",
  updated_at: "2026-11-20T08:00:00Z",
  completed_at: null,
};

describe("QuickAdd", () => {
  it("blocks an empty title", async () => {
    const onAdd = vi.fn(async () => true);
    const { container } = render(<QuickAdd onAdd={onAdd} />);

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a task title.",
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("submits a trimmed title when Enter is pressed", async () => {
    const onAdd = vi.fn(async () => true);
    render(<QuickAdd onAdd={onAdd} />);
    const title = screen.getByRole("textbox", { name: "Task title" });

    fireEvent.change(title, { target: { value: "  Plan the launch  " } });
    fireEvent.keyDown(title, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        title: "Plan the launch",
        priority: "medium",
        due_date: null,
      });
    });
  });

  it("disables the add button while the request is pending", async () => {
    let finishRequest: (value: boolean) => void = () => undefined;
    const onAdd = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishRequest = resolve;
        }),
    );
    const { container } = render(<QuickAdd onAdd={onAdd} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), {
      target: { value: "Add a task" },
    });

    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    finishRequest(true);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
    });
  });
});

describe("TaskItem", () => {
  it("renders priority and due-date labels and forwards completion toggles", () => {
    const onToggle = vi.fn(async () => true);
    render(
      <TaskItem
        task={taskFixture}
        onToggle={onToggle}
        onSave={vi.fn(async () => true)}
        onDelete={vi.fn(async () => true)}
        onAddSubtasks={vi.fn(async () => true)}
        onSaveSubtask={vi.fn(async () => true)}
        onDeleteSubtask={vi.fn(async () => true)}
      />,
    );

    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Due today")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Mark Finish the release notes completed",
      }),
    );
    expect(onToggle).toHaveBeenCalledWith("task-1", true);
  });

  it("requires confirmation before deleting a task", async () => {
    const onDelete = vi.fn(async () => true);
    render(
      <TaskItem
        task={taskFixture}
        onToggle={vi.fn(async () => true)}
        onSave={vi.fn(async () => true)}
        onDelete={onDelete}
        onAddSubtasks={vi.fn(async () => true)}
        onSaveSubtask={vi.fn(async () => true)}
        onDeleteSubtask={vi.fn(async () => true)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Finish the release notes" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete task" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("task-1"));
  });
});

describe("empty and error states", () => {
  it("distinguishes no tasks from no filter matches", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <EmptyState hasFilters={false} onClearFilters={onClear} />,
    );
    expect(screen.getByRole("heading", { name: "No tasks yet" })).toBeInTheDocument();

    rerender(<EmptyState hasFilters onClearFilters={onClear} />);
    expect(screen.getByRole("heading", { name: "No matches" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("calls the error-state Retry handler", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        message="The backend could not be reached."
        unreachable
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Backend could not be reached" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
