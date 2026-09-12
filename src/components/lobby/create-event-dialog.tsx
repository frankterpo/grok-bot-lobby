"use client";

import { useState, type FormEvent } from "react";

import { ShareLink } from "@/components/lobby/share-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { lobbyFetch } from "@/lib/client";
import type { Event } from "@/lib/domain";

type CreateEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: Event, joinUrl: string) => void;
};

export function CreateEventDialog({ open, onOpenChange, onCreated }: CreateEventDialogProps) {
  const [name, setName] = useState("CoLoop Cowork");
  const [date, setDate] = useState("2026-09-12T17:00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ event: Event; joinUrl: string } | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    const iso = new Date(date).toISOString();
    const response = await lobbyFetch("/api/events", {
      method: "POST",
      body: JSON.stringify({ name, date: iso }),
    });
    const body = (await response.json()) as { error?: string; event?: Event; joinUrl?: string };
    setPending(false);
    if (!response.ok || !body.event || !body.joinUrl) {
      setError(body.error ?? "Could not open that lobby.");
      return;
    }
    setCreated({ event: body.event, joinUrl: body.joinUrl });
    onCreated(body.event, body.joinUrl);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setCreated(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-[#262626] bg-[#111]">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[14px]">Lobby is live. Send this link.</DialogTitle>
              <DialogDescription className="text-[12px] text-white/50">
                Tell Grok Bots: Join lobby {created.event.eventCode} at this URL. Not a web signup.
              </DialogDescription>
            </DialogHeader>
            <p className="font-mono text-[18px] tracking-[0.2em] text-white/90">{created.event.eventCode}</p>
            <ShareLink url={created.joinUrl} eventId={created.event.id} />
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <DialogHeader>
              <DialogTitle className="text-[14px]">Open a Grok Bot lobby</DialogTitle>
              <DialogDescription className="text-[12px] text-white/50">
                You host. After create, you get a shareable join link immediately.
              </DialogDescription>
            </DialogHeader>
            <label className="block">
              <span className="micro text-white/40">Event name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 border-[#262626] bg-[#0d0d0d] text-[12px]"
              />
            </label>
            <label className="block">
              <span className="micro text-white/40">Date</span>
              <Input
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 border-[#262626] bg-[#0d0d0d] text-[12px]"
              />
            </label>
            {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create event
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
