const express = require("express");
const dgram = require("node:dgram");

const router = express.Router();

const DEFAULT_SERVER_IP = "208.115.196.109";
const DEFAULT_QUERY_PORT = 2305;
const DEFAULT_MAX_PLAYERS = 50;
const QUERY_TIMEOUT_MS = 5000;

const A2S_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const A2S_INFO_TYPE = 0x54;
const A2S_INFO_RESPONSE = 0x49;
const A2S_CHALLENGE_RESPONSE = 0x41;
const A2S_INFO_TEXT = Buffer.from("Source Engine Query\0", "ascii");

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
  if (
    buffer.length < 6 ||
    buffer.readInt32LE(0) !== -1 ||
    buffer[4] !== A2S_INFO_RESPONSE
  ) {
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

function buildA2SInfoQuery(challenge = null) {
  const parts = [A2S_HEADER, Buffer.from([A2S_INFO_TYPE]), A2S_INFO_TEXT];

  if (challenge) {
    parts.push(challenge);
  }

  return Buffer.concat(parts);
}

function queryDayzServer(host, port) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let finished = false;
    let challengeSent = false;

    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.close();

      if (error) reject(error);
      else resolve(result);
    };

    const sendQuery = (challenge = null) => {
      const query = buildA2SInfoQuery(challenge);
      socket.send(query, port, host, (error) => {
        if (error) finish(error);
      });
    };

    const timeout = setTimeout(() => {
      finish(new Error(`Timeout Steam Query après ${QUERY_TIMEOUT_MS} ms`));
    }, QUERY_TIMEOUT_MS);

    socket.on("error", (error) => finish(error));

    socket.on("message", (message) => {
      try {
        if (message.length < 5 || message.readInt32LE(0) !== -1) {
          throw new Error("Paquet Steam Query invalide");
        }

        const responseType = message[4];

        // Depuis les changements anti-amplification de Steam, certains serveurs
        // exigent un challenge avant d'envoyer la réponse A2S_INFO complète.
        if (responseType === A2S_CHALLENGE_RESPONSE) {
          if (message.length < 9) {
            throw new Error("Challenge Steam Query incomplet");
          }

          if (challengeSent) {
            throw new Error("Le serveur renvoie plusieurs challenges Steam Query");
          }

          challengeSent = true;
          const challenge = message.subarray(5, 9);
          sendQuery(challenge);
          return;
        }

        if (responseType === A2S_INFO_RESPONSE) {
          finish(null, parseA2SInfo(message));
          return;
        }

        throw new Error(
          `Type de réponse Steam Query inattendu : 0x${responseType.toString(16)}`
        );
      } catch (error) {
        finish(error);
      }
    });

    sendQuery();
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
      queryHost: host,
      queryPort,
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
      queryHost: host,
      queryPort,
      error: error.message,
      updatedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;
