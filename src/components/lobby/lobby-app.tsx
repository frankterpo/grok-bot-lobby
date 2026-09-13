"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BotGrid } from "@/components/lobby/bot-grid";
import { ContextPanel, PanelExpand } from "@/components/lobby/context-panel";
import { CreateEventDialog } from "@/components/lobby/create-event-dialog";
import { EventCodeChip } from "@/components/lobby/event-code-chip";
import { LobbySidebar } from "@/components/lobby/lobby-sidebar";
import { OnboardingScreen } from "@/components/lobby/onboarding-screen";
import { PermissionsWalkthrough } from "@/components/lobby/permissions-walkthrough";
import { SessionSwitcher } from "@/components/lobby/session-switcher";
import { SquadInviteBanner } from "@/components/lobby/squad-invite-banner";
import { TokenExchanges } from "@/components/lobby/token-exchanges";
import { TokenProposeDialog, type ProposeTarget } from "@/components/lobby/token-propose-dialog";
import { Button } from "@/components/ui/button";
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
  isBotWorking,
  type Actor,
  type Event,
  type LobbySnapshot,
  type Selection,
  type ShareLevel,
  presenceState,
} from "@/lib/domain";
import { filterSoloAttendees, sortSoloAttendees } from "@/lib/grid-sort";
import { persistLumaProfilesToStorage, readLumaProfilesFromStorage, mergeLumaProfiles } from "@/lib/profile-browser-cache";
import { canShareEvent } from "@/lib/policy";
import { CHECKLIST_COPY } from "@/lib/onboarding";
import { resolveShareJoinUrl } from "@/lib/format";

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
  const [editOpen, setEditOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [proposeTarget, setProposeTarget] = useState<ProposeTarget | null>(null);
  const [proposeSending, setProposeSending] = useState(false);
  const [proposeSent, setProposeSent] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const slot = typeof window === "undefined" ? "you" : readSlot();

  const shareJoin = useMemo(
    () => (snapshot?.joinUrl ? resolveShareJoinUrl(snapshot.joinUrl) : null),
    [snapshot?.joinUrl],
  );

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
    if (as === "attendee") {
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
    if (loading || !snapshot || createOpen || !onboarded) {
      return;
    }
    if (readSlot() === "you" && snapshot.session.role !== "host") {
      router.replace("/host");
      return;
    }
    if (snapshot.session.role === "host" && snapshot.events.length === 0) {
      setCreateOpen(true);
    }
  }, [loading, snapshot, createOpen, onboarded, router]);

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
        hostAuthenticated: snapshot.session.hostAuthenticated,
      }
    : null;

  const currentAttendee = useMemo(() => {
    if (!snapshot?.event || !snapshot.session.userId) {
      return null;
    }
    return snapshot.event.attendees.find((attendee) => attendee.id === snapshot.session.userId) ?? null;
  }, [snapshot]);

  const profileAnimated = useMemo(() => {
    if (!currentAttendee || !snapshot) {
      return false;
    }
    const record = snapshot.presence.find((item) => item.userId === currentAttendee.id);
    const token = snapshot.tokens.find((item) => item.botId === currentAttendee.id);
    return isBotWorking(record, token, now);
  }, [currentAttendee, snapshot, now]);

  const profiles = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return mergeLumaProfiles(snapshot.profiles, readLumaProfilesFromStorage());
  }, [snapshot]);

  useEffect(() => {
    if (snapshot?.profiles.length) {
      persistLumaProfilesToStorage(snapshot.profiles);
    }
  }, [snapshot?.profiles]);

  const solo = useMemo(() => {
    if (!snapshot?.event) {
      return [];
    }
    const ungrouped = filterSoloAttendees(snapshot.event.attendees, snapshot.presence, HOST_USER_ID);
    return sortSoloAttendees(ungrouped, snapshot.session.userId, snapshot.presence, HOST_USER_ID);
  }, [snapshot]);

  async function updateSharePrefs(input: {
    shareTokens: boolean;
    shareLevel?: ShareLevel;
  }): Promise<void> {
    if (!snapshot?.event) {
      return;
    }
    const response = await lobbyFetch("/api/bots/prefs", {
      method: "POST",
      body: JSON.stringify({
        eventId: snapshot.event.id,
        ...input,
      }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Could not update sharing prefs.");
    }
  }

  if (!onboarded) {
    return (
      <>
        <OnboardingScreen
          items={snapshot?.checklist ?? CHECKLIST_COPY.map((item, index) => ({ ...item, step: index + 1, done: false }))}
          onOpenLobby={() => {
            window.sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
            setOnboarded(true);
            router.replace("/host");
          }}
          onCreate={() => {
            window.sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
            setOnboarded(true);
            router.replace("/host");
          }}
          onJoin={() => {
            window.sessionStorage.setItem(ONBOARD_STORAGE_KEY, "1");
            router.push("/join");
          }}
        />
        <CreateEventDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(event) => {
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
            Bad event code? Ask the host to copy the join link. Hosts sign in at{" "}
            <span className="font-mono text-white/50">/host</span>; attendees use{" "}
            <span className="font-mono text-white/50">/join/CODE</span>.
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

  async function respondInvite(inviteId: string, status: "accepted" | "rejected"): Promise<void> {
    const liveEventId = snapshot?.event?.id;
    if (!liveEventId) {
      return;
    }
    await lobbyFetch("/api/squads/respond", {
      method: "POST",
      body: JSON.stringify({ eventId: liveEventId, inviteId, status }),
    });
  }

  async function sendProposal(): Promise<void> {
    if (!snapshot?.event || !snapshot.session.userId || !proposeTarget) {
      return;
    }
    setProposeSending(true);
    setProposeError(null);
    const response = await lobbyFetch("/api/token-exchange/propose", {
      method: "POST",
      body: JSON.stringify({
        eventId: snapshot.event.id,
        fromBotId: snapshot.session.userId,
        ...proposeTarget,
      }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setProposeError(body.error ?? "Could not propose token.");
      setProposeSending(false);
      return;
    }
    setProposeSending(false);
    setProposeSent(true);
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0d0d0d] text-[12px] text-white/80">
      <LobbySidebar
        events={snapshot.events}
        activeEventId={snapshot.event?.id ?? null}
        joinUrl={snapshot.joinUrl}
        actor={actor}
        currentAttendee={currentAttendee}
        checklistItems={snapshot.checklist}
        activeBotCount={snapshot.activeBotCount}
        pendingApprovalCount={snapshot.pendingApprovalCount}
        profileAnimated={profileAnimated}
        onSelect={(id) => {
          setEventId(id);
          void load(id);
        }}
        onCreate={() => setCreateOpen(true)}
        onDeleteEvent={
          actor.hostAuthenticated
            ? async (id) => {
                await lobbyFetch("/api/events", {
                  method: "DELETE",
                  body: JSON.stringify({ eventId: id }),
                });
                setSnapshot(null);
                void load();
              }
            : undefined
        }
        onProfileClick={() => {
          if (!snapshot.session.userId) {
            return;
          }
          setPanelCollapsed(false);
          setSelection({ kind: "you", attendeeId: snapshot.session.userId });
        }}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#262626] px-4 py-2">
          <div>
            <p className="micro text-white/40">Grok Bot Lobby</p>
            <p className="text-[13px] text-white/85">{snapshot.event?.name ?? "No event"}</p>
            {snapshot.event && shareJoin ? (
              <>
                <EventCodeChip
                  code={snapshot.event.eventCode}
                  eventId={snapshot.event.id}
                  joinUrl={snapshot.joinUrl!}
                />
                {canShareEvent(actor) ? (
                  <p className="micro mt-1 max-w-md text-white/35">
                    Click the chip to copy{" "}
                    <span className="font-mono text-white/45">{shareJoin.url}</span>. Tell your guest bot:{" "}
                    <span className="text-white/50">
                      Join lobby {snapshot.event.eventCode} at {new URL(shareJoin.url).origin}
                    </span>
                    {!shareJoin.isRemoteShareable ? (
                      <span className="mt-1 block text-white/35">
                        Local link only — complete public URL setup in the share wizard for remote joins.
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
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
          <SquadInviteBanner
            invites={snapshot.squadInvites ?? []}
            event={snapshot.event}
            actor={actor}
            onRespond={respondInvite}
          />
        ) : null}
        {snapshot.event ? (
          <BotGrid
            solo={solo}
            squads={snapshot.event.squads}
            tokens={snapshot.tokens}
            presence={snapshot.presence}
            now={now}
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
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/40">
            <p>No event selected.</p>
            {canShareEvent(actor) ? (
              <Button
                type="button"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreateOpen(true)}
              >
                Create event
              </Button>
            ) : null}
          </div>
        )}
        {panelCollapsed ? <PanelExpand onClick={() => setPanelCollapsed(false)} /> : null}
      </div>
      {panelCollapsed || !snapshot.event ? null : (
        <ContextPanel
          selection={selection}
          attendees={snapshot.event.attendees}
          squads={snapshot.event.squads}
          tokens={snapshot.tokens}
          profiles={profiles}
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
          onKick={async (attendeeId) => {
            await lobbyFetch("/api/bots/kick", {
              method: "POST",
              body: JSON.stringify({ eventId: snapshot.event?.id, attendeeId }),
            });
          }}
          onRemoveFromSquad={async (squadId, attendeeId) => {
            await lobbyFetch("/api/squads/remove", {
              method: "POST",
              body: JSON.stringify({ eventId: snapshot.event?.id, squadId, attendeeId }),
            });
          }}
          onPropose={(input) => {
            setProposeTarget(input);
            setProposeSent(false);
            setProposeError(null);
          }}
          onApprove={approveExchange}
          onReject={rejectExchange}
          shareTokens={snapshot.session.shareTokens}
          shareLevel={snapshot.session.shareLevel}
          onSharePrefs={updateSharePrefs}
          onEdit={() => setEditOpen(true)}
        />
      )}
      <CreateEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(event) => {
          void load(event.id);
        }}
      />
      <TokenProposeDialog
        open={proposeTarget !== null}
        target={proposeTarget}
        token={
          snapshot.session.userId
            ? snapshot.tokens.find((item) => item.botId === snapshot.session.userId)
            : undefined
        }
        attendees={snapshot.event?.attendees ?? []}
        squads={snapshot.event?.squads ?? []}
        sending={proposeSending}
        sent={proposeSent}
        error={proposeError}
        onConfirm={() => void sendProposal()}
        onClose={() => {
          setProposeTarget(null);
          setProposeSent(false);
          setProposeError(null);
        }}
      />
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
