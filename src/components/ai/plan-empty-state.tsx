"use client";

import { Button } from "@/components/ui/button";

export function PlanEmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        No pending tasks to plan right now.
      </p>
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
