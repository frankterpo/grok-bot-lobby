"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BotGrid } from "@/components/lobby/bot-grid";
import { ContextPanel, PanelExpand } from "@/components/lobby/context-panel";
import { CreateEventDialog } from "@/components/lobby/create-event-dialog";
import { EventCodeChip } from "@/components/lobby/event-code-chip";
import { LobbySidebar } from "@/components/lobby/lobby-sidebar";
import { ChecklistDock, OnboardingScreen } from "@/components/lobby/onboarding-screen";
import { PermissionsWalkthrough } from "@/components/lobby/permissions-walkthrough";
import { SessionSwitcher } from "@/components/lobby/session-switcher";
import { ShareLink } from "@/components/lobby/share-link";
import { TokenExchanges } from "@/components/lobby/token-exchanges";
import {
  fetchSnapshot,
  lobbyFetch,
  ONBOARD_STORAGE_KEY,
  readSlot,
  rememberEventCode,
  streamUrl,
  writeSlot,
} from "@/lib/client";
import {
  HEARTBEAT_MS,
  HOST_USER_ID,
  type Actor,
  type Event,
  type LobbySnapshot,
  type Selection,
  type ShareLevel,
  type TokenStatus,
} from "@/lib/domain";
import { CHECKLIST_COPY } from "@/lib/onboarding";

export function LobbyApp() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [onboarded, setOnboarded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [createdJoin, setCreatedJoin] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const slot = typeof window === "undefined" ? "you" : readSlot();

  const load = useCallback(async (id?: string) => {
    try {
      const next = await fetchSnapshot(id);
      setSnapshot(next);
      setEventId(next.event?.id);
      if (next.event) {
        rememberEventCode(next.event.eventCode);
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load lobby.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ONBOARD_STORAGE_KEY);
    const params = new URLSearchParams(window.location.search);
    const as = params.get("as");
    if (as === "you" || as === "attendee") {
      writeSlot(as);
    }
    if (as === "attendee" || stored === "1") {
      setOnboarded(true);
    } else {
      setOnboarded(false);
    }
    void load();
  }, [load]);

  useEffect(() => {
    if (!eventId) {
      return;
    }
    let source: EventSource | null = null;
    let closed = false;
    let retry: number | undefined;
    const connect = () => {
      if (closed) {
        return;
      }
      source = new EventSource(streamUrl(eventId));
      source.onmessage = (message) => {
        try {
          const next = JSON.parse(message.data) as LobbySnapshot;
          setSnapshot(next);
        } catch {
          setError("Lobby stream sent a bad snapshot.");
        }
      };
      source.onerror = () => {
        source?.close();
        if (!closed) {
          retry = window.setTimeout(connect, 400);
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry !== undefined) {
        window.clearTimeout(retry);
      }
      source?.close();
    };
  }, [eventId, slot]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot?.session.claimed || !snapshot.session.userId || !snapshot.event) {
      return;
    }
    const botId = snapshot.session.userId;
    const liveEventId = snapshot.event.id;
    const beat = () => {
      void lobbyFetch("/api/presence/heartbeat", {
        method: "POST",
        body: JSON.stringify({ eventId: liveEventId, botId }),
      });
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [snapshot?.session.claimed, snapshot?.session.userId, snapshot?.event?.id]);

  useEffect(() => {
    if (!snapshot?.session.userId) {
      return;
    }
    if (selection.kind === "none") {
      setSelection({ kind: "you", attendeeId: snapshot.session.userId });
    }
  }, [snapshot?.session.userId, selection.kind]);

  const actor: Actor | null = snapshot
    ? {
        slot: snapshot.session.slot,
        userId: snapshot.session.userId,
        role: snapshot.session.role,
      }
    : null;

  const solo = useMemo(() => {
    if (!snapshot?.event) {
      return [];
    }
    const ungrouped = snapshot.event.attendees.filter((attendee) => !attendee.squadId);
    const rank = (id: string): number => {
      if (id === snapshot.session.userId) {
        return 0;
      }
      const record = snapshot.presence.find((item) => item.userId === id);
      if (record?.state === "active") {
        return 1;
      }
      if (id === HOST_USER_ID) {
        return 2;
      }
      if (!id.startsWith("demo_")) {
        return 3;
      }
      return 4;
    };
    return [...ungrouped].sort((a, b) => rank(a.id) - rank(b.id));
  }, [snapshot]);

  async function syncToken(input: { taskLabel: string; status: TokenStatus; shareLevel: ShareLevel }): Promise<void> {
    if (!snapshot?.event || !snapshot.session.userId) {
      return;
    }
    const response = await lobbyFetch("/api/lobby/sync", {
      method: "POST",
      body: JSON.stringify({
        eventId: snapshot.event.id,
        botId: snapshot.session.userId,
        ...input,
      }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Sync failed.");
    }
  }

  if (!onboarded) {
    return (
      <>
        <OnboardingScreen
          items={snapshot?.checklist ?? CHECKLIST_COPY.map((item, index) => ({ ...item, step: index + 1, done: false }))}
          onOpenSeed={() => {
            window.sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
            setOnboarded(true);
            writeSlot("you");
            router.replace("/?as=you");
          }}
          onCreate={() => {
            window.sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
            setOnboarded(true);
            setCreateOpen(true);
          }}
          onJoin={() => {
            window.sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
            router.push("/join");
          }}
        />
        <CreateEventDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(event, joinUrl) => {
            setCreatedJoin(joinUrl);
            setShareOpen(true);
            void load(event.id);
          }}
        />
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-[12px] text-white/40">
        Waking the lobby…
      </div>
    );
  }

  if (error && !snapshot?.event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-4">
        <div className="max-w-sm rounded-lg border border-[#262626] bg-[#111] p-4 text-[12px] text-white/70">
          <p>{error}</p>
          <p className="mt-2 text-white/40">
            Bad event code? Ask the host to copy the join link. Both sessions showing YOU? Open one tab with
            `?as=you` and the other with `?as=attendee`.
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot || !actor) {
    return null;
  }

  const selectedAttendeeId =
    selection.kind === "you" || selection.kind === "attendee" ? selection.attendeeId : null;
  const selectedSquadId = selection.kind === "squad" ? selection.squadId : null;

  async function approveExchange(requestId: string): Promise<void> {
    const liveEventId = snapshot?.event?.id;
    if (!liveEventId) {
      return;
    }
    await lobbyFetch("/api/token-exchange/approve", {
      method: "POST",
      body: JSON.stringify({ eventId: liveEventId, requestId }),
    });
  }

  async function rejectExchange(requestId: string): Promise<void> {
    const liveEventId = snapshot?.event?.id;
    if (!liveEventId) {
      return;
    }
    await lobbyFetch("/api/token-exchange/reject", {
      method: "POST",
      body: JSON.stringify({ eventId: liveEventId, requestId }),
    });
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0d0d0d] text-[12px] text-white/80">
      <LobbySidebar
        events={snapshot.events}
        activeEventId={snapshot.event?.id ?? null}
        joinUrl={snapshot.joinUrl}
        actor={actor}
        onSelect={(id) => {
          setEventId(id);
          void load(id);
        }}
        onCreate={() => setCreateOpen(true)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#262626] px-4 py-2">
          <div>
            <p className="micro text-white/40">Grok Bot Lobby</p>
            <p className="text-[13px] text-white/85">{snapshot.event?.name ?? "No event"}</p>
            {snapshot.event && snapshot.joinUrl ? (
              <EventCodeChip code={snapshot.event.eventCode} eventId={snapshot.event.id} joinUrl={snapshot.joinUrl} />
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <p className="micro text-white/40">
              {snapshot.activeBotCount} active · {snapshot.pendingApprovalCount} pending approvals
            </p>
            <SessionSwitcher session={snapshot.session} />
          </div>
        </header>
        {snapshot.event && snapshot.pendingApprovalCount > 0 ? (
          <div className="border-b border-[#262626] bg-[#111]">
            <TokenExchanges
              exchanges={snapshot.exchanges}
              attendees={snapshot.event.attendees}
              actor={actor}
              event={snapshot.event}
              onApprove={approveExchange}
              onReject={rejectExchange}
            />
          </div>
        ) : null}
        {snapshot.event ? (
          <BotGrid
            solo={solo}
            squads={snapshot.event.squads}
            selectedAttendeeId={selectedAttendeeId}
            selectedSquadId={selectedSquadId}
            panelCollapsed={panelCollapsed}
            onSelectAttendee={(id) => {
              const attendee = snapshot.event?.attendees.find((item) => item.id === id);
              if (attendee?.squadId) {
                setSelection({ kind: "squad", squadId: attendee.squadId });
                return;
              }
              setSelection(
                id === snapshot.session.userId
                  ? { kind: "you", attendeeId: id }
                  : { kind: "attendee", attendeeId: id },
              );
            }}
            onSelectSquad={(id) => setSelection({ kind: "squad", squadId: id })}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-white/40">Open or create an event.</div>
        )}
        {panelCollapsed ? <PanelExpand onClick={() => setPanelCollapsed(false)} /> : null}
      </div>
      {panelCollapsed || !snapshot.event ? null : (
        <ContextPanel
          selection={selection}
          attendees={snapshot.event.attendees}
          squads={snapshot.event.squads}
          tokens={snapshot.tokens}
          profiles={snapshot.profiles}
          presence={snapshot.presence}
          actor={actor}
          now={now}
          event={snapshot.event}
          exchanges={snapshot.exchanges}
          onCollapse={() => setPanelCollapsed(true)}
          onSelectAttendee={(id) =>
            setSelection(
              id === snapshot.session.userId
                ? { kind: "you", attendeeId: id }
                : { kind: "attendee", attendeeId: id },
            )
          }
          onInvite={async (attendeeId) => {
            await lobbyFetch("/api/squads/invite", {
              method: "POST",
              body: JSON.stringify({ eventId: snapshot.event?.id, attendeeId }),
            });
          }}
          onRequest={async (squadId) => {
            await lobbyFetch("/api/squads/request", {
              method: "POST",
              body: JSON.stringify({ eventId: snapshot.event?.id, squadId }),
            });
          }}
          onLeave={async (squadId) => {
            await lobbyFetch("/api/squads/leave", {
              method: "POST",
              body: JSON.stringify({ eventId: snapshot.event?.id, squadId }),
            });
          }}
          onPropose={async (input) => {
            if (!snapshot.event || !snapshot.session.userId) {
              return;
            }
            await lobbyFetch("/api/token-exchange/propose", {
              method: "POST",
              body: JSON.stringify({
                eventId: snapshot.event.id,
                fromBotId: snapshot.session.userId,
                ...input,
              }),
            });
          }}
          onApprove={approveExchange}
          onReject={rejectExchange}
          onSync={syncToken}
          onEdit={() => setEditOpen(true)}
        />
      )}
      <ChecklistDock items={snapshot.checklist} />
      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(event, joinUrl) => {
          setCreatedJoin(joinUrl);
          setShareOpen(true);
          void load(event.id);
        }}
      />
      {shareOpen && createdJoin ? (
        <div className="absolute top-14 right-[292px] z-30 w-80 rounded-lg border border-[#262626] bg-[#111] p-3 shadow-xl">
          <p className="micro text-[#f59e0b]">Shareable join link</p>
          <p className="mt-1 text-[12px] text-white/50">Send this. Second Grok Bot walks in live.</p>
          <div className="mt-2">
            <ShareLink url={createdJoin} eventId={eventId} />
          </div>
        </div>
      ) : null}
      <PermissionsWalkthrough
        open={editOpen}
        onOpenChange={setEditOpen}
        onAccept={() => {
          setEditOpen(false);
          if (snapshot.event) {
            void lobbyFetch("/api/bots/prefs", {
              method: "POST",
              body: JSON.stringify({ eventId: snapshot.event.id, permissionsAccepted: true }),
            });
          }
        }}
      />
    </div>
  );
}
