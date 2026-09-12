"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeSlot } from "@/lib/client";

export default function HostLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/host/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    setPending(false);

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Could not sign in as host.");
      return;
    }

    writeSlot("you");
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4">
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-sm space-y-4 rounded-lg border border-[#262626] bg-[#111] p-5"
      >
        <div>
          <p className="micro text-white/40">Grok Bot Lobby</p>
          <h1 className="text-[15px] font-medium text-white/90">Host sign-in</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            Enter the host secret shared out-of-band. This sets a signed session cookie — the{" "}
            <code className="font-mono text-white/55">?as=you</code> query param does not grant host access.
          </p>
        </div>
        <label className="block">
          <span className="micro text-white/40">Host secret</span>
          <Input
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="mt-1 border-[#262626] bg-[#0d0d0d] text-[12px]"
            placeholder="Paste HOST_SECRET"
          />
        </label>
        {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending || !secret.trim()}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {pending ? "Signing in…" : "Sign in as host"}
        </Button>
        <p className="text-center text-[11px] text-white/35">
          Attendees join via <span className="font-mono text-white/50">/join/CODE</span> only.
        </p>
      </form>
    </div>
  );
}
