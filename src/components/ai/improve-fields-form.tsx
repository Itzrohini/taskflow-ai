"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
import type { Priority } from "@/lib/types";

export interface ImproveFields {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
}

interface ImproveFieldsFormProps {
  fields: ImproveFields;
  saving: boolean;
  validationError: string;
  onChange: (patch: Partial<ImproveFields>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDiscard: () => void;
}

export function ImproveFieldsForm({
  fields,
  saving,
  validationError,
  onChange,
  onSubmit,
  onDiscard,
}: ImproveFieldsFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="improve-title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="improve-title"
          value={fields.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={200}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="improve-description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="improve-description"
          value={fields.description}
          onChange={(event) => onChange({ description: event.target.value })}
          maxLength={2000}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
      {validationError && (
        <p role="alert" className="text-sm text-rose-700">
          {validationError}
        </p>
      )}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create task"}
        </Button>
      </DialogFooter>
    </form>
  );
}
