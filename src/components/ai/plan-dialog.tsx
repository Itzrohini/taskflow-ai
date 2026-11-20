"use client";

import { useRef, useState } from "react";
import { AiButton } from "@/components/ai/ai-button";
import { PlanEmptyState } from "@/components/ai/plan-empty-state";
import { PlanResult } from "@/components/ai/plan-result";
import { PlanTimeForm } from "@/components/ai/plan-time-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAiRequest } from "@/hooks/use-ai-request";
import { aiPlan, listTasks } from "@/lib/api";
import { localToday } from "@/lib/dates";
import type { AiPlanRequest, AiPlanResponse } from "@/lib/types";

interface PlanDialogProps {
  pendingCount: number | null;
  onAccept: (plan: AiPlanResponse) => void;
}

export function PlanDialog({ pendingCount, onAccept }: PlanDialogProps) {
  const { run, loading, error, reset } =
    useAiRequest<AiPlanRequest, AiPlanResponse>(aiPlan);
  const [open, setOpen] = useState(false);
  const [minutesText, setMinutesText] = useState("240");
  const [result, setResult] = useState<AiPlanResponse | null>(null);
  const [resultBudget, setResultBudget] = useState(240);
  const [noPending, setNoPending] = useState(false);
  const [preflightError, setPreflightError] = useState<unknown>(null);
  const [validationError, setValidationError] = useState("");
  const [checkingPending, setCheckingPending] = useState(false);
  const generationId = useRef(0);
  const generating = useRef(false);

  const availableMinutes = Number(minutesText);
  const validMinutes =
    Number.isInteger(availableMinutes) &&
    availableMinutes >= 15 &&
    availableMinutes <= 960;
  const busy = loading || checkingPending;

  function start() {
    generationId.current += 1;
    reset();
    setResult(null);
    setNoPending(pendingCount === 0);
    setPreflightError(null);
    setValidationError("");
    setOpen(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      generationId.current += 1;
      generating.current = false;
      reset();
      setResult(null);
      setNoPending(false);
      setPreflightError(null);
      setCheckingPending(false);
    }
    setOpen(nextOpen);
  }

  async function generate() {
    if (generating.current) return;
    if (!validMinutes) {
      setValidationError("Choose between 15 and 960 minutes.");
      return;
    }
    const currentGenerationId = generationId.current;
    generating.current = true;
    setCheckingPending(true);
    setValidationError("");
    setPreflightError(null);
    let hasPendingTasks = pendingCount !== 0;

    try {
      if (hasPendingTasks) {
        const pending = await listTasks({
          status: "pending",
          limit: 1,
          today: localToday(),
        });
        hasPendingTasks = pending.total > 0;
      }
    } catch (requestError) {
      if (currentGenerationId === generationId.current) {
        setPreflightError(requestError);
      }
      generating.current = false;
      setCheckingPending(false);
      return;
    }

    if (currentGenerationId !== generationId.current) return;
    if (!hasPendingTasks) {
      setNoPending(true);
      generating.current = false;
      setCheckingPending(false);
      return;
    }

    const budget = availableMinutes;
    setCheckingPending(false);
    const plan = await run({
      available_minutes: budget,
      today: localToday(),
    });
    if (plan && currentGenerationId === generationId.current) {
      setResult(plan);
      setResultBudget(budget);
    }
    if (currentGenerationId === generationId.current) {
      generating.current = false;
    }
  }

  function updateMinutes(taskId: string, minutes: number) {
    setResult((current) =>
      current
        ? {
            ...current,
            plan: current.plan.map((task) =>
              task.task_id === taskId ? { ...task, minutes } : task,
            ),
          }
        : current,
    );
  }

  function removeTask(taskId: string) {
    setResult((current) =>
      current
        ? {
            ...current,
            plan: current.plan.filter((task) => task.task_id !== taskId),
          }
        : current,
    );
  }

  function acceptPlan(plan: AiPlanResponse) {
    onAccept(plan);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AiButton
        label="Plan my day"
        loadingLabel="Planning..."
        loading={busy}
        className="shrink-0"
        onClick={start}
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Plan my day</DialogTitle>
          <DialogDescription>
            Choose the time you have available, then review and adjust the
            suggestions.
          </DialogDescription>
        </DialogHeader>
        {noPending ? (
          <PlanEmptyState onClose={() => handleOpenChange(false)} />
        ) : result ? (
          <PlanResult
            result={result}
            availableMinutes={resultBudget}
            onMinutesChange={updateMinutes}
            onRemove={removeTask}
            onAccept={acceptPlan}
            onCancel={() => handleOpenChange(false)}
          />
        ) : (
          <PlanTimeForm
            minutesText={minutesText}
            validMinutes={validMinutes}
            validationError={validationError}
            preflightError={preflightError}
            aiError={error}
            busy={busy}
            onMinutesChange={(value) => {
              setMinutesText(value);
              setValidationError("");
            }}
            onGenerate={() => void generate()}
            onCancel={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
