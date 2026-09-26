// © PauzeX

const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require('discord.js');

const { NoPrefix } = require('../../data/models');
const config = require('../../config');
const ms = require('ms');

function isOwner(interactionOrMessage) {
    const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
    return userId === config.OWNER_ID;
}

async function resolveUser(interactionOrMessage, args, optionName = 'user') {
    if (interactionOrMessage.isChatInputCommand?.()) {
        return interactionOrMessage.options.getUser(optionName);
    }

    const userId = interactionOrMessage.mentions.users.first()?.id || args[0];
    if (!userId) return null;
    return interactionOrMessage.client.users.fetch(userId).catch(() => null);
}

function getDuration(interactionOrMessage, args) {
    if (interactionOrMessage.isChatInputCommand?.()) {
        return interactionOrMessage.options.getString('duration') || 'permanent';
    }
    return args[1] || 'permanent';
}

async function getActiveRecord(userId) {
    const record = await NoPrefix.findOne({ where: { userId } });
    if (!record) return null;

    if (record.expiresAt && new Date() > new Date(record.expiresAt)) {
        await record.destroy();
        NoPrefix.invalidateCache(userId);
        return null;
    }

    return record;
}

function respond(interactionOrMessage, content) {
    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

    const isSlash = interactionOrMessage.isChatInputCommand?.() === true;
    return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | (isSlash ? MessageFlags.Ephemeral : 0)
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nop')
        .setDescription('Manage no-prefix access')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to no-prefix access')
                .addUserOption(option =>
                    option.setName('user').setDescription('User to add').setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Duration such as 1h, 7d, or permanent')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from no-prefix access')
                .addUserOption(option =>
                    option.setName('user').setDescription('User to remove').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View no-prefix information')
                .addUserOption(option =>
                    option.setName('user').setDescription('User to check').setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle no-prefix access for a user')
                .addUserOption(option =>
                    option.setName('user').setDescription('User to toggle').setRequired(true)
                )
        ),

    name: 'nop',
    aliases: ['no-prefix'],
    description: 'Manage no-prefix access',

    async execute(interactionOrMessage, args = []) {
        if (!isOwner(interactionOrMessage)) {
            return respond(interactionOrMessage, '**No-Prefix**\n\nYou are not authorized to use this command.');
        }

        const isSlash = interactionOrMessage.isChatInputCommand?.() === true;
        const action = isSlash
            ? interactionOrMessage.options.getSubcommand()
            : args[0]?.toLowerCase();

        if (!action) {
            return respond(
                interactionOrMessage,
                '**No-Prefix**\n\n' +
                'Use `/nop add <user> [duration]`, `/nop remove <user>`, `/nop info [user]`, or `/nop toggle <user>`.'
            );
        }

        if (action === 'add') {
            const targetUser = await resolveUser(interactionOrMessage, args.slice(1));
            if (!targetUser) return respond(interactionOrMessage, '**No-Prefix**\n\nPlease provide a valid user.');

            const duration = getDuration(interactionOrMessage, args.slice(1));
            let expiresAt = null;

            if (duration.toLowerCase() !== 'permanent') {
                const durationMs = ms(duration);
                if (!durationMs) {
                    return respond(interactionOrMessage, '**No-Prefix**\n\nInvalid duration. Use formats like `1h`, `7d`, or `permanent`.');
                }
                expiresAt = new Date(Date.now() + durationMs);
            }

            await NoPrefix.upsert({
                userId: targetUser.id,
                username: targetUser.username,
                grantedBy: interactionOrMessage.user?.id || interactionOrMessage.author.id,
                grantedByUsername: interactionOrMessage.user?.username || interactionOrMessage.author.username,
                expiresAt,
                duration
            });

            NoPrefix.invalidateCache(targetUser.id);

            return respond(
                interactionOrMessage,
                '**No-Prefix**\n\n' +
                '> User: **' + targetUser.tag + '**\n' +
                '> Status: **Enabled**\n' +
                '> Duration: **' + duration + '**\n' +
                '> Expires: ' + (expiresAt ? '<t:' + Math.floor(expiresAt.getTime() / 1000) + ':R>' : '**Never**')
            );
        }

        if (action === 'remove') {
            const targetUser = await resolveUser(interactionOrMessage, args.slice(1));
            if (!targetUser) return respond(interactionOrMessage, '**No-Prefix**\n\nPlease provide a valid user.');

            const existing = await getActiveRecord(targetUser.id);
            if (!existing) {
                return respond(interactionOrMessage, '**No-Prefix**\n\n**' + targetUser.tag + '** does not have no-prefix access.');
            }

            await NoPrefix.destroy({ where: { userId: targetUser.id } });
            NoPrefix.invalidateCache(targetUser.id);

            return respond(interactionOrMessage, '**No-Prefix**\n\nDisabled no-prefix access for **' + targetUser.tag + '**.');
        }

        if (action === 'info') {
            const targetUser = isSlash
                ? (interactionOrMessage.options.getUser('user') || interactionOrMessage.user)
                : (await resolveUser(interactionOrMessage, args.slice(1)) || interactionOrMessage.author);

            const record = await getActiveRecord(targetUser.id);
            if (!record) {
                return respond(interactionOrMessage, '**No-Prefix Info**\n\n> User: **' + targetUser.tag + '**\n> Status: **Disabled**');
            }

            const expires = record.expiresAt
                ? '<t:' + Math.floor(new Date(record.expiresAt).getTime() / 1000) + ':R>'
                : '**Never**';

            return respond(
                interactionOrMessage,
                '**No-Prefix Info**\n\n' +
                '> User: **' + targetUser.tag + '**\n' +
                '> Status: **Enabled**\n' +
                '> Duration: **' + record.duration + '**\n' +
                '> Expires: ' + expires + '\n' +
                '> Granted by: **' + record.grantedByUsername + '**'
            );
        }

        if (action === 'toggle') {
            const targetUser = await resolveUser(interactionOrMessage, args.slice(1));
            if (!targetUser) return respond(interactionOrMessage, '**No-Prefix**\n\nPlease provide a valid user.');

            const existing = await getActiveRecord(targetUser.id);
            if (existing) {
                await NoPrefix.destroy({ where: { userId: targetUser.id } });
                NoPrefix.invalidateCache(targetUser.id);
                return respond(interactionOrMessage, '**No-Prefix**\n\nDisabled no-prefix access for **' + targetUser.tag + '**.');
            }

            await NoPrefix.upsert({
                userId: targetUser.id,
                username: targetUser.username,
                grantedBy: interactionOrMessage.user?.id || interactionOrMessage.author.id,
                grantedByUsername: interactionOrMessage.user?.username || interactionOrMessage.author.username,
                expiresAt: null,
                duration: 'permanent'
            });

            NoPrefix.invalidateCache(targetUser.id);

            return respond(interactionOrMessage, '**No-Prefix**\n\nEnabled no-prefix access for **' + targetUser.tag + '**.');
        }

        return respond(interactionOrMessage, '**No-Prefix**\n\nUnknown subcommand.');
    }
};