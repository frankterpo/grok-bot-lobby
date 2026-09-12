"use client";

import { Button } from "@/components/ui/button";
import type { Actor, TokenExchangeRequest } from "@/lib/domain";
import { canResolveExchange } from "@/lib/policy";
import type { Event } from "@/lib/domain";

type TokenExchangesProps = {
  exchanges: TokenExchangeRequest[];
  attendees: Array<{ id: string; name: string }>;
  actor: Actor;
  event: Event;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
};

export function TokenExchanges({
  exchanges,
  attendees,
  actor,
  event,
  onApprove,
  onReject,
}: TokenExchangesProps) {
  const pending = exchanges.filter((item) => item.status === "pending");
  if (pending.length === 0) {
    return null;
  }

  function nameOf(id: string | undefined): string {
    if (!id) {
      return "squad";
    }
    return attendees.find((person) => person.id === id)?.name ?? id.slice(0, 8);
  }

  return (
    <div className="border-t border-[#262626] px-3 py-3">
      <p className="micro text-[#f59e0b]">Pending token exchanges</p>
      <ul className="mt-2 space-y-2">
        {pending.map((item) => {
          const canResolve = canResolveExchange(actor, item, event);
          return (
            <li key={item.id} className="rounded-md border border-[#262626] bg-[#161616] p-2">
              <p className="text-[11px] text-white/75">
                {nameOf(item.fromBotId)} → {item.toBotId ? nameOf(item.toBotId) : "squad"}
              </p>
              <p className="mt-0.5 text-[11px] text-white/50">{item.token.taskLabel}</p>
              {canResolve ? (
                <div className="mt-2 flex gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    className="h-6 bg-[#f59e0b] text-[#0d0d0d] hover:bg-[#f59e0b]/90"
                    onClick={() => void onApprove(item.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-6 border-[#262626]"
                    onClick={() => void onReject(item.id)}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <p className="micro mt-1 text-white/30">Waiting on recipient</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
