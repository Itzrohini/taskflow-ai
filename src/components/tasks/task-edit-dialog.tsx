"use client";

import { useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { TaskEditForm, type EditFields } from "@/components/tasks/task-edit-form";
import type { ImproveSource } from "@/components/ai/improve-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AiImproveResponse, Task, TaskUpdateInput } from "@/lib/types";

interface TaskEditDialogProps {
  task: Task;
  onSave: (taskId: string, input: TaskUpdateInput) => Promise<boolean>;
}

function fieldsFromTask(task: Task): EditFields {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    dueDate: task.due_date ?? "",
  };
}

export function TaskEditDialog({ task, onSave }: TaskEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<EditFields>(() => fieldsFromTask(task));
  const fieldsRef = useRef(fields);
  const [duration, setDuration] = useState(
    task.estimated_duration?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [undoFields, setUndoFields] = useState<EditFields | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const currentFields = fieldsFromTask(task);
      fieldsRef.current = currentFields;
      setFields(currentFields);
      setDuration(task.estimated_duration?.toString() ?? "");
      setValidationError("");
      setUndoFields(null);
      setAiApplied(false);
    }
    setOpen(nextOpen);
  }

  function applySuggestion(
    suggestion: AiImproveResponse,
    source: ImproveSource,
  ) {
    const previous = fieldsRef.current;
    setUndoFields(previous);
    const updated: EditFields = {
      title:
        previous.title === source.title ? suggestion.title : previous.title,
      description:
        previous.description === source.description
          ? suggestion.description ?? ""
          : previous.description,
      priority:
        previous.priority === source.priority
          ? suggestion.priority
          : previous.priority,
      dueDate:
        previous.dueDate === source.dueDate
          ? suggestion.due_date ?? ""
          : previous.dueDate,
    };
    fieldsRef.current = updated;
    setFields(updated);
    setAiApplied(true);
  }

  function undoSuggestion() {
    if (!undoFields) return;
    fieldsRef.current = undoFields;
    setFields(undoFields);
    setUndoFields(null);
    setAiApplied(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = fields.title.trim();
    const numericDuration = duration.trim() ? Number(duration) : null;
    if (!title || title.length > 200) {
      setValidationError("Enter a title between 1 and 200 characters.");
      return;
    }
    if (
      numericDuration !== null &&
      (!Number.isInteger(numericDuration) ||
        numericDuration < 1 ||
        numericDuration > 1440)
    ) {
      setValidationError(
        "Duration must be a whole number from 1 to 1440 minutes.",
      );
      return;
    }

    setSaving(true);
    setValidationError("");
    const saved = await onSave(task.id, {
      title,
      description: fields.description.trim() || null,
      priority: fields.priority,
      due_date: fields.dueDate || null,
      estimated_duration: numericDuration,
    });
    setSaving(false);
    if (saved) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${task.title}`}
          className="text-slate-500 hover:text-indigo-700"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Update the details for this task.</DialogDescription>
        </DialogHeader>
        {open && (
          <TaskEditForm
            taskId={task.id}
            fields={fields}
            duration={duration}
            saving={saving}
            validationError={validationError}
            aiApplied={aiApplied}
            onChange={(patch) => {
              const updated = { ...fieldsRef.current, ...patch };
              fieldsRef.current = updated;
              setFields(updated);
            }}
            onDurationChange={setDuration}
            onSubmit={handleSubmit}
            onSuggestion={applySuggestion}
            onUndo={undoSuggestion}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
