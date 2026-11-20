"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPriority } from "@/lib/api";
import type { Priority, Task, TaskUpdateInput } from "@/lib/types";

interface TaskEditDialogProps {
  task: Task;
  onSave: (taskId: string, input: TaskUpdateInput) => Promise<boolean>;
}

export function TaskEditDialog({ task, onSave }: TaskEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [duration, setDuration] = useState(
    task.estimated_duration?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setDueDate(task.due_date ?? "");
      setDuration(task.estimated_duration?.toString() ?? "");
      setValidationError("");
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const numericDuration = duration.trim() ? Number(duration) : null;
    if (!cleanTitle || cleanTitle.length > 200) {
      setValidationError("Enter a title between 1 and 200 characters.");
      return;
    }
    if (
      numericDuration !== null &&
      (!Number.isInteger(numericDuration) ||
        numericDuration < 1 ||
        numericDuration > 1440)
    ) {
      setValidationError("Duration must be a whole number from 1 to 1440 minutes.");
      return;
    }

    setSaving(true);
    setValidationError("");
    const saved = await onSave(task.id, {
      title: cleanTitle,
      description: description.trim() || null,
      priority,
      due_date: dueDate || null,
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`edit-title-${task.id}`} className="text-sm font-medium">
              Title
            </label>
            <Input
              id={`edit-title-${task.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`edit-description-${task.id}`} className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id={`edit-description-${task.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Add a little more context…"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1.5 text-sm font-medium">
              Priority
              <Select
                value={priority}
                onValueChange={(value) => {
                  if (value && isPriority(value)) setPriority(value);
                }}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Due date
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-10"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Minutes
              <Input
                type="number"
                min={1}
                max={1440}
                step={1}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="Optional"
                className="h-10"
              />
            </label>
          </div>
          {validationError && (
            <p role="alert" className="text-sm text-red-600">
              {validationError}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
