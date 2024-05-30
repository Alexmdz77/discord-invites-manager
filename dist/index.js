"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteManager = void 0;
const events_1 = require("events");
const quick_db_1 = require("quick.db");
const discord_js_1 = require("discord.js");
const types_1 = require("./types");
const DefaultInvitesNumber = {
    regular: 0,
    bonus: 0,
    fake: 0,
    leave: 0,
    total: 0,
};
const DefaultInvites = {
    regular: [],
    bonus: 0,
    fake: [],
    leave: [],
};
const db = new quick_db_1.QuickDB({ filePath: 'invites.sqlite' });
class InviteManager extends events_1.EventEmitter {
    constructor(client, options) {
        super();
        this.globalInvites = new discord_js_1.Collection();
        this.vanityInvites = 0;
        this.prefix = 'invitemanager_';
        this.fakeDays = 7;
        if (!client)
            throw new Error('Pass the client in options.');
        this.client = client;
        // set options
        this.prefix = (options === null || options === void 0 ? void 0 : options.prefix) || this.prefix;
        this.fakeDays = (options === null || options === void 0 ? void 0 : options.fakeDays) || this.fakeDays;
        // on ready event fetch invites
        this.client.on('ready', async () => {
            for (const [guildId, guild] of this.client.guilds.cache) { // Access the 'id' property of the 'Guild' object
                // fetch invites and set to globalInvites
                this.globalInvites.set(guildId, await this.fetchInvites(guild));
                // fetch vanity invites and set to vanityInvites
                this.vanityInvites = await guild.fetchVanityData() ? (await guild.fetchVanityData()).uses : 0;
            }
        });
        this.client.on('guildMemberAdd', (member) => this.handleGuildMemberAdd(member));
        this.client.on('guildMemberRemove', (member) => this.handleGuildMemberRemove(member));
    }
    // compare invites 
    async compareInvites(before, after) {
        for (const inviter in after) {
            if (after.get(inviter) - before.get(inviter) === 1) {
                return this.client.users.fetch(inviter);
            }
        }
        return undefined;
    }
    // handle guildMemberAdd event
    async handleGuildMemberAdd(member) {
        if (member.partial)
            return;
        // get guild
        const guild = member.guild;
        let newMember = member;
        const invitesBefore = this.globalInvites.get(guild.id) || new discord_js_1.Collection();
        const invitesAfter = await this.fetchInvites(guild);
        // compare invitesBefore and invitesAfter and return inviter id
        const inviter = await this.compareInvites(invitesBefore, invitesAfter);
        newMember.invites = DefaultInvitesNumber;
        newMember.invitesUsers = DefaultInvites;
        newMember.invitedBy = 'unknown';
        if (inviter) {
            // add invite to the user
            newMember = await this.addInvite(newMember, inviter);
        }
        else { // if invite not found, check vanity invite
            const vanityInviteBefore = this.vanityInvites;
            const vanityInviteAfter = await guild.fetchVanityData() ? (await guild.fetchVanityData()).uses : 0;
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
    async handleGuildMemberRemove(member) {
        if (member.partial)
            return;
        let newMember = member;
        // get invites and invitesUsers
        newMember.invites = await this.getInvites(newMember);
        newMember.invitesUsers = await this.getInvitesUsers(newMember);
        // remove leave invite from the user
        newMember = await this.removeInvite(newMember);
        this.emit('guildMemberRemove', newMember);
    }
    // fetch invites
    async fetchInvites(guild) {
        // fetch invites*
        const invites = await guild.invites.fetch();
        let guildInviteCount = {};
        // foreach invites add author id and uses to guildInviteCount
        invites.forEach((invite) => {
            const { inviter, uses } = invite;
            if (inviter)
                guildInviteCount.set(inviter.id, (guildInviteCount.get(inviter.id) || 0) + (uses || 0));
        });
        return guildInviteCount;
    }
    // get invites
    async getInvites(member) {
        // get invites
        const invites = await db.get(`${this.prefix}invites_${member.guild.id}_${member.id}`);
        // if not found, return default invites number
        if (!invites) {
            const defaultInvites = DefaultInvites;
            await this.setInvites(member, defaultInvites);
            return DefaultInvitesNumber;
        }
        // set invites number and return
        const invitesNumber = {
            regular: invites.regular.length,
            bonus: invites.bonus,
            fake: invites.fake.length,
            leave: invites.leave.length,
            total: invites.regular.length + invites.bonus - invites.fake.length - invites.leave.length,
        };
        return invitesNumber;
    }
    // get invites users
    async getInvitesUsers(member) {
        // get invites users
        const invitesUsers = await db.get(`${this.prefix}invites_${member.guild.id}_${member.id}`);
        // if not found, return default invites
        if (!invitesUsers) {
            const defaultInvites = DefaultInvites;
            await this.setInvites(member, defaultInvites);
            return defaultInvites;
        }
        return invitesUsers;
    }
    async setInvites(member, invitesUsers) {
        return db.set(`${this.prefix}invites_${member.guild.id}_${member.id}`, invitesUsers);
    }
    async getInvitedBy(member) {
        const data = await db.get(`${this.prefix}invitedBy_${member.guild.id}_${member.id}`);
        if (data) {
            if (data === 'vanity')
                return 'vanity';
            if (data === 'unknown')
                return 'unknown';
            const user = this.client.users.cache.get(data.id);
            return user || 'unknown';
        }
        return 'unknown';
    }
    async setInvitedBy(member, inviter) {
        return db.set(`${this.prefix}invitedBy_${member.guild.id}_${member.id}`, inviter);
    }
    async addInvites(member, invitesUsers) {
        const old_invitesUsers = await this.getInvitesUsers(member) || DefaultInvites;
        const new_invitesUsers = {
            regular: [...old_invitesUsers.regular, ...invitesUsers.regular],
            bonus: old_invitesUsers.bonus + invitesUsers.bonus,
            fake: [...old_invitesUsers.fake, ...invitesUsers.fake],
            leave: [...old_invitesUsers.leave, ...invitesUsers.leave],
        };
        return this.setInvites(member, new_invitesUsers);
    }
    // edit user invites type (regular, bonus, fake, leave)
    async editInvitesUsers(member, invite, type, action) {
        // get invites users
        const invitesUsers = await this.getInvitesUsers(member) || DefaultInvites;
        switch (action) {
            case 'add':
                // check if is a bonus invite
                if (type === types_1.InviteType.bonus) {
                    // add to bonus
                    invitesUsers[type] += 1;
                    break;
                }
                else {
                    // add to type
                    invitesUsers[type].push(invite);
                    break;
                }
            case 'remove':
                // check if is a bonus invite
                if (type === types_1.InviteType.bonus) {
                    // remove from bonus
                    invitesUsers[type] -= 1;
                    break;
                }
                else {
                    // remove from type
                    const index = invitesUsers[type].indexOf(invite);
                    if (index === -1)
                        return invitesUsers;
                    invitesUsers[type].splice(index, 1);
                    break;
                }
            case 'move':
                if (type === types_1.InviteType.bonus)
                    return invitesUsers;
                // remove from other types
                for (const key in invitesUsers) {
                    if (key === type)
                        continue;
                    const invites = invitesUsers[key];
                    if (Array.isArray(invites)) {
                        const index = invites.indexOf(invite);
                        if (index === -1)
                            continue;
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
    async addInvite(member, inviter) {
        // get invites users
        const invitesUsers = await this.getInvitesUsers(member) || DefaultInvites;
        const newMember = member;
        // set invitedBy
        newMember.invitedBy = inviter === 'vanity' ? 'vanity' : inviter;
        // save
        await this.setInvitedBy(newMember, inviter);
        // check if invite is vanity invite
        if (inviter === 'vanity') {
            // save
            await this.setInvites(newMember, invitesUsers);
        }
        else { // if not
            // move invite to regular invites
            await this.editInvitesUsers(newMember, inviter.id, types_1.InviteType.regular, 'move');
        }
        return newMember;
    }
    async removeInvite(member) {
        const newMember = member;
        // get invitedBy
        const inviter = await this.getInvitedBy(newMember);
        // check if invite is vanity invite
        if (inviter != 'vanity' && inviter != 'unknown') {
            await this.editInvitesUsers(newMember, inviter.id, types_1.InviteType.leave, 'move');
        }
        return newMember;
    }
    async clearInvites(member) {
        const newMember = member;
        // get invitedBy
        const inviter = await this.getInvitedBy(newMember);
        // check if invite is vanity invite
        if (inviter != 'vanity' && inviter != 'unknown') {
            await this.editInvitesUsers(newMember, inviter.id, types_1.InviteType.regular, 'remove');
            await this.editInvitesUsers(newMember, inviter.id, types_1.InviteType.bonus, 'remove');
            await this.editInvitesUsers(newMember, inviter.id, types_1.InviteType.fake, 'remove');
            await this.editInvitesUsers(newMember, inviter.id, types_1.InviteType.leave, 'remove');
        }
        return newMember;
    }
    async addBonusInvite(member, number) {
        return this.addInvites(member, { bonus: number });
    }
    async removeBonusInvite(member, number) {
        return this.addInvites(member, { bonus: -number });
    }
}
exports.InviteManager = InviteManager;
//# sourceMappingURL=index.js.map