const supabaseService = require("./supabaseService");

const SNAPSHOT_TABLE = "dayz_flagpole_snapshot";
const SNAPSHOT_ID = "current";

function cleanText(value, maxLength = 100) {
  return String(value || "").trim().slice(0, maxLength);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emptySnapshot() {
  return {
    agentId: null,
    receivedAt: null,
    count: 0,
    flagpoles: []
  };
}

function normalizeFlagpole(row, index) {
  const type = cleanText(row?.type || "TerritoryFlag", 80);
  const x = finiteNumber(row?.x);
  const y = finiteNumber(row?.y);
  const z = finiteNumber(row?.z);

  if (type !== "TerritoryFlag") return null;
  if (x === null || z === null) return null;

  if (
    x < 0 ||
    x > 15360 ||
    z < 0 ||
    z > 15360
  ) {
    return null;
  }

  return {
    id: `flagpole-${index}-${x.toFixed(2)}-${z.toFixed(2)}`,
    type,
    x,
    y: y ?? 0,
    z
  };
}

async function saveSnapshot({ agentId, flagpoles }) {
  const normalized = (
    Array.isArray(flagpoles)
      ? flagpoles
      : []
  )
    .slice(0, 2000)
    .map(normalizeFlagpole)
    .filter(Boolean);

  const receivedAt = new Date().toISOString();

  const snapshot = {
    agentId: cleanText(
      agentId || "dayz-server",
      100
    ),
    receivedAt,
    count: normalized.length,
    flagpoles: normalized
  };

  const payload = {
    id: SNAPSHOT_ID,
    agent_id: snapshot.agentId,
    received_at: snapshot.receivedAt,
    count: snapshot.count,
    flagpoles: snapshot.flagpoles,
    updated_at: receivedAt
  };

  await supabaseService.request(
    `${SNAPSHOT_TABLE}?on_conflict=id`,
    {
      method: "POST",
      headers: {
        Prefer:
          "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(payload)
    }
  );

  return snapshot;
}

async function loadSnapshot() {
  try {
    const rows = await supabaseService.request(
      `${SNAPSHOT_TABLE}` +
        `?id=eq.${encodeURIComponent(SNAPSHOT_ID)}` +
        "&select=id,agent_id,received_at,count,flagpoles" +
        "&limit=1",
      {
        method: "GET"
      }
    );

    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return emptySnapshot();
    }

    const row = rows[0];

    const flagpoles = Array.isArray(row?.flagpoles)
      ? row.flagpoles
      : [];

    return {
      agentId:
        cleanText(row?.agent_id, 100) ||
        null,

      receivedAt:
        row?.received_at ||
        null,

      count:
        Number(row?.count) ||
        flagpoles.length ||
        0,

      flagpoles
    };
  } catch (error) {
    console.error(
      "[FLAGPOLES] Lecture snapshot Supabase impossible :",
      error?.message || error
    );

    return emptySnapshot();
  }
}

function distance2d(aX, aZ, bX, bZ) {
  return Math.hypot(
    Number(aX) - Number(bX),
    Number(aZ) - Number(bZ)
  );
}

function getCoordinates(row) {
  const x = finiteNumber(
    row?.center_x ??
      row?.centerX ??
      row?.x
  );

  const z = finiteNumber(
    row?.center_z ??
      row?.centerZ ??
      row?.z
  );

  return x === null || z === null
    ? null
    : { x, z };
}

function isValidatedZone(row) {
  const status = cleanText(
    row?.public_status ??
      row?.status ??
      row?.zone_status,
    40
  ).toLowerCase();

  return (
    !status ||
    status === "validated" ||
    status === "approved"
  );
}

function classifyFlagpoles(
  flagpoles,
  zones,
  requests
) {
  const zoneRows = Array.isArray(zones)
    ? zones
    : [];

  const requestRows = Array.isArray(requests)
    ? requests
    : [];

  const classified = (
    Array.isArray(flagpoles)
      ? flagpoles
      : []
  ).map((flagpole) => {
    let validatedMatch = null;
    let validatedDistance = Infinity;

    for (const zone of zoneRows) {
      if (!isValidatedZone(zone)) {
        continue;
      }

      const coordinates =
        getCoordinates(zone);

      if (!coordinates) {
        continue;
      }

      const radius = Math.min(
        60,
        Math.max(
          1,
          Number(
            zone?.radius_m ??
              zone?.radiusM ??
              60
          ) || 60
        )
      );

      const distance = distance2d(
        flagpole.x,
        flagpole.z,
        coordinates.x,
        coordinates.z
      );

      if (
        distance <= radius &&
        distance < validatedDistance
      ) {
        validatedDistance = distance;
        validatedMatch = zone;
      }
    }

    if (validatedMatch) {
      return {
        ...flagpole,
        state: "validated",
        matchType: "zone",
        matchId:
          validatedMatch.id || null,
        matchName:
          validatedMatch.public_name ||
          validatedMatch.request_name ||
          validatedMatch.owner_name ||
          "Base validée",
        distanceM:
          Math.round(
            validatedDistance * 10
          ) / 10
      };
    }

    let pendingMatch = null;
    let pendingDistance = Infinity;

    for (const request of requestRows) {
      const coordinates =
        getCoordinates(request);

      if (!coordinates) {
        continue;
      }

      const radius = Math.min(
        60,
        Math.max(
          1,
          Number(
            request?.radius_m ??
              request?.radiusM ??
              60
          ) || 60
        )
      );

      const distance = distance2d(
        flagpole.x,
        flagpole.z,
        coordinates.x,
        coordinates.z
      );

      if (
        distance <= radius &&
        distance < pendingDistance
      ) {
        pendingDistance = distance;
        pendingMatch = request;
      }
    }

    if (pendingMatch) {
      return {
        ...flagpole,
        state: "pending",
        matchType: "request",
        matchId:
          pendingMatch.id || null,
        matchName:
          pendingMatch.request_name ||
          "Demande en attente",
        distanceM:
          Math.round(
            pendingDistance * 10
          ) / 10
      };
    }

    return {
      ...flagpole,
      state: "orphan",
      matchType: null,
      matchId: null,
      matchName: null,
      distanceM: null
    };
  });

  return {
    flagpoles: classified,

    stats: {
      total: classified.length,

      validated:
        classified.filter(
          (item) =>
            item.state === "validated"
        ).length,

      pending:
        classified.filter(
          (item) =>
            item.state === "pending"
        ).length,

      orphan:
        classified.filter(
          (item) =>
            item.state === "orphan"
        ).length
    }
  };
}

module.exports = {
  saveSnapshot,
  loadSnapshot,
  classifyFlagpoles
};