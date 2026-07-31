const dgram = require("node:dgram");

const PACKET_PREFIX = Buffer.from("BE", "ascii");
const PAYLOAD_MARKER = 0xff;
const MULTIPART_MARKER = 0x00;

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createPacket(payload) {
  const protectedPayload = Buffer.concat([Buffer.from([PAYLOAD_MARKER]), payload]);
  const packet = Buffer.alloc(2 + 4 + protectedPayload.length);

  PACKET_PREFIX.copy(packet, 0);
  packet.writeUInt32LE(crc32(protectedPayload), 2);
  protectedPayload.copy(packet, 6);

  return packet;
}

function parsePacket(packet) {
  if (!Buffer.isBuffer(packet) || packet.length < 8) {
    throw new Error("Réponse RCON trop courte.");
  }

  if (!packet.subarray(0, 2).equals(PACKET_PREFIX)) {
    throw new Error("Réponse RCON invalide : signature BE absente.");
  }

  const protectedPayload = packet.subarray(6);
  const expectedCrc = packet.readUInt32LE(2);
  const actualCrc = crc32(protectedPayload);

  if (expectedCrc !== actualCrc) {
    throw new Error("Réponse RCON invalide : contrôle CRC incorrect.");
  }

  if (protectedPayload[0] !== PAYLOAD_MARKER) {
    throw new Error("Réponse RCON invalide : marqueur de protocole absent.");
  }

  return protectedPayload.subarray(1);
}

function getConfig() {
  const host = String(process.env.DAYZ_RCON_HOST || "").trim();
  const port = Number.parseInt(process.env.DAYZ_RCON_PORT || "", 10);
  const password = String(process.env.DAYZ_RCON_PASSWORD || "");
  const timeoutMs = Number.parseInt(process.env.DAYZ_RCON_TIMEOUT_MS || "6000", 10);

  if (!host) throw new Error("DAYZ_RCON_HOST est manquant.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DAYZ_RCON_PORT est invalide.");
  }
  if (!password) throw new Error("DAYZ_RCON_PASSWORD est manquant.");

  return {
    host,
    port,
    password,
    timeoutMs: Number.isInteger(timeoutMs) && timeoutMs >= 1000 ? timeoutMs : 6000
  };
}

function waitForPacket(socket, timeoutMs, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Le serveur RCON n'a pas répondu dans le délai prévu."));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("error", onError);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onMessage(packet) {
      try {
        const payload = parsePacket(packet);
        if (!predicate(payload)) return;
        cleanup();
        resolve(payload);
      } catch (error) {
        cleanup();
        reject(error);
      }
    }

    socket.on("message", onMessage);
    socket.on("error", onError);
  });
}

/**
 * Attend une réponse à une commande BattlEye et reconstitue automatiquement
 * les réponses fragmentées en plusieurs paquets UDP.
 *
 * Format commande simple :      01 <sequence> <texte>
 * Format commande fragmentée :  01 <sequence> 00 <total> <index> <texte>
 */
function waitForCommandResponse(socket, timeoutMs, sequence) {
  return new Promise((resolve, reject) => {
    let timer = null;
    let expectedParts = null;
    const parts = new Map();

    function armTimeout() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cleanup();
        const received = [...parts.keys()].sort((a, b) => a - b).join(", ") || "aucun";
        reject(
          new Error(
            expectedParts === null
              ? "Le serveur RCON n'a pas répondu dans le délai prévu."
              : `Réponse RCON incomplète : fragments reçus ${received} sur ${expectedParts}.`
          )
        );
      }, timeoutMs);
    }

    function cleanup() {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("error", onError);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onMessage(packet) {
      try {
        const payload = parsePacket(packet);

        // Les messages serveur (type 02) peuvent arriver entre deux fragments.
        if (payload[0] !== 0x01 || payload[1] !== sequence) return;

        armTimeout();

        const isMultipart = payload.length >= 5 && payload[2] === MULTIPART_MARKER;
        if (!isMultipart) {
          cleanup();
          resolve(payload.subarray(2).toString("utf8").replace(/\0+$/g, ""));
          return;
        }

        const total = payload[3];
        const index = payload[4];

        if (total < 1 || index >= total) {
          throw new Error("Réponse RCON fragmentée invalide.");
        }

        if (expectedParts === null) expectedParts = total;
        if (expectedParts !== total) {
          throw new Error("Réponse RCON fragmentée incohérente.");
        }

        parts.set(index, payload.subarray(5));

        if (parts.size === expectedParts) {
          const ordered = [];
          for (let partIndex = 0; partIndex < expectedParts; partIndex += 1) {
            const part = parts.get(partIndex);
            if (!part) return;
            ordered.push(part);
          }

          cleanup();
          resolve(Buffer.concat(ordered).toString("utf8").replace(/\0+$/g, ""));
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    }

    socket.on("message", onMessage);
    socket.on("error", onError);
    armTimeout();
  });
}

function sendPacket(socket, packet, port, host) {
  return new Promise((resolve, reject) => {
    socket.send(packet, port, host, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

async function login(socket, config) {
  const loginPayload = Buffer.concat([
    Buffer.from([0x00]),
    Buffer.from(config.password, "utf8")
  ]);

  const responsePromise = waitForPacket(
    socket,
    config.timeoutMs,
    (payload) => payload[0] === 0x00
  );

  await sendPacket(socket, createPacket(loginPayload), config.port, config.host);
  const response = await responsePromise;

  if (response[1] !== 0x01) {
    throw new Error("Authentification RCON refusée.");
  }
}

async function executeCommand(socket, config, command, sequence = 0) {
  const commandPayload = Buffer.concat([
    Buffer.from([0x01, sequence]),
    Buffer.from(command, "utf8")
  ]);

  const responsePromise = waitForCommandResponse(socket, config.timeoutMs, sequence);
  await sendPacket(socket, createPacket(commandPayload), config.port, config.host);
  return responsePromise;
}

/**
 * Transforme la sortie texte de la commande BattlEye `players` en objets JSON.
 * Le pseudo est toujours lu comme tout ce qui suit le GUID : espaces,
 * parenthèses et caractères spéciaux restent donc acceptés.
 */
function parsePlayersResponse(rawResponse) {
  const lines = String(rawResponse || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const players = [];
  const ignoredLines = [];

  for (const line of lines) {
    if (/^players on server:/i.test(line)) continue;
    if (/^\[#\]/i.test(line)) continue;
    if (/^-{3,}$/.test(line)) continue;

    // Le port et le marqueur (?) sont optionnels selon les versions de BE.
    const match = line.match(
      /^(\d+)\s+(\S+?)(?::(\d+))?\s+(\d+)\s+([a-f0-9]{32})(\(\?\))?\s+(.+)$/i
    );

    if (!match) {
      // Ligne de total/statut finale ou format inattendu, conservé pour le debug.
      ignoredLines.push(line);
      continue;
    }

    const [, id, ip, port, ping, guid, unverifiedMarker, rawName] = match;
    const name = rawName.trim();
    if (!name) {
      ignoredLines.push(line);
      continue;
    }

    players.push({
      id,
      name,
      ping: Number.parseInt(ping, 10),
      guid: guid.toLowerCase(),
      guidVerified: !unverifiedMarker,
      ip,
      port: port ? Number.parseInt(port, 10) : null,
      timeSeconds: null,
      score: null
    });
  }

  // Compatibilité avec le reste du projet : le tableau reste directement utilisable,
  // et les diagnostics sont attachés sans modifier son contenu JSON normal.
  Object.defineProperty(players, "diagnostics", {
    value: { rawLineCount: lines.length, ignoredLines },
    enumerable: false
  });

  return players;
}

async function withAuthenticatedSocket(callback) {
  const config = getConfig();
  const socket = dgram.createSocket("udp4");

  try {
    await login(socket, config);
    return await callback(socket, config);
  } finally {
    socket.close();
  }
}

async function getPlayers() {
  return withAuthenticatedSocket(async (socket, config) => {
    const rawResponse = await executeCommand(socket, config, "players");
    const players = parsePlayersResponse(rawResponse);

    return {
      connected: true,
      host: config.host,
      port: config.port,
      command: "players",
      players,
      playerCount: players.length,
      rawResponse,
      diagnostics: players.diagnostics || { rawLineCount: 0, ignoredLines: [] }
    };
  });
}

async function executeAdminCommand(command) {
  const cleanCommand = String(command || "").replace(/[\r\n\0]/g, " ").trim();
  if (!cleanCommand) throw new Error("Commande RCON vide.");

  return withAuthenticatedSocket(async (socket, config) => {
    const rawResponse = await executeCommand(socket, config, cleanCommand);
    return { connected: true, command: cleanCommand, rawResponse };
  });
}

async function testPlayersCommand() {
  return getPlayers();
}

module.exports = {
  getPlayers,
  executeAdminCommand,
  testPlayersCommand,
  parsePlayersResponse
};
