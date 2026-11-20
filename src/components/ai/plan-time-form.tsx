"use client";

import { LoaderCircle } from "lucide-react";
import { AiError } from "@/components/ai/ai-error";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PRESETS = [
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 480, label: "8 hours" },
];

interface PlanTimeFormProps {
  minutesText: string;
  validMinutes: boolean;
  validationError: string;
  preflightError: unknown;
  aiError: unknown;
  busy: boolean;
  onMinutesChange: (value: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
}

export function PlanTimeForm({
  minutesText,
  validMinutes,
  validationError,
  preflightError,
  aiError,
  busy,
  onMinutesChange,
  onGenerate,
  onCancel,
}: PlanTimeFormProps) {
  const availableMinutes = Number(minutesText);

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">
          Available time
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.minutes}
              type="button"
              variant={
                availableMinutes === preset.minutes ? "default" : "outline"
              }
              aria-pressed={availableMinutes === preset.minutes}
              onClick={() => onMinutesChange(String(preset.minutes))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <label
          htmlFor="plan-custom-minutes"
          className="block text-sm text-slate-600"
        >
          Custom minutes (15–960)
        </label>
        <Input
          id="plan-custom-minutes"
          type="number"
          min={15}
          max={960}
          step={1}
          value={minutesText}
          onChange={(event) => onMinutesChange(event.target.value)}
          aria-invalid={Boolean(validationError)}
          className="max-w-40"
        />
      </fieldset>
      {validationError && (
        <p role="alert" className="text-sm text-rose-700">
          {validationError}
        </p>
      )}
      {preflightError !== null && (
        <AiError error={preflightError} onRetry={onGenerate} />
      )}
      {aiError !== null && <AiError error={aiError} onRetry={onGenerate} />}
      {busy && (
        <p role="status" className="py-4 text-center text-sm text-slate-500">
          Thinking...
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={busy || !validMinutes}
          onClick={onGenerate}
        >
          {busy && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {busy ? "Generating..." : "Generate plan"}
        </Button>
      </DialogFooter>
    </div>
  );
}
