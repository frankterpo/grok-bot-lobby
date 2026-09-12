"use client";

import { PERMISSIONS_COPY, TOKEN_PRIVACY_LINE } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PermissionsWalkthroughProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
};

export function PermissionsWalkthrough({ open, onOpenChange, onAccept }: PermissionsWalkthroughProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#262626] bg-[#111] text-[12px]" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-[14px] text-white/90">I&apos;m your Grok Bot. Here&apos;s what I share.</DialogTitle>
          <DialogDescription className="text-[12px] text-white/50">
            First join only. You can reopen this from YOU → Edit.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {PERMISSIONS_COPY.map((item) => (
            <li key={item.id}>
              <p className="micro text-[#f59e0b]">{item.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/60">{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="rounded-md border border-[#262626] bg-[#161616] px-2.5 py-2 text-[11px] text-white/50">
          {TOKEN_PRIVACY_LINE}
        </p>
        <DialogFooter className="border-[#262626] bg-transparent">
          <Button
            type="button"
            className="w-full bg-[#f59e0b] text-[#0d0d0d] hover:bg-[#f59e0b]/90"
            onClick={onAccept}
          >
            Got it — show my bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
