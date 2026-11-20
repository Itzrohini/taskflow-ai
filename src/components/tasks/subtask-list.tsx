"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Subtask, SubtaskInput } from "@/lib/types";

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  onAdd: (taskId: string, subtasks: SubtaskInput[]) => Promise<boolean>;
  onToggle: (
    taskId: string,
    subtaskId: string,
    completed: boolean,
  ) => Promise<boolean>;
  onDelete: (taskId: string, subtaskId: string) => Promise<boolean>;
}

export function SubtaskList({
  taskId,
  subtasks,
  onAdd,
  onToggle,
  onDelete,
}: SubtaskListProps) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 200) return;

    setAdding(true);
    const saved = await onAdd(taskId, [{ title: cleanTitle }]);
    if (saved) setTitle("");
    setAdding(false);
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {subtasks.length > 0 && (
        <ul className="space-y-2" aria-label="Subtasks">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="group flex items-center gap-3">
              <Checkbox
                checked={subtask.completed}
                onCheckedChange={(checked) =>
                  void onToggle(taskId, subtask.id, checked === true)
                }
                aria-label={`Complete subtask ${subtask.title}`}
              />
              <span
                className={`min-w-0 flex-1 text-sm ${
                  subtask.completed ? "text-slate-400 line-through" : "text-slate-700"
                }`}
              >
                {subtask.title}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete subtask ${subtask.title}`}
                onClick={() => void onDelete(taskId, subtask.id)}
                className="text-slate-400 opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`subtask-${taskId}`}>
          Add a subtask
        </label>
        <Input
          id={`subtask-${taskId}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a subtask…"
          maxLength={200}
          disabled={adding}
          className="h-9 bg-white"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={adding || !title.trim()}
          className="h-9 shrink-0 gap-1.5"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Add
        </Button>
      </form>
    </div>
  );
}
