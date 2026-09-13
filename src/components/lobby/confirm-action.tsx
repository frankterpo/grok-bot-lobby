"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ConfirmActionProps = {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  variant?: "outline" | "destructive";
  className?: string;
};

export function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
  variant = "outline",
  className,
}: ConfirmActionProps) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant={armed ? "destructive" : variant}
      className={className}
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setPending(true);
        void onConfirm().finally(() => {
          setPending(false);
          setArmed(false);
        });
      }}
    >
      {pending ? "Working…" : armed ? confirmLabel : label}
    </Button>
  );
}
