import {
  BOT_COLORS,
  HOST_USER_ID,
  SEED_EVENT_CODE,
  SEED_EVENT_ID,
  type Attendee,
  type Event,
  type LumaProfile,
  type LobbyToken,
  type PresenceRecord,
  type RsvpStatus,
  type Squad,
} from "@/lib/domain";

export type StoredEvent = Event & { hostUserId: string };

export type UserPrefs = {
  permissionsAccepted: boolean;
  shareLevel: LobbyToken["shareLevel"];
  shareTokens: boolean;
  hasGrokBot: boolean;
};

export type SeedBundle = {
  events: StoredEvent[];
  tokens: LobbyToken[];
  profiles: LumaProfile[];
  presence: PresenceRecord[];
  prefs: Array<[string, UserPrefs]>;
  claimed: Array<[string, string[]]>;
  shareCopied: string[];
};

function attendee(args: {
  id: string;
  name: string;
  color: string;
  squadId?: string;
  handle?: string;
  photo?: string;
  task?: string;
  luma?: string;
}): Attendee {
  return {
    id: args.id,
    name: args.name,
    botColor: args.color,
    botAvatarUrl: args.photo,
    lumaHandle: args.handle,
    lumaProfileUrl: args.luma,
    botTaskLabel: args.task,
    eventId: SEED_EVENT_ID,
    rsvpStatus: "going" satisfies RsvpStatus,
    squadId: args.squadId,
    isCurrentUser: false,
  };
}

function profile(
  userId: string,
  bio: string,
  past: LumaProfile["pastEvents"],
  links?: { twitter?: string; linkedin?: string },
): LumaProfile {
  return {
    userId,
    bio,
    twitter: links?.twitter,
    linkedin: links?.linkedin,
    pastEvents: past,
  };
}

const PAST = {
  coloop: {
    id: "luma_coloop_3",
    name: "CoLoop #3",
    date: "2026-08-15T17:00:00.000Z",
    city: "London",
  },
  agents: {
    id: "luma_agents",
    name: "AI Agents Night",
    date: "2026-07-22T18:30:00.000Z",
    city: "London",
  },
  cursor: {
    id: "luma_cursor",
    name: "Cursor Meetup",
    date: "2026-06-04T18:00:00.000Z",
    city: "SF",
  },
} as const;

export function buildSeed(): SeedBundle {
  const date = "2026-09-12T17:00:00.000Z";
  const coral = BOT_COLORS.coral;
  const squad1 = "squad_1";
  const squad2 = "squad_2";

  const solo: Attendee[] = [
    attendee({
      id: HOST_USER_ID,
      name: "Francisco",
      color: coral,
      handle: "francisco",
      task: "Hosting CoLoop",
      luma: "https://lu.ma/u/francisco",
    }),
  ];

  const group1: Attendee[] = [
    attendee({
      id: "demo_nico",
      name: "Nico",
      color: BOT_COLORS.cyan,
      squadId: squad1,
      handle: "nico",
    }),
    attendee({ id: "demo_bea", name: "Bea", color: coral, squadId: squad1 }),
    attendee({
      id: "demo_theo",
      name: "Theo",
      color: BOT_COLORS.yellow,
      squadId: squad1,
    }),
    attendee({
      id: "demo_mina",
      name: "Mina",
      color: BOT_COLORS.orange,
      squadId: squad1,
    }),
  ];

  const group2: Attendee[] = [
    attendee({
      id: "demo_cass",
      name: "Cass",
      color: BOT_COLORS.yellow,
      squadId: squad2,
      handle: "cass",
    }),
    attendee({
      id: "demo_drew",
      name: "Drew",
      color: BOT_COLORS.cyan,
      squadId: squad2,
    }),
    attendee({
      id: "demo_elena",
      name: "Elena",
      color: BOT_COLORS.orange,
      squadId: squad2,
    }),
    attendee({
      id: "demo_farah",
      name: "Farah",
      color: coral,
      squadId: squad2,
    }),
  ];

  const attendees = [...solo, ...group1, ...group2];

  const squads: Squad[] = [
    {
      id: squad1,
      eventId: SEED_EVENT_ID,
      name: "Group 1",
      organizerId: "demo_nico",
      members: group1,
      isOpen: true,
    },
    {
      id: squad2,
      eventId: SEED_EVENT_ID,
      name: "Group 2",
      organizerId: "demo_cass",
      members: group2,
      isOpen: true,
    },
  ];

  const event: StoredEvent = {
    id: SEED_EVENT_ID,
    name: "CoLoop Cowork",
    date,
    lumaEventId: "luma_coloop_cowork",
    attendees,
    squads,
    eventCode: SEED_EVENT_CODE,
    hostUserId: HOST_USER_ID,
  };

  const now = new Date().toISOString();
  const tokens: LobbyToken[] = [
    {
      botId: HOST_USER_ID,
      eventId: SEED_EVENT_ID,
      taskLabel: "Hosting CoLoop",
      status: "idle",
      focus: "Lobby share link",
      timestamp: now,
      shareLevel: "full",
    },
  ];

  const profiles: LumaProfile[] = [
    profile(
      HOST_USER_ID,
      "Hosting CoLoop Cowork. Building the Grok Bot lobby so teammates can see what each bot is on.",
      [PAST.coloop, PAST.agents, PAST.cursor],
      { twitter: "francisco", linkedin: "francisco" },
    ),
    profile("demo_nico", "Keeps Group 1 on the rails.", [PAST.agents]),
    profile("demo_cass", "Keeps Group 2 loud and on time.", [PAST.coloop]),
  ];

  const presence: PresenceRecord[] = attendees.map((person) => {
    if (person.id === HOST_USER_ID) {
      return {
        userId: person.id,
        eventId: SEED_EVENT_ID,
        lastHeartbeat: now,
        claimed: true,
      };
    }
    return {
      userId: person.id,
      eventId: SEED_EVENT_ID,
      lastHeartbeat: null,
      claimed: false,
    };
  });

  return {
    events: [event],
    tokens,
    profiles,
    presence,
    prefs: [
      [
        HOST_USER_ID,
        {
          permissionsAccepted: true,
          shareLevel: "full",
          shareTokens: true,
          hasGrokBot: true,
        },
      ],
    ],
    claimed: [[SEED_EVENT_ID, [HOST_USER_ID]]],
    shareCopied: [],
  };
}
