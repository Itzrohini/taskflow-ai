"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ImproveDialog } from "@/components/ai/improve-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPriority } from "@/lib/api";
import type { Priority, TaskCreateInput } from "@/lib/types";

interface QuickAddProps {
  onAdd: (task: TaskCreateInput) => Promise<boolean>;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  function clearForm() {
    setTitle("");
    setPriority("medium");
    setDueDate("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setValidationError("Enter a task title.");
      return;
    }
    if (cleanTitle.length > 200) {
      setValidationError("Task titles must be 200 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setValidationError("");
    const saved = await onAdd({
      title: cleanTitle,
      priority,
      due_date: dueDate || null,
    });
    if (saved) {
      clearForm();
    }
    setSubmitting(false);
  }

  async function createSuggestion(
    input: TaskCreateInput,
    originalTitle: string,
  ) {
    const saved = await onAdd(input);
    if (saved && title.trim() === originalTitle) clearForm();
    return saved;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm sm:flex sm:items-start sm:gap-3 sm:p-4"
    >
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="quick-add-title">
          Task title
        </label>
        <Input
          id="quick-add-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (validationError) setValidationError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="What needs to get done?"
          maxLength={200}
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? "quick-add-error" : undefined}
          disabled={submitting}
          autoComplete="off"
          className="h-11 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0 sm:text-lg"
        />
        {validationError && (
          <p id="quick-add-error" role="alert" className="px-2 pt-1 text-xs text-red-600">
            {validationError}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:flex-nowrap">
        <label className="sr-only" htmlFor="quick-add-priority">
          Priority
        </label>
        <Select
          value={priority}
          onValueChange={(value) => {
            if (value && isPriority(value)) setPriority(value);
          }}
          disabled={submitting}
        >
          <SelectTrigger id="quick-add-priority" className="h-10 w-[128px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low priority</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High priority</SelectItem>
          </SelectContent>
        </Select>

        <label className="sr-only" htmlFor="quick-add-due-date">
          Due date
        </label>
        <Input
          id="quick-add-due-date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          disabled={submitting}
          className="h-10 w-[148px] text-sm"
        />

        <Button type="submit" disabled={submitting} className="h-10 gap-2 px-4">
          <Plus aria-hidden="true" className="size-4" />
          {submitting ? "Adding…" : "Add"}
        </Button>
        <ImproveDialog
          title={title}
          disabled={submitting}
          onCreate={createSuggestion}
        />
      </div>
    </form>
  );
}
