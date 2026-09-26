// © PauzeX

const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

const { NoPrefix } = require('../../data/models');
const config = require('../../config');

const PLANS = [
    { value: '1', label: '1 Month', description: 'No-prefix access for 1 month' },
    { value: '3', label: '3 Months', description: 'No-prefix access for 3 months' },
    { value: '6', label: '6 Months', description: 'No-prefix access for 6 months' },
    { value: '12', label: '12 Months', description: 'No-prefix access for 12 months' }
];

function isOwner(interactionOrMessage) {
    const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
    return userId === config.OWNER_ID;
}

async function resolveUser(interactionOrMessage, args, optionName = 'user') {
    if (interactionOrMessage.isChatInputCommand?.()) return interactionOrMessage.options.getUser(optionName);
    const userId = interactionOrMessage.mentions.users.first()?.id || args[0];
    if (!userId) return null;
    return interactionOrMessage.client.users.fetch(userId).catch(() => null);
}

function addMonths(date, months) {
    const result = new Date(date);
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
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

function sendPublic(interactionOrMessage, content) {
    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

function buildPlanMessage(targetUser) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`nop_plan_${targetUser.id}`)
        .setPlaceholder('Select a no-prefix plan')
        .addOptions(PLANS);
    const row = new ActionRowBuilder().addComponents(select);
    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('**No-Prefix Plans**'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> User: **${targetUser.tag}**\n> Choose a plan below to grant no-prefix access.`));
    return { components: [container, row], flags: MessageFlags.IsComponentsV2 };
}

function buildToggleMessage(targetUser, enabled) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`nop_toggle_${targetUser.id}`)
        .setPlaceholder(enabled ? 'No-prefix is currently ON' : 'No-prefix is currently OFF')
        .addOptions(
            { label: 'Turn ON', value: 'on', description: 'Enable your no-prefix access', emoji: '🟢' },
            { label: 'Turn OFF', value: 'off', description: 'Disable your no-prefix access', emoji: '🔴' }
        );
    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('**No-Prefix Toggle**'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> User: **${targetUser.tag}**\n> Current status: **${enabled ? 'Enabled' : 'Disabled'}**\n> Select an option below to change your no-prefix status.`));
    return { components: [container, new ActionRowBuilder().addComponents(select)], flags: MessageFlags.IsComponentsV2 };
}

async function getReplyMessage(interactionOrMessage, replyResult) {
    if (interactionOrMessage.isChatInputCommand?.()) return interactionOrMessage.fetchReply();
    return replyResult;
}

async function showPlanSelector(interactionOrMessage, targetUser) {
    const replyResult = await interactionOrMessage.reply(buildPlanMessage(targetUser));
    const message = await getReplyMessage(interactionOrMessage, replyResult);
    const collector = message.createMessageComponentCollector({ componentType: 3, time: 60000, filter: i => i.customId === `nop_plan_${targetUser.id}` });
    collector.on('collect', async (menuInteraction) => {
        if (!isOwner(menuInteraction)) return menuInteraction.reply({ content: '**No-Prefix**\\n\\nYou are not authorized to use this menu.' });
        const months = Number(menuInteraction.values[0]);
        const plan = PLANS.find(p => p.value === String(months));
        if (!plan) return menuInteraction.reply({ content: '**No-Prefix**\\n\\nInvalid plan selected.' });

        await menuInteraction.deferUpdate();

        try {
            const grantedAt = new Date();
            const expiresAt = addMonths(grantedAt, months);
            const actor = menuInteraction.user;
            await NoPrefix.upsert({
                userId: targetUser.id,
                username: targetUser.username,
                grantedBy: actor.id,
                grantedByUsername: actor.username,
                expiresAt,
                duration: plan.label,
                enabled: true
            });
            NoPrefix.invalidateCache(targetUser.id);

            const resultContainer = new ContainerBuilder()
                .setAccentColor(0x2B2D31)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('**No Prefix Granted**'))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `> User: **${targetUser.tag}**\\n> Plan: **${plan.label}**\\n> Status: **Enabled**\\n> Granted: <t:${Math.floor(grantedAt.getTime() / 1000)}:F>\\n> Expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`
                ))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# No-prefix access granted successfully.'));

            await message.edit({ components: [resultContainer], flags: MessageFlags.IsComponentsV2 });
            collector.stop('completed');
        } catch (error) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(0x2B2D31)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**No-Prefix Error**\\n\\n> ${String(error?.message || 'Failed to grant no-prefix access.').slice(0, 1000)}`
                ));
            await message.edit({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            collector.stop('error');
        }
    });
    collector.on('end', async (_, reason) => {
        if (reason === 'completed' || reason === 'error') return;
        try {
            const disabledSelect = new StringSelectMenuBuilder().setCustomId(`nop_plan_disabled_${targetUser.id}`).setPlaceholder('Plan selection expired').setDisabled(true).addOptions(PLANS);
            await message.edit({ components: [message.components[0], new ActionRowBuilder().addComponents(disabledSelect)], flags: MessageFlags.IsComponentsV2 });
        } catch (_) {}
    });
    return message;
}

async function showToggleSelector(interactionOrMessage, targetUser, record) {
    const replyResult = await interactionOrMessage.reply(buildToggleMessage(targetUser, record.enabled !== false));
    const message = await getReplyMessage(interactionOrMessage, replyResult);
    const collector = message.createMessageComponentCollector({ componentType: 3, time: 60000, filter: i => i.customId === `nop_toggle_${targetUser.id}` });
    collector.on('collect', async (menuInteraction) => {
        if (menuInteraction.user.id !== targetUser.id) return menuInteraction.reply({ content: '**No-Prefix**\\n\\nOnly the user whose access is being changed can use this menu.' });

        await menuInteraction.deferUpdate();

        try {
            const current = await getActiveRecord(targetUser.id);
            if (!current) {
                const container = new ContainerBuilder()
                    .setAccentColor(0x2B2D31)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('**No-Prefix Toggle**\\n\\nYour no-prefix plan is no longer active.'));
                await message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
                collector.stop('error');
                return;
            }

            const enabled = menuInteraction.values[0] === 'on';
            await current.update({ enabled });
            NoPrefix.invalidateCache(targetUser.id);
            const expiresText = current.expiresAt ? `<t:${Math.floor(new Date(current.expiresAt).getTime() / 1000)}:F>` : '**Never**';
            const container = new ContainerBuilder()
                .setAccentColor(0x2B2D31)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**No-Prefix ${enabled ? 'Enabled' : 'Disabled'}**\\n\\n> User: **${targetUser.tag}**\\n> Status: **${enabled ? 'Enabled' : 'Disabled'}**\\n> Plan: **${current.duration}**\\n> Expires: ${expiresText}`
                ));
            await message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
            collector.stop('completed');
        } catch (error) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(0x2B2D31)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**No-Prefix Error**\\n\\n> ${String(error?.message || 'Failed to update no-prefix access.').slice(0, 1000)}`
                ));
            await message.edit({ components: [errorContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            collector.stop('error');
        }
    });
    return message;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nop').setDescription('Manage no-prefix access')
        .addSubcommand(subcommand => subcommand.setName('add').setDescription('Add a user to no-prefix access').addUserOption(option => option.setName('user').setDescription('User to add').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('remove').setDescription('Remove a user from no-prefix access').addUserOption(option => option.setName('user').setDescription('User to remove').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('info').setDescription('View no-prefix information').addUserOption(option => option.setName('user').setDescription('User to check').setRequired(false)))
        .addSubcommand(subcommand => subcommand.setName('toggle').setDescription('Toggle your no-prefix access')),
    name: 'nop',
    aliases: ['no-prefix'],
    description: 'Manage no-prefix access',
    async execute(interactionOrMessage, args = []) {
        const isSlash = interactionOrMessage.isChatInputCommand?.() === true;
        const action = isSlash ? interactionOrMessage.options.getSubcommand() : args[0]?.toLowerCase();

        // /nop toggle is available to everyone, but only the caller can toggle their own active plan.
        if (action === 'toggle') {
            const targetUser = interactionOrMessage.user || interactionOrMessage.author;
            const record = await getActiveRecord(targetUser.id);
            if (!record) return sendPublic(interactionOrMessage, '**No-Prefix Toggle**\n\nYou do not have an active no-prefix plan.');
            return showToggleSelector(interactionOrMessage, targetUser, record);
        }

        // /nop add, /nop remove and /nop info remain owner-only.
        if (!isOwner(interactionOrMessage)) return sendPublic(interactionOrMessage, '**No-Prefix**\n\nYou are not authorized to use this command.');
        if (!action) return sendPublic(interactionOrMessage, '**No-Prefix**\n\nUse `/nop add <user>`, `/nop remove <user>`, `/nop info [user]`, or `/nop toggle`.');

        if (action === 'add') {
            const targetUser = await resolveUser(interactionOrMessage, args.slice(1));
            if (!targetUser) return sendPublic(interactionOrMessage, '**No-Prefix**\n\nPlease provide a valid user.');
            return showPlanSelector(interactionOrMessage, targetUser);
        }
        if (action === 'remove') {
            const targetUser = await resolveUser(interactionOrMessage, args.slice(1));
            if (!targetUser) return sendPublic(interactionOrMessage, '**No-Prefix**\n\nPlease provide a valid user.');
            const existing = await getActiveRecord(targetUser.id);
            if (!existing) return sendPublic(interactionOrMessage, `**No-Prefix**\n\n**${targetUser.tag}** does not have no-prefix access.`);
            await NoPrefix.destroy({ where: { userId: targetUser.id } });
            NoPrefix.invalidateCache(targetUser.id);
            return sendPublic(interactionOrMessage, `**No-Prefix Removed**\n\n> User: **${targetUser.tag}**\n> Status: **Disabled**`);
        }
        if (action === 'info') {
            const targetUser = isSlash ? (interactionOrMessage.options.getUser('user') || interactionOrMessage.user) : (await resolveUser(interactionOrMessage, args.slice(1)) || interactionOrMessage.author);
            const record = await getActiveRecord(targetUser.id);
            if (!record) return sendPublic(interactionOrMessage, `**No-Prefix Info**\n\n> User: **${targetUser.tag}**\n> Status: **Disabled**`);
            const grantedAt = record.grantedAt || record.createdAt;
            const grantedText = grantedAt ? `<t:${Math.floor(new Date(grantedAt).getTime() / 1000)}:F>` : '**Unknown**';
            const expiresText = record.expiresAt ? `<t:${Math.floor(new Date(record.expiresAt).getTime() / 1000)}:F>` : '**Never**';
            return sendPublic(interactionOrMessage, '**No-Prefix Info**\n\n' + `> User: **${targetUser.tag}**\n` + `> Status: **${record.enabled === false ? 'Disabled' : 'Enabled'}**\n` + `> Plan: **${record.duration}**\n` + `> Granted: ${grantedText}\n` + `> Expires: ${expiresText}\n` + `> Granted by: **${record.grantedByUsername}**`);
        }
        return sendPublic(interactionOrMessage, '**No-Prefix**\n\nUnknown subcommand.');
    }
};