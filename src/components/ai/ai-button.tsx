"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiButtonProps {
  label: string;
  loadingLabel: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  onClick: () => void;
}

export function AiButton({
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  className,
  ariaLabel,
  onClick,
}: AiButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={`gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 ${className ?? ""}`}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Sparkles aria-hidden="true" className="size-4" />
      )}
      {loading ? loadingLabel : label}
    </Button>
  );
}
