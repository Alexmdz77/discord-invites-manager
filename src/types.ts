import { GuildMember, User } from "discord.js";

type JoinType = 'permissions' | 'normal' | 'vanity' | 'unknown';
type inviterType = User | 'vanity' | 'unknown';

interface InvitesTracker {
    on(event: 'cacheFetched', listener: () => void): this;
    on(event: 'guildMemberAdd', listener: (member: ExtendedGuildMember, joinType: JoinType) => void): this;
    on(event: 'guildMemberRemove', listener: (member: ExtendedGuildMember) => void): this;
}

declare enum InviteType {
    regular = "regular",
    bonus = 'bonus',
    fake = 'fake',
    leave = 'leave'
}

interface IInvitesNumber {
    regular: number;
    bonus: number;
    fake: number;
    leave: number;
    total: number;
}

interface IInvites {
    regular: string[];
    bonus: number;
    fake: string[];
    leave: string[];
}

type ExtendedGuildMember = GuildMember & {
    invites: IInvitesNumber;
    invitesUsers: IInvites;
    invitedBy: 'vanity' | User | 'unknown';
}

export { InviteType, IInvites, IInvitesNumber, ExtendedGuildMember, inviterType, InvitesTracker };