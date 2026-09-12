"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { defaultJoinCode, writeSlot } from "@/lib/client";
import type { IdentitySlot, SessionView } from "@/lib/domain";

type SessionSwitcherProps = {
  session: SessionView;
};

export function SessionSwitcher({ session }: SessionSwitcherProps) {
  const router = useRouter();

  function go(slot: IdentitySlot): void {
    writeSlot(slot);
    if (slot === "attendee" && !session.claimed) {
      router.push(`/join/${defaultJoinCode()}`);
      return;
    }
    router.push(slot === "you" ? "/?as=you" : "/?as=attendee");
  }

  const label = session.slot === "you" ? "Francisco · YOU" : session.userId ? "Attendee" : "Join as attendee";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-white/70" />
        }
      >
        {label}
        <ChevronDown className="size-3" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 bg-[#161616] text-[12px]">
        <DropdownMenuItem onClick={() => go("you")}>Francisco · YOU</DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("attendee")}>Attendee</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
