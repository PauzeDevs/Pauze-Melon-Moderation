// © PauzeX
// Status heartbeat integration — created for PauzeX status monitoring.
// This module is intentionally isolated so the existing bot architecture remains unchanged.

const config = require('../config');

let heartbeatTimer = null;
let started = false;

function isEnabled() {
  const monitor = config.STATUS_MONITOR;

  return Boolean(
    monitor &&
    monitor.API_URL &&
    monitor.API_KEY
  );
}

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}

function getBotStats(client) {
  const guilds = client.guilds?.cache?.size ?? 0;

  const users = client.guilds?.cache?.reduce(
    (total, guild) => total + (guild.memberCount || 0),
    0
  ) ?? 0;

  return {
    guilds,
    users
  };
}

async function sendHeartbeat(client) {
  if (!isEnabled() || !client?.isReady()) return;

  const monitor = config.STATUS_MONITOR;
  const { guilds, users } = getBotStats(client);

  const payload = {
    botId: client.user?.id ?? config.CLIENT_ID,
    botName: config.BOT_NAME,
    status: 'online',
    latency: Number.isFinite(client.ws?.ping) ? client.ws.ping : null,
    guilds,
    users,
    uptimeSeconds: Math.floor(process.uptime()),
    version: require('../../package.json').version,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(
      `${normalizeBaseUrl(monitor.API_URL)}/api/heartbeat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${monitor.API_KEY}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    // A status-monitoring failure must never interrupt the Discord bot.
    console.error(`[PauzeX Status] Heartbeat failed: ${error.message}`);
  }
}

function startStatusHeartbeat(client) {
  if (started || !isEnabled()) return;

  started = true;

  const interval = Math.max(
    15000,
    Number(config.STATUS_MONITOR.INTERVAL_MS) || 30000
  );

  // Send one immediately so the dashboard does not wait for the first interval.
  void sendHeartbeat(client);

  heartbeatTimer = setInterval(() => {
    void sendHeartbeat(client);
  }, interval);

  // Do not keep Node.js alive solely for status reporting.
  heartbeatTimer.unref?.();
}

function stopStatusHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  started = false;
}

module.exports = {
  startStatusHeartbeat,
  stopStatusHeartbeat
};

/**
 * Project: PauzeX
 * Purpose: External bot status heartbeat for status.pauzex.xyz
 * © 2026 PauzeX. All rights reserved.
 */
