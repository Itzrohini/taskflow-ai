import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  unreachable: boolean;
  onRetry: () => void;
}

export function ErrorState({ message, unreachable, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center"
    >
      <span className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-white text-rose-600">
        <AlertCircle aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">
        {unreachable ? "Backend could not be reached" : "Could not load tasks"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {message}
      </p>
      <Button onClick={onRetry} variant="outline" className="mt-5 gap-2">
        <RefreshCw aria-hidden="true" className="size-4" />
        Retry
      </Button>
    </div>
  );
}
