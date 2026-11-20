import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImproveDialog } from "@/components/ai/improve-dialog";
import { QuickAdd } from "@/components/tasks/quick-add";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function response(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const suggestion = {
  title: "Write a concise customer update",
  description: "Summarize the release for customers.",
  priority: "high",
  due_date: "2026-11-25",
};

describe("ImproveDialog", () => {
  it("allows edits and creates only the edited suggestion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(response(200, suggestion)),
    );
    const onCreate = vi.fn(async () => true);
    render(
      <ImproveDialog title="Write update" onCreate={onCreate} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Improve task writing with AI" }),
    );
    await screen.findByDisplayValue(suggestion.title);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Edited customer update" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Edited description" },
    });
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2026-11-28" },
    });

    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        {
          title: "Edited customer update",
          description: "Edited description",
          priority: "high",
          due_date: "2026-11-28",
        },
        "Write update",
      );
    });
  });

  it("discards without saving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(response(200, suggestion)),
    );
    const onCreate = vi.fn(async () => true);
    render(<ImproveDialog title="Write update" onCreate={onCreate} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Improve task writing with AI" }),
    );
    await screen.findByDisplayValue(suggestion.title);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(onCreate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("QuickAdd when AI is unavailable", () => {
  it("shows a retryable error and still creates a task manually", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        response(502, {
          detail: "Safe provider message",
          code: "ai_provider_error",
        }),
      ),
    );
    const onAdd = vi.fn(async () => true);
    const { container } = render(<QuickAdd onAdd={onAdd} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), {
      target: { value: "Finish the roadmap" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Improve task writing with AI" }),
    );

    expect(
      await screen.findByText(
        "The AI returned an unusable response. Please try again.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        title: "Finish the roadmap",
        priority: "medium",
        due_date: null,
      });
    });
  });
});
