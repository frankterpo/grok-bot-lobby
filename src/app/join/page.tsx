"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinPastePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(event: FormEvent): void {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    router.push(`/join/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-[#262626] bg-[#111] p-5"
      >
        <p className="micro text-white/45">Join a Grok Bot lobby</p>
        <h1 className="mt-2 text-[16px] text-white/90">Paste the event code</h1>
        <p className="mt-2 text-[12px] text-white/50">
          Ask the host for the event code after they create a lobby. You can paste just the code or a full /join/CODE
          link.
        </p>
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABC123"
          className="mt-4 border-[#262626] bg-[#0d0d0d] font-mono text-[12px] uppercase"
        />
        <Button type="submit" className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90">
          Continue
        </Button>
      </form>
    </div>
  );
}
