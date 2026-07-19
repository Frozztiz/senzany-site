const express = require("express");
const dgram = require("node:dgram");

const router = express.Router();

const DEFAULT_SERVER_IP = "208.115.196.109";
const DEFAULT_QUERY_PORT = 2305;
const DEFAULT_MAX_PLAYERS = 50;
const QUERY_TIMEOUT_MS = 3000;

function readCString(buffer, offset) {
  const end = buffer.indexOf(0x00, offset);

  if (end === -1) {
    throw new Error("Réponse Steam invalide : chaîne non terminée");
  }

  return {
    value: buffer.toString("utf8", offset, end),
    nextOffset: end + 1,
  };
}

function parseA2SInfo(buffer) {
  if (buffer.length < 6 || buffer.readInt32LE(0) !== -1 || buffer[4] !== 0x49) {
    throw new Error("Réponse Steam A2S_INFO invalide");
  }

  let offset = 6; // header + type + protocol

  const name = readCString(buffer, offset);
  offset = name.nextOffset;

  const map = readCString(buffer, offset);
  offset = map.nextOffset;

  const folder = readCString(buffer, offset);
  offset = folder.nextOffset;

  const game = readCString(buffer, offset);
  offset = game.nextOffset;

  if (offset + 5 > buffer.length) {
    throw new Error("Réponse Steam A2S_INFO incomplète");
  }

  const appId = buffer.readUInt16LE(offset);
  offset += 2;

  const players = buffer.readUInt8(offset++);
  const maxPlayers = buffer.readUInt8(offset++);
  const bots = buffer.readUInt8(offset++);

  return {
    name: name.value,
    map: map.value,
    folder: folder.value,
    game: game.value,
    appId,
    players,
    maxPlayers,
    bots,
  };
}

function queryDayzServer(host, port) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let finished = false;

    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.close();

      if (error) reject(error);
      else resolve(result);
    };

    const timeout = setTimeout(() => {
      finish(new Error(`Timeout Steam Query après ${QUERY_TIMEOUT_MS} ms`));
    }, QUERY_TIMEOUT_MS);

    socket.once("error", (error) => finish(error));

    socket.once("message", (message) => {
      try {
        finish(null, parseA2SInfo(message));
      } catch (error) {
        finish(error);
      }
    });

    // A2S_INFO : 0xFFFFFFFF + 'TSource Engine Query\0'
    const query = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
      Buffer.from("Source Engine Query\0", "ascii"),
    ]);

    socket.send(query, port, host, (error) => {
      if (error) finish(error);
    });
  });
}

router.get("/stats", async (req, res) => {
  const host = process.env.DAYZ_SERVER_IP || DEFAULT_SERVER_IP;
  const queryPort = Number(process.env.DAYZ_QUERY_PORT || DEFAULT_QUERY_PORT);
  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS || DEFAULT_MAX_PLAYERS
  );

  try {
    const server = await queryDayzServer(host, queryPort);

    res.set("Cache-Control", "public, max-age=20, stale-while-revalidate=40");
    res.json({
      online: true,
      players: server.players,
      maxPlayers: server.maxPlayers || fallbackMaxPlayers,
      map: server.map || "chernarusplus",
      name: server.name,
      bots: server.bots,
      source: "steam-query",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erreur Steam Query DayZ :", error.message);

    res.status(200).json({
      online: false,
      players: null,
      maxPlayers: fallbackMaxPlayers,
      map: "chernarusplus",
      source: "steam-query",
      error: "Serveur DayZ inaccessible via Steam Query",
      updatedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;
