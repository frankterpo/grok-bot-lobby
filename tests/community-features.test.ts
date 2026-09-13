import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Actor, Attendee, PresenceRecord, PresenceView } from "@/lib/domain";
import { HOST_USER_ID, presenceState, STALE_AFTER_MS } from "@/lib/domain";
import { filterSoloAttendees, sortSoloAttendees } from "@/lib/grid-sort";
import { LobbyMemory } from "@/lib/lobby-store";
import { canKickAttendee, canRespondSquadInvite } from "@/lib/policy";
import {
  isFreshCacheEntry,
  mergeLumaProfiles,
  parseLumaBrowserCache,
  writeLumaBrowserCache,
} from "@/lib/profile-browser-cache";
import { parseGrokPrompt } from "@/lib/prompt-to-token";

const host: Actor = {
  slot: "you",
  userId: HOST_USER_ID,
  role: "host",
  hostAuthenticated: true,
};

function attendeeActor(userId: string): Actor {
  return { slot: "attendee", userId, role: "attendee", hostAuthenticated: false };
}

async function twoGuests(lobby: LobbyMemory, code: string) {
  const alice = await lobby.claim(
    { slot: "attendee", userId: null, role: "guest" },
    {
      eventCode: code,
      name: "Alice",
      botColor: "#22d3ee",
      shareLevel: "label+status",
      hasGrokBot: true,
      acceptPermissions: true,
    },
    "http://127.0.0.1:4521",
  );
  const bob = await lobby.claim(
    { slot: "attendee", userId: null, role: "guest" },
    {
      eventCode: code,
      name: "Bob",
      botColor: "#facc15",
      shareLevel: "label+status",
      hasGrokBot: true,
      acceptPermissions: true,
    },
    "http://127.0.0.1:4521",
  );
  return { alice, bob };
}

describe("parseGrokPrompt", () => {
  it("maps working language to the working animation status", () => {
    const intent = parseGrokPrompt("I'm working on the deck");
    assert.equal(intent.status, "working");
    assert.match(intent.taskLabel.toLowerCase(), /deck/);
  });

  it("maps done / waiting / idle phrases", () => {
    assert.equal(parseGrokPrompt("done with credits").status, "done");
    assert.equal(parseGrokPrompt("waiting for venue").status, "waiting");
    assert.equal(parseGrokPrompt("idle").status, "idle");
  });
});

describe("presence dot states", () => {
  const now = Date.parse("2026-09-13T12:00:00.000Z");

  function record(overrides: Partial<PresenceRecord>): PresenceRecord {
    return {
      userId: "bot_1",
      eventId: "e1",
      lastHeartbeat: new Date(now).toISOString(),
      claimed: true,
      ...overrides,
    };
  }

  it("maps claimed+recent heartbeat to active (green dot)", () => {
    assert.equal(presenceState(record({}), now), "active");
  });

  it("maps unclaimed or missing heartbeat to offline", () => {
    assert.equal(presenceState(record({ claimed: false }), now), "offline");
    assert.equal(presenceState(record({ lastHeartbeat: null }), now), "offline");
  });

  it("maps expired heartbeat to stale", () => {
    const staleAt = new Date(now - STALE_AFTER_MS - 1).toISOString();
    assert.equal(presenceState(record({ lastHeartbeat: staleAt }), now), "stale");
  });
});

describe("own bot first + presence rank", () => {
  it("puts the current user first, then live bots", () => {
    const attendees: Attendee[] = [
      {
        id: "demo_z",
        name: "Zed",
        eventId: "e1",
        rsvpStatus: "going",
        isCurrentUser: false,
      },
      {
        id: "user_me",
        name: "Me",
        eventId: "e1",
        rsvpStatus: "going",
        isCurrentUser: true,
      },
      {
        id: "user_live",
        name: "Live",
        eventId: "e1",
        rsvpStatus: "going",
        isCurrentUser: false,
      },
    ];
    const presence: PresenceView[] = [
      { userId: "user_me", eventId: "e1", lastHeartbeat: new Date().toISOString(), claimed: true, state: "active" },
      { userId: "user_live", eventId: "e1", lastHeartbeat: new Date().toISOString(), claimed: true, state: "active" },
      { userId: "demo_z", eventId: "e1", lastHeartbeat: null, claimed: false, state: "offline" },
    ];
    const sorted = sortSoloAttendees(
      filterSoloAttendees(attendees, presence, HOST_USER_ID),
      "user_me",
      presence,
      HOST_USER_ID,
    );
    assert.equal(sorted[0]?.id, "user_me");
    assert.equal(sorted[1]?.id, "user_live");
  });
});

describe("luma browser cache", () => {
  it("drops stale entries and prefers live profiles", () => {
    const now = Date.now();
    const stale = {
      userId: "old",
      bio: "stale",
      pastEvents: [],
    };
    const fresh = {
      userId: "old",
      bio: "fresh",
      pastEvents: [],
    };
    const raw = writeLumaBrowserCache([stale], now - 20 * 60 * 1000);
    assert.deepEqual(parseLumaBrowserCache(raw, now), []);
    assert.equal(isFreshCacheEntry({ profile: stale, fetchedAt: now }, now), true);
    assert.equal(mergeLumaProfiles([fresh], [stale])[0]?.bio, "fresh");
  });
});

describe("lobby community store", () => {
  it("sends a pending party invite and joins only after accept", async () => {
    const lobby = new LobbyMemory({ seed: false });
    const created = lobby.createEvent(host, "Community night", "2026-09-13", "http://127.0.0.1:4521");
    const { alice, bob } = await twoGuests(lobby, created.event.eventCode);
    const invited = lobby.invite(attendeeActor(alice.userId), created.event.id, bob.userId);
    assert.equal(invited.event?.attendees.find((person) => person.id === bob.userId)?.squadId, undefined);
    const pending = invited.squadInvites.filter((item) => item.status === "pending");
    assert.equal(pending.length, 1);
    assert.equal(canRespondSquadInvite(attendeeActor(bob.userId), pending[0]!, created.event), true);
    const accepted = lobby.respondInvite(attendeeActor(bob.userId), created.event.id, pending[0]!.id, "accepted");
    assert.ok(accepted.event?.attendees.find((person) => person.id === bob.userId)?.squadId);
  });

  it("lets a member leave the group", async () => {
    const lobby = new LobbyMemory({ seed: false });
    const created = lobby.createEvent(host, "Leave test", "2026-09-13", "http://127.0.0.1:4521");
    const { alice, bob } = await twoGuests(lobby, created.event.eventCode);
    const invited = lobby.invite(attendeeActor(alice.userId), created.event.id, bob.userId);
    const invite = invited.squadInvites[0]!;
    lobby.respondInvite(attendeeActor(bob.userId), created.event.id, invite.id, "accepted");
    const left = lobby.leaveSquad(attendeeActor(bob.userId), created.event.id, invite.squadId);
    assert.equal(left.event?.attendees.find((person) => person.id === bob.userId)?.squadId, undefined);
  });

  it("lets the host kick an attendee", async () => {
    const lobby = new LobbyMemory({ seed: false });
    const created = lobby.createEvent(host, "Kick test", "2026-09-13", "http://127.0.0.1:4521");
    const { alice } = await twoGuests(lobby, created.event.eventCode);
    const live = lobby.snapshot({ eventId: created.event.id, actor: host, origin: "" });
    assert.equal(canKickAttendee(host, live.event!, alice.userId), true);
    const after = lobby.kickAttendee(host, created.event.id, alice.userId);
    assert.equal(after.event?.attendees.some((person) => person.id === alice.userId), false);
  });

  it("turns a grok prompt into a working token for lobby animation", async () => {
    const lobby = new LobbyMemory({ seed: false });
    const created = lobby.createEvent(host, "Prompt test", "2026-09-13", "http://127.0.0.1:4521");
    const { alice } = await twoGuests(lobby, created.event.eventCode);
    const snap = lobby.applyPrompt(attendeeActor(alice.userId), {
      eventId: created.event.id,
      botId: alice.userId,
      prompt: "I'm working on sidecar E2E",
    });
    const token = snap.tokens.find((item) => item.botId === alice.userId);
    assert.equal(token?.status, "working");
    assert.match(token?.taskLabel ?? "", /sidecar/i);
  });

  it("proposes a token to a squad after the party exists", async () => {
    const lobby = new LobbyMemory({ seed: false });
    const created = lobby.createEvent(host, "Propose test", "2026-09-13", "http://127.0.0.1:4521");
    const { alice, bob } = await twoGuests(lobby, created.event.eventCode);
    lobby.sync(attendeeActor(alice.userId), {
      eventId: created.event.id,
      botId: alice.userId,
      taskLabel: "Venue walkthrough",
      status: "working",
    });
    const invited = lobby.invite(attendeeActor(alice.userId), created.event.id, bob.userId);
    const invite = invited.squadInvites[0]!;
    lobby.respondInvite(attendeeActor(bob.userId), created.event.id, invite.id, "accepted");
    const proposed = lobby.proposeExchange(attendeeActor(alice.userId), {
      eventId: created.event.id,
      fromBotId: alice.userId,
      toSquadId: invite.squadId,
    });
    assert.equal(proposed.exchanges.some((item) => item.toSquadId === invite.squadId && item.status === "pending"), true);
  });
});
