"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface BreakdownDraft {
  key: number;
  selected: boolean;
  title: string;
  description: string;
}

interface BreakdownEditorProps {
  rows: BreakdownDraft[];
  dirty: boolean;
  loading: boolean;
  onUpdate: (key: number, patch: Partial<BreakdownDraft>) => void;
  onRemove: (key: number) => void;
  onAdd: () => void;
  onRegenerate: () => void;
}

export function breakdownDraftValue(rows: BreakdownDraft[]) {
  return JSON.stringify(
    rows.map(({ selected, title, description }) => ({
      selected,
      title,
      description,
    })),
  );
}

export function BreakdownEditor({
  rows,
  dirty,
  loading,
  onUpdate,
  onRemove,
  onAdd,
  onRegenerate,
}: BreakdownEditorProps) {
  const selectedCount = rows.filter((row) => row.selected).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="secondary">{selectedCount} selected</Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            if (
              dirty &&
              !window.confirm("Regenerating will replace your edits. Continue?")
            ) {
              return;
            }
            onRegenerate();
          }}
        >
          Regenerate
        </Button>
      </div>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border border-slate-200 p-3"
          >
            <Checkbox
              checked={row.selected}
              onCheckedChange={(selected) =>
                onUpdate(row.key, { selected: selected === true })
              }
              aria-label={`Include subtask ${index + 1}`}
              className="mt-2"
            />
            <div className="min-w-0 space-y-2">
              <label className="sr-only" htmlFor={`breakdown-title-${row.key}`}>
                Subtask {index + 1} title
              </label>
              <Input
                id={`breakdown-title-${row.key}`}
                value={row.title}
                onChange={(event) =>
                  onUpdate(row.key, { title: event.target.value })
                }
                maxLength={200}
              />
              <label
                className="sr-only"
                htmlFor={`breakdown-description-${row.key}`}
              >
                Subtask {index + 1} description
              </label>
              <Textarea
                id={`breakdown-description-${row.key}`}
                value={row.description}
                onChange={(event) =>
                  onUpdate(row.key, { description: event.target.value })
                }
                maxLength={2000}
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove subtask ${index + 1}`}
              onClick={() => onRemove(row.key)}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length >= 30}
          onClick={onAdd}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add another subtask
        </Button>
        <span className="text-xs text-slate-500">{rows.length} / 30 maximum</span>
      </div>
    </div>
  );
}
