import { ListTodo, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
}

export function EmptyState({ hasFilters, onClearFilters }: EmptyStateProps) {
  const Icon = hasFilters ? SearchX : ListTodo;

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">
        {hasFilters ? "No matches" : "No tasks yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {hasFilters
          ? "Try changing your search or filters to find what you’re looking for."
          : "Add a task above to capture what you want to get done."}
      </p>
      {hasFilters && (
        <Button variant="outline" className="mt-5" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
