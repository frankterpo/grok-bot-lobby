"use client";

import type { ReactNode } from "react";
import { ChevronRight, PanelRightClose } from "lucide-react";

import { ConfirmAction } from "@/components/lobby/confirm-action";
import { TokenShareToggle } from "@/components/lobby/token-composer";
import { TokenExchanges } from "@/components/lobby/token-exchanges";
import { GrokBot } from "@/components/lobby/grok-bot";
import { PresenceDot } from "@/components/lobby/presence-dot";
import { Button } from "@/components/ui/button";
import {
  assertNever,
  isBotWorking,
  presenceCopy,
  presenceState,
  receivedTokensFor,
  tokenStatusCopy,
  type Actor,
  type Attendee,
  type Event,
  type LobbyToken,
  type LumaProfile,
  type PresenceRecord,
  type Selection,
  type ShareLevel,
  type Squad,
  type TokenExchangeRequest,
} from "@/lib/domain";
import {
  canEditOwnBot,
  canInviteToSquad,
  canKickAttendee,
  canLeaveSquad,
  canProposeExchange,
  canRemoveFromSquad,
  canRequestJoin,
} from "@/lib/policy";
import { cn } from "@/lib/utils";

type ContextPanelProps = {
  selection: Selection;
  attendees: Attendee[];
  squads: Squad[];
  tokens: LobbyToken[];
  profiles: LumaProfile[];
  presence: PresenceRecord[];
  actor: Actor;
  now: number;
  event: Event;
  exchanges: TokenExchangeRequest[];
  onCollapse: () => void;
  onSelectAttendee: (id: string) => void;
  onInvite: (attendeeId: string) => Promise<void>;
  onRequest: (squadId: string) => Promise<void>;
  onLeave: (squadId: string) => Promise<void>;
  onKick: (attendeeId: string) => Promise<void>;
  onRemoveFromSquad: (squadId: string, attendeeId: string) => Promise<void>;
  onPropose: (input: { toBotId?: string; toSquadId?: string }) => void;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
  shareTokens: boolean;
  shareLevel: ShareLevel;
  onSharePrefs: (input: { shareTokens: boolean; shareLevel?: ShareLevel }) => Promise<void>;
  onEdit: () => void;
};

export function ContextPanel({
  selection,
  attendees,
  squads,
  tokens,
  profiles,
  presence,
  actor,
  now,
  event,
  exchanges,
  onCollapse,
  onSelectAttendee,
  onInvite,
  onRequest,
  onLeave,
  onKick,
  onRemoveFromSquad,
  onPropose,
  onApprove,
  onReject,
  shareTokens,
  shareLevel,
  onSharePrefs,
  onEdit,
}: ContextPanelProps) {
  const header = headerFor(selection, attendees, squads);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-[#262626] bg-[#111]">
      <div className="flex items-center justify-between border-b border-[#262626] px-3 py-2.5">
        <h2 className="micro text-white/70">{header}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 text-white/40"
          onClick={onCollapse}
          aria-label="Collapse panel"
        >
          <PanelRightClose strokeWidth={1.5} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {panelBody({
          selection,
          attendees,
          squads,
          tokens,
          profiles,
          presence,
          actor,
          now,
          event,
          exchanges,
          onSelectAttendee,
          onInvite,
          onRequest,
          onLeave,
          onKick,
          onRemoveFromSquad,
          onPropose,
          onApprove,
          onReject,
          shareTokens,
          shareLevel,
          onSharePrefs,
          onEdit,
        })}
      </div>
    </aside>
  );
}

function headerFor(selection: Selection, attendees: Attendee[], squads: Squad[]): string {
  switch (selection.kind) {
    case "you":
      return "You";
    case "attendee":
      return "Attendee";
    case "squad": {
      const squad = squads.find((item) => item.id === selection.squadId);
      return squad?.name ?? "Group";
    }
    case "none":
      return attendees.find((item) => item.isCurrentUser)?.name ?? "Lobby";
    default:
      return assertNever(selection, "selection");
  }
}

function panelBody(args: Omit<ContextPanelProps, "onCollapse">): ReactNode {
  const { selection } = args;
  switch (selection.kind) {
    case "you": {
      const attendee = args.attendees.find((item) => item.id === selection.attendeeId);
      if (!attendee) {
        return null;
      }
      return (
        <YouDetail
          attendee={attendee}
          profile={args.profiles.find((item) => item.userId === attendee.id) ?? null}
          token={args.tokens.find((token) => token.botId === attendee.id)}
          received={receivedTokensFor(args.exchanges, attendee.id, attendee.squadId)}
          presence={args.presence.find((record) => record.userId === attendee.id)}
          actor={args.actor}
          now={args.now}
          event={args.event}
          exchanges={args.exchanges}
          attendees={args.attendees}
          shareTokens={args.shareTokens}
          shareLevel={args.shareLevel}
          onSharePrefs={args.onSharePrefs}
          onEdit={args.onEdit}
          onApprove={args.onApprove}
          onReject={args.onReject}
        />
      );
    }
    case "attendee": {
      const attendee = args.attendees.find((item) => item.id === selection.attendeeId);
      if (!attendee) {
        return null;
      }
      return (
        <AttendeeDetail
          attendee={attendee}
          profile={args.profiles.find((item) => item.userId === attendee.id) ?? null}
          token={args.tokens.find((token) => token.botId === attendee.id)}
          received={receivedTokensFor(args.exchanges, attendee.id, attendee.squadId)}
          presence={args.presence.find((record) => record.userId === attendee.id)}
          actor={args.actor}
          now={args.now}
          event={args.event}
          exchanges={args.exchanges}
          attendees={args.attendees}
          canInvite={canInviteToSquad(args.actor, args.event)}
          canPropose={Boolean(args.actor.userId && canProposeExchange(args.actor, args.actor.userId))}
          canKick={canKickAttendee(args.actor, args.event, attendee.id)}
          onInvite={() => args.onInvite(attendee.id)}
          onPropose={() => args.onPropose({ toBotId: attendee.id })}
          onKick={() => args.onKick(attendee.id)}
          onApprove={args.onApprove}
          onReject={args.onReject}
        />
      );
    }
    case "squad": {
      const squad = args.squads.find((item) => item.id === selection.squadId);
      if (!squad) {
        return null;
      }
      return (
        <SquadDetail
          squad={squad}
          profiles={args.profiles}
          actor={args.actor}
          event={args.event}
          exchanges={args.exchanges}
          attendees={args.attendees}
          onSelectAttendee={args.onSelectAttendee}
          onRequest={() => args.onRequest(squad.id)}
          onLeave={() => args.onLeave(squad.id)}
          onRemoveMember={(attendeeId) => args.onRemoveFromSquad(squad.id, attendeeId)}
          onPropose={() => args.onPropose({ toSquadId: squad.id })}
          onApprove={args.onApprove}
          onReject={args.onReject}
        />
      );
    }
    case "none":
      return <p className="p-3 text-[12px] text-white/40">Pick a bot or a squad.</p>;
    default:
      return assertNever(selection, "selection");
  }
}

function DetailHeader({
  attendee,
  isYou,
  token,
  presence,
  now,
}: {
  attendee: Attendee;
  isYou?: boolean;
  token?: LobbyToken | undefined;
  presence: PresenceRecord | undefined;
  now: number;
}) {
  const state = presence ? presenceState(presence, now) : "offline";
  const animated = isBotWorking(presence, token, now);

  return (
    <div className="flex items-center gap-2.5 border-b border-[#262626] px-3 py-3">
      <GrokBot attendee={attendee} size="sm" animated={animated} />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <PresenceDot state={state} />
        <p className="truncate text-[13px] text-white/90">{attendee.name}</p>
      </div>
      {isYou ? <span className="micro shrink-0 text-white/40">You</span> : null}
    </div>
  );
}

function StatusStrip({
  token,
  received,
  presence,
  now,
}: {
  token: LobbyToken | undefined;
  received: LobbyToken[];
  presence: PresenceRecord | undefined;
  now: number;
}) {
  const state = presence ? presenceState(presence, now) : "offline";
  const showStatus = Boolean(token && token.shareLevel !== "label");
  const lines = [
    presenceCopy(state),
    token ? token.taskLabel : null,
    showStatus && token ? tokenStatusCopy(token.status) : null,
    token?.focus ? token.focus : null,
    received[0] ? `in: ${received[0].taskLabel}` : null,
  ].filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[#262626] px-3 py-2">
      {lines.map((line) => (
        <p key={line} className="text-[11px] text-white/45">{line}</p>
      ))}
    </div>
  );
}

function YouDetail({
  attendee,
  profile,
  token,
  received,
  presence,
  actor,
  now,
  event,
  exchanges,
  attendees,
  shareTokens,
  shareLevel,
  onSharePrefs,
  onEdit,
  onApprove,
  onReject,
}: {
  attendee: Attendee;
  profile: LumaProfile | null;
  token: LobbyToken | undefined;
  received: LobbyToken[];
  presence: PresenceRecord | undefined;
  actor: Actor;
  now: number;
  event: Event;
  exchanges: TokenExchangeRequest[];
  attendees: Attendee[];
  shareTokens: boolean;
  shareLevel: ShareLevel;
  onSharePrefs: ContextPanelProps["onSharePrefs"];
  onEdit: () => void;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col">
      <DetailHeader attendee={attendee} isYou token={token} presence={presence} now={now} />
      <StatusStrip token={token} received={received} presence={presence} now={now} />
      <ProfileBlock profile={profile} handle={attendee.lumaHandle} />
      <PastEvents profile={profile} />
      <TokenExchanges
        exchanges={exchanges}
        attendees={attendees}
        actor={actor}
        event={event}
        onApprove={onApprove}
        onReject={onReject}
      />
      <div className="mt-auto shrink-0">
        {canEditOwnBot(actor, attendee.id) ? (
          <div className="flex justify-end px-3 pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-white/70"
              onClick={onEdit}
            >
              Edit
            </Button>
          </div>
        ) : null}
        {canEditOwnBot(actor, attendee.id) ? (
          <TokenShareToggle
            shareTokens={shareTokens}
            shareLevel={shareLevel}
            lastSyncedLabel={token?.taskLabel ?? attendee.botTaskLabel}
            onUpdate={onSharePrefs}
          />
        ) : null}
      </div>
    </div>
  );
}

function AttendeeDetail({
  attendee,
  profile,
  token,
  received,
  presence,
  actor,
  now,
  event,
  exchanges,
  attendees,
  canInvite,
  canPropose,
  canKick,
  onInvite,
  onPropose,
  onKick,
  onApprove,
  onReject,
}: {
  attendee: Attendee;
  profile: LumaProfile | null;
  token: LobbyToken | undefined;
  received: LobbyToken[];
  presence: PresenceRecord | undefined;
  actor: Actor;
  now: number;
  event: Event;
  exchanges: TokenExchangeRequest[];
  attendees: Attendee[];
  canInvite: boolean;
  canPropose: boolean;
  canKick: boolean;
  onInvite: () => Promise<void>;
  onPropose: () => void;
  onKick: () => Promise<void>;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col">
      <DetailHeader attendee={attendee} token={token} presence={presence} now={now} />
      <StatusStrip token={token} received={received} presence={presence} now={now} />
      <ProfileBlock profile={profile} handle={attendee.lumaHandle} />
      <PastEvents profile={profile} />
      <TokenExchanges
        exchanges={exchanges.filter(
          (item) => item.toBotId === attendee.id || item.fromBotId === attendee.id,
        )}
        attendees={attendees}
        actor={actor}
        event={event}
        onApprove={onApprove}
        onReject={onReject}
      />
      <div className="mt-auto space-y-2 border-t border-[#262626] p-3">
        {canPropose ? (
          <Button type="button" variant="outline" className="w-full border-[#262626]" onClick={onPropose}>
            Propose token
          </Button>
        ) : null}
        {canInvite ? (
          <Button
            type="button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => void onInvite()}
          >
            Invite to party
          </Button>
        ) : null}
        {canKick ? (
          <ConfirmAction
            label="Kick from lobby"
            confirmLabel="Confirm kick"
            variant="destructive"
            className="w-full"
            onConfirm={onKick}
          />
        ) : null}
      </div>
    </div>
  );
}

function SquadDetail({
  squad,
  profiles,
  actor,
  event,
  exchanges,
  attendees,
  onSelectAttendee,
  onRequest,
  onLeave,
  onRemoveMember,
  onPropose,
  onApprove,
  onReject,
}: {
  squad: Squad;
  profiles: LumaProfile[];
  actor: Actor;
  event: Event;
  exchanges: TokenExchangeRequest[];
  attendees: Attendee[];
  onSelectAttendee: (id: string) => void;
  onRequest: () => Promise<void>;
  onLeave: () => Promise<void>;
  onRemoveMember: (attendeeId: string) => Promise<void>;
  onPropose: () => void;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}) {
  const bios = profiles.filter((profile) => squad.members.some((member) => member.id === profile.userId));
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3">
        <p className="micro text-white/40">Aggregate profiles</p>
        <div className="mt-2 space-y-2">
          {bios.length === 0 ? (
            <p className="text-[12px] text-white/40">No Luma profiles on this squad yet.</p>
          ) : (
            bios.map((profile) => (
              <p key={profile.userId} className="text-[12px] text-white/65">
                {profile.bio}
              </p>
            ))
          )}
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="micro text-white/40">Past events</p>
        <ul className="mt-2 space-y-1">
          {bios.flatMap((profile) =>
            profile.pastEvents.map((item) => (
              <li key={`${profile.userId}:${item.id}`} className="text-[12px] text-white/60">
                {item.name}
              </li>
            )),
          )}
        </ul>
      </div>
      <div className="px-3 py-2">
        <p className="micro text-white/40">Members</p>
        <ul className="mt-2">
          {squad.members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-[#161616]">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onSelectAttendee(member.id)}
              >
                <GrokBot attendee={member} size="sm" />
                <span className="flex-1 text-[12px] text-white/80">{member.name}</span>
                <ChevronRight className="size-3.5 text-white/30" strokeWidth={1.5} />
              </button>
              {canRemoveFromSquad(actor, squad, member.id) ? (
                <button
                  type="button"
                  className="text-[10px] text-white/35 hover:text-red-300"
                  onClick={() => void onRemoveMember(member.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <TokenExchanges
        exchanges={exchanges.filter((item) => item.toSquadId === squad.id)}
        attendees={attendees}
        actor={actor}
        event={event}
        onApprove={onApprove}
        onReject={onReject}
      />
      <div className="mt-auto space-y-2 border-t border-[#262626] p-3">
        {actor.userId && canProposeExchange(actor, actor.userId) ? (
          <Button type="button" variant="outline" className="w-full border-[#262626]" onClick={onPropose}>
            Propose token to squad
          </Button>
        ) : null}
        {canRequestJoin(actor, squad) ? (
          <Button
            type="button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => void onRequest()}
          >
            Request to join
          </Button>
        ) : null}
        {canLeaveSquad(actor, squad) ? (
          <ConfirmAction
            label="Leave group"
            confirmLabel="Confirm leave"
            className="w-full border-[#262626]"
            onConfirm={onLeave}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProfileBlock({ profile, handle }: { profile: LumaProfile | null; handle?: string }) {
  return (
    <div className="px-3 py-3">
      <p className="micro text-white/40">Profile</p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/65">
        {profile?.bio ?? profile?.githubBio ?? "No public profile cached yet."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/40">
        {handle || profile?.lumaHandle ? <span>luma/@{handle ?? profile?.lumaHandle}</span> : null}
        {profile?.githubHandle ? <span>gh/{profile.githubHandle}</span> : null}
        {profile?.originHandle ? <span>origin/{profile.originHandle}</span> : null}
        {profile?.twitter ? <span>x/{profile.twitter}</span> : null}
        {profile?.linkedin ? <span>in/{profile.linkedin}</span> : null}
      </div>
    </div>
  );
}

function PastEvents({ profile }: { profile: LumaProfile | null }) {
  return (
    <div className="px-3 py-2">
      <p className="micro text-white/40">Luma Past Event</p>
      <ul className="mt-2 space-y-1">
        {(profile?.pastEvents ?? []).length === 0 ? (
          <li className="text-[12px] text-white/40">No past Luma events mocked.</li>
        ) : (
          profile?.pastEvents.map((item) => (
            <li key={item.id} className="text-[12px] text-white/60">
              {item.name}
              {item.city ? <span className="text-white/35"> · {item.city}</span> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function PanelExpand({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-3 right-3 grid size-7 place-items-center rounded-md border border-[#262626] bg-[#161616] text-white/50 hover:text-white/80",
      )}
      aria-label="Open panel"
    >
      <PanelRightClose className="size-3.5 rotate-180" strokeWidth={1.5} />
    </button>
  );
}
