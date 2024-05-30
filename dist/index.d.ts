/// <reference types="node" />
import { EventEmitter } from 'events';
import { Client, Collection, GuildMember, User } from 'discord.js';
import { IInvites, InviteType, IInvitesNumber, ExtendedGuildMember, inviterType } from './types';
export declare class InviteManager extends EventEmitter {
    client: Client<boolean>;
    globalInvites: Collection<string, Collection<string, number>>;
    vanityInvites: number;
    prefix: string;
    fakeDays: number;
    constructor(client: Client, options?: {
        prefix?: string;
        fakeDays?: number;
    });
    private compareInvites;
    private handleGuildMemberAdd;
    private handleGuildMemberRemove;
    private fetchInvites;
    protected getInvites(member: GuildMember): Promise<IInvitesNumber>;
    protected getInvitesUsers(member: GuildMember): Promise<IInvites>;
    protected setInvites(member: GuildMember, invitesUsers: IInvites): Promise<IInvites>;
    protected getInvitedBy(member: ExtendedGuildMember): Promise<inviterType>;
    protected setInvitedBy(member: ExtendedGuildMember, inviter: inviterType): Promise<inviterType>;
    protected addInvites(member: GuildMember, invitesUsers: IInvites): Promise<IInvites>;
    protected editInvitesUsers(member: GuildMember, invite: string, type: InviteType, action: 'add' | 'remove' | 'move'): Promise<IInvites>;
    protected addInvite(member: GuildMember, inviter: User | 'vanity'): Promise<ExtendedGuildMember>;
    protected removeInvite(member: GuildMember): Promise<ExtendedGuildMember>;
    protected clearInvites(member: GuildMember): Promise<ExtendedGuildMember>;
    addBonusInvite(member: GuildMember, number: number): Promise<IInvites>;
    removeBonusInvite(member: GuildMember, number: number): Promise<IInvites>;
}
