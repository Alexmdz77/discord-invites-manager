import { EventEmitter } from 'events';
import { QuickDB } from 'quick.db';
import { Client, Collection, Guild, GuildMember, PartialGuildMember, User } from 'discord.js';
import { IInvites, InviteType, IInvitesNumber, ExtendedGuildMember, inviterType } from './types';

const DefaultInvitesNumber: IInvitesNumber = {
    regular: 0,
    bonus: 0,
    fake: 0,
    leave: 0,
    total: 0,
};

const DefaultInvites: IInvites = {
    regular: [],
    bonus: 0,
    fake: [],
    leave: [],
};

const db = new QuickDB({ filePath: 'invites.sqlite' });

export class InviteManager extends EventEmitter {

    client: Client<boolean>;
    globalInvites: Collection<string, Collection<string, number>> = new Collection();
    vanityInvites: number = 0;
    prefix: string = 'invitemanager_';
    fakeDays: number = 7;

    constructor(client: Client, options?: { prefix?: string, fakeDays?: number }) {
        super();
        if (!client) throw new Error('Pass the client in options.');
        this.client = client;

        // set options
        this.prefix = options?.prefix || this.prefix;
        this.fakeDays = options?.fakeDays || this.fakeDays;

        // on ready event fetch invites
        this.client.on('ready', async () => {
            for (const [guildId, guild] of this.client.guilds.cache) { // Access the 'id' property of the 'Guild' object
                // fetch invites and set to globalInvites
                this.globalInvites.set(guildId, await this.fetchInvites(guild))
                // fetch vanity invites and set to vanityInvites
                try {
                    this.vanityInvites = await guild.fetchVanityData() ? (await guild.fetchVanityData()).uses : 0;
                } catch (error) {
                    // error, the guild does not have vanity invite
                }
            }
        });

        this.client.on('guildMemberAdd', (member: GuildMember) => this.handleGuildMemberAdd(member));
        this.client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => this.handleGuildMemberRemove(member));

    }

    // compare invites 
    private async compareInvites(before: Collection<string, number>, after: Collection<string, number>): Promise<User | undefined> {
        for (const inviter in after) {
            if (after.get(inviter)! - before.get(inviter)! === 1) {
                return this.client.users.fetch(inviter);
            }
        }
        return undefined;
    }

    // handle guildMemberAdd event
    private async handleGuildMemberAdd(member: GuildMember): Promise<void> {
        if (member.partial) return;

        // get guild
        const guild = member.guild;
        let newMember = member as ExtendedGuildMember;

        const invitesBefore = this.globalInvites.get(guild.id) || new Collection<string, number>();
        const invitesAfter = await this.fetchInvites(guild);

        // compare invitesBefore and invitesAfter and return inviter id
        const inviter = await this.compareInvites(invitesBefore, invitesAfter);

        newMember.invites = DefaultInvitesNumber;
        newMember.invitesUsers = DefaultInvites;
        newMember.invitedBy = 'unknown';

        if (inviter) {
            // add invite to the user
            newMember = await this.addInvite(newMember, inviter);
            
        } else { // if invite not found, check vanity invite
            const vanityInviteBefore = this.vanityInvites;
            let vanityInviteAfter = 0;
            try {
                vanityInviteAfter = await guild.fetchVanityData() ? (await guild.fetchVanityData()).uses : 0;
            } catch (error) {
                // error, the guild does not have vanity invite
            }
            // if vanity invite uses is greater than before, set invite to vanity invite
            if (vanityInviteAfter > vanityInviteBefore) {
                // add vanity invite to the user
                newMember = await this.addInvite(newMember, 'vanity');
                // set vanityInvites to vanityInviteAfter
                this.vanityInvites = vanityInviteAfter;
            }
        }

        // set globalInvites to invitesAfter
        this.globalInvites.set(guild.id, invitesAfter);

        // get invites and invitesUsers
        newMember.invites = await this.getInvites(member);
        newMember.invitesUsers = await this.getInvitesUsers(member);

        this.emit('guildMemberAdd', newMember);
    }

    private async handleGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
        if (member.partial) return;

        let newMember = member as ExtendedGuildMember;

        // get invites and invitesUsers
        newMember.invites = await this.getInvites(newMember);
        newMember.invitesUsers = await this.getInvitesUsers(newMember);

        // remove leave invite from the user
        newMember = await this.removeInvite(newMember);

        this.emit('guildMemberRemove', newMember);
    }

    // fetch invites
    private async fetchInvites(guild: Guild): Promise<Collection<string, number>> {
        // fetch invites*
        const invites = await guild.invites.fetch()
        let guildInviteCount = new Collection<string, number>();
        // foreach invites add author id and uses to guildInviteCount
        invites.forEach((invite) => {
            const { inviter, uses } = invite;
            if(inviter) guildInviteCount.set(inviter.id, (guildInviteCount.get(inviter.id) || 0) + (uses || 0));
        });
        return guildInviteCount;
    }

    // get invites
    protected async getInvites(member: GuildMember): Promise<IInvitesNumber> {
        // get invites
        const invites = await db.get(`${this.prefix}invites_${member.guild.id}_${member.id}`) as IInvites;
        // if not found, return default invites number
        if (!invites) {
            const defaultInvites: IInvites = DefaultInvites;
            await this.setInvites(member, defaultInvites);
            return DefaultInvitesNumber;
        }
        // set invites number and return
        const invitesNumber: IInvitesNumber = {
            regular: invites.regular.length,
            bonus: invites.bonus,
            fake: invites.fake.length,
            leave: invites.leave.length,
            total: invites.regular.length + invites.bonus - invites.fake.length - invites.leave.length,
        };
        return invitesNumber;
    }

    // get invites users
    protected async getInvitesUsers(member: GuildMember): Promise<IInvites> {
        // get invites users
        const invitesUsers = await db.get(`${this.prefix}invites_${member.guild.id}_${member.id}`) as IInvites;
        // if not found, return default invites
        if (!invitesUsers) {
            const defaultInvites: IInvites = DefaultInvites;
            await this.setInvites(member, defaultInvites);
            return defaultInvites;
        }

        return invitesUsers;
    }

    protected async setInvites(member: GuildMember, invitesUsers: IInvites): Promise<IInvites> {
        return db.set(`${this.prefix}invites_${member.guild.id}_${member.id}`, invitesUsers);
    }

    protected async getInvitedBy(member: ExtendedGuildMember): Promise<inviterType> {
        const data = await db.get(`${this.prefix}invitedBy_${member.guild.id}_${member.id}`) as inviterType;
        if (data) {
            if (data === 'vanity') return 'vanity';
            if(data === 'unknown') return 'unknown';
            const user = this.client.users.cache.get(data.id);
            return user || 'unknown';
        }
        return 'unknown';
    }

    protected async setInvitedBy(member: ExtendedGuildMember, inviter: inviterType): Promise<inviterType> {
        return db.set(`${this.prefix}invitedBy_${member.guild.id}_${member.id}`, inviter);
    }

    protected async addInvites(member: GuildMember, invitesUsers: IInvites): Promise<IInvites> {
        const old_invitesUsers = await this.getInvitesUsers(member) || DefaultInvites as IInvites;
        const new_invitesUsers: IInvites = {
            regular: [...old_invitesUsers.regular, ...invitesUsers.regular],
            bonus: old_invitesUsers.bonus + invitesUsers.bonus,
            fake: [...old_invitesUsers.fake, ...invitesUsers.fake],
            leave: [...old_invitesUsers.leave, ...invitesUsers.leave],
        };
        return this.setInvites(member, new_invitesUsers);
    }

    // edit user invites type (regular, bonus, fake, leave)
    protected async editInvitesUsers(member: GuildMember, invite: string, type: InviteType, action: 'add' | 'remove' | 'move'): Promise<IInvites> {
        // get invites users
        const invitesUsers = await this.getInvitesUsers(member) || DefaultInvites as IInvites;
        
        switch (action) {
            case 'add':
                // check if is a bonus invite
                if (type === InviteType.bonus) {
                    // add to bonus
                    invitesUsers[type] += 1;
                    break;
                } else {
                    // add to type
                    invitesUsers[type].push(invite);
                    break;
                }
            case 'remove':
                // check if is a bonus invite
                if (type === InviteType.bonus) {
                    // remove from bonus
                    invitesUsers[type] -= 1;
                    break;
                } else {
                    // remove from type
                    const index = invitesUsers[type].indexOf(invite);
                    if (index === -1) return invitesUsers;
                    invitesUsers[type].splice(index, 1);
                    break;
                }
            case 'move':
                if (type === InviteType.bonus) return invitesUsers;
                // remove from other types
                for (const key in invitesUsers) {
                    if (key === type) continue;
                    const invites = invitesUsers[key as keyof IInvites];
                    if (Array.isArray(invites)) {
                        const index = invites.indexOf(invite);
                        if (index === -1) continue;
                        invites.splice(index, 1);
                    }
                }
                // add to type
                invitesUsers[type].push(invite);
                break;
            default:
                break;
        }
        // save
        return this.setInvites(member, invitesUsers);
    }

    protected async addInvite(member: GuildMember, inviter: User | 'vanity'): Promise<ExtendedGuildMember> {
        // get invites users
        const invitesUsers = await this.getInvitesUsers(member) || DefaultInvites as IInvites;

        const newMember = member as ExtendedGuildMember;
        // set invitedBy
        newMember.invitedBy = inviter === 'vanity' ? 'vanity' : inviter;
        // save
        await this.setInvitedBy(newMember, inviter);

        // check if invite is vanity invite
        if (inviter === 'vanity') {
            // save
            await this.setInvites(newMember, invitesUsers);
        } else { // if not
            // move invite to regular invites
            await this.editInvitesUsers(newMember, inviter.id, InviteType.regular, 'move');

        }

        return newMember;
    }

    protected async removeInvite(member: GuildMember): Promise<ExtendedGuildMember> {

        const newMember = member as ExtendedGuildMember;
        // get invitedBy
        const inviter = await this.getInvitedBy(newMember);

        // check if invite is vanity invite
        if (inviter != 'vanity' && inviter != 'unknown') {
            await this.editInvitesUsers(newMember, inviter.id, InviteType.leave, 'move');
        }
        
        return newMember;
    }

    protected async clearInvites(member: GuildMember): Promise<ExtendedGuildMember> {
        
        const newMember = member as ExtendedGuildMember;
        // get invitedBy
        const inviter = await this.getInvitedBy(newMember);

        // check if invite is vanity invite
        if (inviter != 'vanity' && inviter != 'unknown') {
            await this.editInvitesUsers(newMember, inviter.id, InviteType.regular, 'remove');
            await this.editInvitesUsers(newMember, inviter.id, InviteType.bonus, 'remove');
            await this.editInvitesUsers(newMember, inviter.id, InviteType.fake, 'remove');
            await this.editInvitesUsers(newMember, inviter.id, InviteType.leave, 'remove');
        }
        
        return newMember;
    }

    public async addBonusInvite(member: GuildMember, number: number): Promise<IInvites> {
        return this.addInvites(member, { bonus: number } as IInvites);
    }

    public async removeBonusInvite(member: GuildMember, number: number): Promise<IInvites> {
        return this.addInvites(member, { bonus: -number } as IInvites);
    }

}