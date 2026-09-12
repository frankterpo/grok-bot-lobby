"use client";

import { TOKEN_STATUSES, shareLevelCopy, SHARE_LEVELS, tokenStatusCopy, type ShareLevel, type TokenStatus } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

type TokenComposerProps = {
  initialLabel: string;
  initialStatus: TokenStatus;
  shareLevel: ShareLevel;
  onSync: (input: { taskLabel: string; status: TokenStatus; shareLevel: ShareLevel }) => Promise<void>;
};

export function TokenComposer({ initialLabel, initialStatus, shareLevel, onSync }: TokenComposerProps) {
  const [taskLabel, setTaskLabel] = useState(initialLabel);
  const [status, setStatus] = useState<TokenStatus>(initialStatus);
  const [level, setLevel] = useState<ShareLevel>(shareLevel);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    try {
      await onSync({ taskLabel, status, shareLevel: level });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2 border-t border-[#262626] p-3">
      <p className="micro text-white/40">What your bot is on</p>
      <Input
        value={taskLabel}
        onChange={(event) => setTaskLabel(event.target.value)}
        placeholder="Setting up event credits"
        className="h-8 border-[#262626] bg-[#111] text-[12px]"
      />
      <div className="flex gap-2">
        <Select value={status} onValueChange={(value) => setStatus(value as TokenStatus)}>
          <SelectTrigger size="sm" className="h-7 flex-1 border-[#262626] bg-[#111] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#161616]">
            {TOKEN_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {tokenStatusCopy(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="sm"
          disabled={pending || taskLabel.trim().length === 0}
          className="bg-[#f59e0b] text-[#0d0d0d] hover:bg-[#f59e0b]/90"
        >
          Sync
        </Button>
      </div>
      <Select value={level} onValueChange={(value) => setLevel(value as ShareLevel)}>
        <SelectTrigger size="sm" className="h-7 border-[#262626] bg-[#111] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#161616]">
          {SHARE_LEVELS.map((item) => (
            <SelectItem key={item} value={item}>
              {shareLevelCopy(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
