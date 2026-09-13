import { assertNever, type Actor, type Event, type SquadInvite } from "@/lib/domain";

export function incomingInvitesFor(invites: SquadInvite[], actor: Actor, event: Event): SquadInvite[] {
  return invites.filter((invite) => {
    if (invite.status !== "pending" || !actor.userId) {
      return false;
    }
    switch (invite.direction) {
      case "invite":
        return actor.userId === invite.toBotId;
      case "request": {
        const squad = event.squads.find((item) => item.id === invite.squadId);
        return actor.userId === invite.toBotId || squad?.organizerId === actor.userId;
      }
      default:
        return assertNever(invite.direction, "squad invite direction");
    }
  });
}

export function outgoingInvitesFor(invites: SquadInvite[], actor: Actor): SquadInvite[] {
  return invites.filter(
    (invite) =>
      invite.status === "pending" &&
      invite.direction === "invite" &&
      actor.userId !== null &&
      invite.fromBotId === actor.userId &&
      invite.toBotId !== actor.userId,
  );
}
