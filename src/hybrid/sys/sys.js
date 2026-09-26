// © PauzeX

const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');
const axios = require('axios');
const config = require('../../config');

const API_BASE = (process.env.BOT_HOSTING_API_BASE || 'https://bot-hosting.net/api/v1').replace(/\/$/, '');
const API_KEY = process.env.BOT_HOSTING_API_KEY;
const DEPLOYMENT_ID = process.env.BOT_HOSTING_DEPLOYMENT_ID;

function isOwner(source) {
    const userId = source.user?.id || source.author?.id;
    return userId === config.OWNER_ID;
}

function apiHeaders() {
    return {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
    };
}

function ensureConfigured() {
    if (!API_KEY || !DEPLOYMENT_ID) {
        return 'Bot-Hosting API is not configured. Set `BOT_HOSTING_API_KEY` and `BOT_HOSTING_DEPLOYMENT_ID` in the hosting environment.';
    }
    return null;
}

async function apiRequest(method, path, options = {}) {
    const response = await axios({
        method,
        url: `${API_BASE}${path}`,
        headers: apiHeaders(),
        timeout: options.timeout || 30000,
        params: options.params,
        data: options.data,
        validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 300) {
        const error = new Error(response.data?.message || response.data?.error || response.data?.msg || `Bot-Hosting API returned HTTP ${response.status}`);
        error.status = response.status;
        error.data = response.data;
        throw error;
    }

    return response.data;
}

function cleanLogLine(line) {
    return String(line)
        .replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, '')
        .replace(/`/g, "'");
}

function formatLogs(lines, maxLines = 35) {
    let safeLines = [];

    if (Array.isArray(lines)) {
        safeLines = lines;
    } else if (typeof lines === 'string') {
        safeLines = lines.split(/\r?\n/);
    } else if (lines?.lines && Array.isArray(lines.lines)) {
        safeLines = lines.lines;
    } else if (lines?.output) {
        safeLines = String(lines.output).split(/\r?\n/);
    }

    safeLines = safeLines.map(cleanLogLine).slice(-maxLines);
    if (!safeLines.length) return 'No console logs were returned.';

    let output = safeLines.join('\n');
    if (output.length > 1550) output = output.slice(-1550);
    const fence = String.fromCharCode(96).repeat(3);
    return `${fence}text\n${output}\n${fence}`;
}

function buildResponse(title, body, footer = null) {
    const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

    if (footer) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

async function reply(source, title, body, footer = null) {
    const payload = buildResponse(title, body, footer);
    if (source.deferred || source.replied) return source.editReply(payload);
    return source.reply(payload);
}

async function defer(source) {
    if (source.isChatInputCommand?.() && !source.deferred && !source.replied) {
        await source.deferReply();
    }
}

async function getLogs(size = 100, waitSeconds = 0) {
    return apiRequest('GET', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/logs`, {
        params: { size, waitSeconds },
        timeout: Math.max(30000, (waitSeconds + 10) * 1000)
    });
}

async function handleRestart(source) {
    await defer(source);

    await reply(
        source,
        'System Restart',
        '**Shell**\n```text\n$ deployment restart\nrunning...\n```',
        'Restart request sent to Bot-Hosting.net.'
    );

    const result = await apiRequest('POST', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/power`, {
        data: { action: 'restart', waitSeconds: 20 },
        timeout: 35000
    });

    let logs = result.logs;
    if (!logs || (Array.isArray(logs) && logs.length === 0)) {
        try {
            const logResult = await getLogs(80, 3);
            logs = logResult.lines;
        } catch (_) {}
    }

    const state = result.state || 'unknown';
    const logText = formatLogs(logs);
    return reply(
        source,
        'System Restart',
        `**Shell**\n\`\`\`text\n$ deployment restart\nexited: ${result.ok ? '0' : '1'}\n\`\`\`\n\n> State: **${state}**\n> Result: **${result.ok ? 'Accepted' : 'Failed'}**\n> Reason: **${result.reason || 'N/A'}**\n\n**Console Logs**\n${logText}`,
        result.hint || 'Restart completed through Bot-Hosting.net.'
    );
}

async function handleLogs(source) {
    await defer(source);
    const result = await getLogs(100, 0);
    return reply(
        source,
        'System Console Logs',
        `> State: **${result.state || 'unknown'}**\n\n${formatLogs(result.lines, 55)}`,
        result.settled === false ? 'The process is still producing output.' : 'Latest Bot-Hosting.net console output.'
    );
}

async function handleStatus(source) {
    await defer(source);
    const [deployment, resources] = await Promise.all([
        apiRequest('GET', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}`),
        apiRequest('GET', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/resources`)
    ]);

    const memoryMB = resources.memory?.usedBytes != null ? (resources.memory.usedBytes / 1024 / 1024).toFixed(1) : 'N/A';
    const memoryLimitMB = resources.memory?.limitBytes != null ? (resources.memory.limitBytes / 1024 / 1024).toFixed(1) : 'N/A';
    const diskMB = resources.disk?.usedBytes != null ? (resources.disk.usedBytes / 1024 / 1024).toFixed(1) : 'N/A';
    const uptime = resources.uptimeMs != null ? `${Math.floor(resources.uptimeMs / 3600000)}h ${Math.floor((resources.uptimeMs % 3600000) / 60000)}m` : 'N/A';

    return reply(
        source,
        'System Status',
        `> Deployment: **${deployment.name || DEPLOYMENT_ID}**\n> State: **${resources.state || deployment.state || 'unknown'}**\n> Lifecycle: **${deployment.status || 'unknown'}**\n> CPU: **${resources.cpu?.usedPercent ?? 'N/A'}% / ${resources.cpu?.limitPercent ?? 'N/A'}%**\n> Memory: **${memoryMB} MB / ${memoryLimitMB} MB**\n> Disk: **${diskMB} MB**\n> Uptime: **${uptime}**`,
        'Live resource information from Bot-Hosting.net.'
    );
}

async function handlePull(source) {
    await defer(source);

    await reply(
        source,
        'System Pull',
        '**Shell**\n```text\n$ git pull\nrunning...\n```',
        'Pull request sent to Bot-Hosting.net.'
    );

    const result = await apiRequest('POST', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/sync`, {
        data: {},
        timeout: 60000
    });

    let logs = result.logs || result.output;
    if (!logs || (Array.isArray(logs) && logs.length === 0)) {
        try {
            const logResult = await getLogs(60, 2);
            logs = logResult.lines;
        } catch (_) {}
    }

    const logText = formatLogs(logs, 30);
    return reply(
        source,
        'System Pull',
        `**Shell**\n\`\`\`text\n$ git pull\nexited: ${result.ok ? '0' : '1'}\n\`\`\`\n\n> Result: **${result.ok ? 'Success' : 'Failed'}**\n> Repository: **${result.repo || 'N/A'}**\n> Branch: **${result.branch || 'N/A'}**\n> Commit: **${result.commit || 'N/A'}**\n\n**Console Logs**\n${logText}`,
        'Latest code pulled from the linked GitHub repository.'
    );
}

async function handleInfo(source) {
    await defer(source);
    const [deployment, git, startup] = await Promise.all([
        apiRequest('GET', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}`),
        apiRequest('GET', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/git`),
        apiRequest('GET', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/startup`)
    ]);

    return reply(
        source,
        'System Information',
        `> Name: **${deployment.name || 'N/A'}**\n> ID: **${DEPLOYMENT_ID}**\n> State: **${deployment.state || 'unknown'}**\n> Runtime: **${startup.runtime || deployment.runtime || 'N/A'}**\n> Runtime Version: **${startup.runtimeVersion || 'N/A'}**\n> Entry File: **${startup.entryFile || deployment.entryFile || 'N/A'}**\n> Repository: **${git.repo || 'N/A'}**\n> Branch: **${git.branch || 'N/A'}**\n> Auto-Pull: **${git.autoPull ? 'Enabled' : 'Disabled'}**`,
        'Bot-Hosting.net deployment information.'
    );
}

async function handlePower(source, action) {
    await defer(source);
    const result = await apiRequest('POST', `/deployments/${encodeURIComponent(DEPLOYMENT_ID)}/power`, {
        data: { action, waitSeconds: action === 'stop' || action === 'kill' ? 0 : 20 },
        timeout: 35000
    });

    let body = `> Action: **${action}**\n> State: **${result.state || 'unknown'}**\n> Result: **${result.ok ? 'Accepted' : 'Failed'}**\n> Reason: **${result.reason || 'N/A'}**`;

    if (action === 'start' || action === 'restart') {
        body += `\n\n**Console Logs**\n${formatLogs(result.logs)}`;
    }

    return reply(source, `System ${action[0].toUpperCase()}${action.slice(1)}`, body, result.hint || 'Bot-Hosting.net power operation completed.');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sys')
        .setDescription('Manage the PauzeX hosting system')
        .addSubcommand(sub => sub.setName('restart').setDescription('Restart PauzeX and show console logs'))
        .addSubcommand(sub => sub.setName('start').setDescription('Start PauzeX and show console logs'))
        .addSubcommand(sub => sub.setName('stop').setDescription('Stop PauzeX'))
        .addSubcommand(sub => sub.setName('kill').setDescription('Force-stop PauzeX'))
        .addSubcommand(sub => sub.setName('logs').setDescription('Show the latest console logs'))
        .addSubcommand(sub => sub.setName('status').setDescription('Show live hosting status and resources'))
        .addSubcommand(sub => sub.setName('pull').setDescription('Pull the latest code from the linked GitHub repository'))
        .addSubcommand(sub => sub.setName('info').setDescription('Show hosting and deployment information')),

    name: 'sys',
    aliases: ['system'],
    description: 'Manage the PauzeX hosting system',

    async execute(source, args = []) {
        if (!isOwner(source)) {
            return reply(source, 'System', 'You are not authorized to use this command.');
        }

        const configuredError = ensureConfigured();
        if (configuredError) {
            return reply(source, 'System Configuration', configuredError);
        }

        const isSlash = source.isChatInputCommand?.() === true;
        const action = isSlash ? source.options.getSubcommand() : (args[0] || '').toLowerCase();

        try {
            switch (action) {
                case 'restart': return await handleRestart(source);
                case 'start': return await handlePower(source, 'start');
                case 'stop': return await handlePower(source, 'stop');
                case 'kill': return await handlePower(source, 'kill');
                case 'logs': return await handleLogs(source);
                case 'status': return await handleStatus(source);
                case 'pull': return await handlePull(source);
                case 'info': return await handleInfo(source);
                default:
                    return reply(source, 'System Commands', '`/sys restart` · `/sys start` · `/sys stop` · `/sys kill` · `/sys logs` · `/sys status` · `/sys pull` · `/sys info`');
            }
        } catch (error) {
            const detail = error?.response?.data?.message || error?.response?.data?.error || error?.response?.data?.msg || error.message;
            return reply(source, 'System Error', `The Bot-Hosting.net request failed.\n\n> **${String(detail).slice(0, 1200)}**`);
        }
    }
};
