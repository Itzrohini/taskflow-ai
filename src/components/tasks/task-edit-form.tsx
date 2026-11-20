"use client";

import type { FormEvent } from "react";
import {
  ImproveAction,
  type ImproveSource,
} from "@/components/ai/improve-action";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogFooter,
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
import type { AiImproveResponse, Priority } from "@/lib/types";

export interface EditFields {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
}

interface TaskEditFormProps {
  taskId: string;
  fields: EditFields;
  duration: string;
  saving: boolean;
  validationError: string;
  aiApplied: boolean;
  onChange: (patch: Partial<EditFields>) => void;
  onDurationChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSuggestion: (
    suggestion: AiImproveResponse,
    source: ImproveSource,
  ) => void;
  onUndo: () => void;
}

export function TaskEditForm({
  taskId,
  fields,
  duration,
  saving,
  validationError,
  aiApplied,
  onChange,
  onDurationChange,
  onSubmit,
  onSuggestion,
  onUndo,
}: TaskEditFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={`edit-title-${taskId}`} className="text-sm font-medium">
          Title
        </label>
        <Input
          id={`edit-title-${taskId}`}
          value={fields.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={200}
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor={`edit-description-${taskId}`}
          className="text-sm font-medium"
        >
          Description
        </label>
        <Textarea
          id={`edit-description-${taskId}`}
          value={fields.description}
          onChange={(event) => onChange({ description: event.target.value })}
          maxLength={2000}
          rows={3}
          placeholder="Add a little more context…"
        />
      </div>
      <div className="space-y-2 border-t border-slate-100 pt-4">
        <ImproveAction
          source={fields}
          onSuggestion={onSuggestion}
        />
        {aiApplied && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-indigo-700">
            <p role="status">AI suggestion applied. Review before saving.</p>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={onUndo}
            >
              Undo AI changes
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm font-medium">
          Priority
          <Select
            value={fields.priority}
            onValueChange={(priority) => {
              if (isPriority(priority)) onChange({ priority });
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
            value={fields.dueDate}
            onChange={(event) => onChange({ dueDate: event.target.value })}
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
            onChange={(event) => onDurationChange(event.target.value)}
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
  );
}
