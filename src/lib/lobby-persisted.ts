import type {
  LobbyToken,
  LumaProfile,
  PresenceRecord,
  SquadInvite,
  TokenExchangeRequest,
} from "@/lib/domain";
import type { StoredEvent, UserPrefs } from "@/lib/seed";

/** Serializable lobby state for Durable Object storage. */
export type PersistedLobbyState = {
  version: 1;
  events: StoredEvent[];
  tokens: Array<[string, LobbyToken]>;
  profiles: Array<[string, LumaProfile]>;
  presence: Array<[string, PresenceRecord]>;
  prefs: Array<[string, UserPrefs]>;
  claimed: Array<[string, string[]]>;
  shareCopied: string[];
  exchanges: Array<[string, TokenExchangeRequest]>;
  squadInvites?: Array<[string, SquadInvite]>;
};

export function emptyPersistedState(): PersistedLobbyState {
  return {
    version: 1,
    events: [],
    tokens: [],
    profiles: [],
    presence: [],
    prefs: [],
    claimed: [],
    shareCopied: [],
    exchanges: [],
    squadInvites: [],
  };
}
