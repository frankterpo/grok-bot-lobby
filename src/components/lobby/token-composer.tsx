"use client";

import { useEffect, useState } from "react";

import {
  shareLevelCopy,
  shareLevelDescription,
  SHARE_LEVELS,
  type ShareLevel,
} from "@/lib/domain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TokenShareToggleProps = {
  shareTokens: boolean;
  shareLevel: ShareLevel;
  lastSyncedLabel?: string | null;
  onUpdate: (input: { shareTokens: boolean; shareLevel?: ShareLevel }) => Promise<void>;
};

export function TokenShareToggle({
  shareTokens,
  shareLevel,
  lastSyncedLabel,
  onUpdate,
}: TokenShareToggleProps) {
  const [enabled, setEnabled] = useState(shareTokens);
  const [level, setLevel] = useState(shareLevel);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setEnabled(shareTokens);
  }, [shareTokens]);

  useEffect(() => {
    setLevel(shareLevel);
  }, [shareLevel]);

  async function toggle(): Promise<void> {
    const next = !enabled;
    setPending(true);
    try {
      await onUpdate({ shareTokens: next, shareLevel: level });
      setEnabled(next);
    } finally {
      setPending(false);
    }
  }

  async function changeLevel(next: ShareLevel): Promise<void> {
    setLevel(next);
    setPending(true);
    try {
      await onUpdate({ shareTokens: enabled, shareLevel: next });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[#262626] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-white/80">Share task token overview with lobby</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {enabled
              ? shareLevelDescription(level)
              : "Others won't see your task token on your card or detail panel."}
          </p>
          {enabled && lastSyncedLabel ? (
            <p className="text-[11px] text-white/30">Last sync: {lastSyncedLabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Share task token overview with lobby"
          disabled={pending}
          onClick={() => void toggle()}
          className={cn(
            "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
            enabled ? "bg-white/80" : "bg-[#262626]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
              enabled ? "left-4" : "left-0.5",
            )}
          />
        </button>
      </div>
      {enabled ? (
        <label className="block">
          <span className="micro text-white/40">Share level</span>
          <Select value={level} onValueChange={(value) => void changeLevel(value as ShareLevel)}>
            <SelectTrigger size="sm" className="mt-1 h-7 w-full border-[#262626] bg-[#111] text-[11px]">
              <span className="flex-1 truncate text-left">{shareLevelCopy(level)}</span>
            </SelectTrigger>
            <SelectContent className="bg-[#161616]">
              {SHARE_LEVELS.map((item) => (
                <SelectItem key={item} value={item}>
                  <span className="block">
                    <span className="text-[12px] text-white/90">{shareLevelCopy(item)}</span>
                    <span className="mt-0.5 block text-[10px] text-white/40">
                      {shareLevelDescription(item)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
    </div>
  );
}
