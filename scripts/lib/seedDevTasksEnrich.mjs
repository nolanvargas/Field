/**
 * Enrich Sandbocks dev task seeds: status history, attachments, crew events,
 * cancelled metadata, and bulk generated tasks for richer local testing.
 */
import { pickSeedStorageKey } from "./seedStorage.mjs";

/** @typedef {import('../seed-dev-tasks.mjs').SeedTask} SeedTask */

/** @param {string} iso @param {number} minutes */
export function addMinutes(iso, minutes) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

/** @param {string} iso @param {number} days */
export function addDaysIso(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Deterministic mix — stable across runs for the same seed id. */
function seedMix(seed, salt) {
  return ((seed * 1103515245 + salt * 12345) >>> 0) % 10000;
}

/** @param {string} focusDayKey */
function heatmapSeedFromFocusDay(focusDayKey) {
  const compact = focusDayKey.replaceAll("-", "");
  return Number.parseInt(compact, 10) || 20260911;
}

/** @param {number} seed @param {number} salt @param {number} min @param {number} max */
function seededRandInt(seed, salt, min, max) {
  const span = max - min + 1;
  return min + (seedMix(seed, salt) % span);
}

/** Fisher–Yates shuffle (deterministic). @param {number[]} items @param {number} seed */
function seededShuffle(items, seed) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = seedMix(seed, 400 + i) % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** @param {string} key YYYY-MM-DD */
function parseCalendarDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** @param {Date} date */
function formatCalendarDayKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 6-week Sun-start grid covering the month of `focusDayKey` (matches TaskMonthView).
 * @param {string} focusDayKey
 * @returns {string[]}
 */
export function monthGridDayKeys(focusDayKey) {
  const focus = parseCalendarDayKey(focusDayKey);
  const year = focus.getFullYear();
  const month = focus.getMonth();
  const gridStart = new Date(year, month, 1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  /** @type {string[]} */
  const keys = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    keys.push(formatCalendarDayKey(d));
  }
  return keys;
}

/** @param {string} iso */
export function pacificDayKeyFromIso(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const HEATMAP_SUNDAY_MIN = 0;
const HEATMAP_SUNDAY_MAX = 2;
const HEATMAP_SATURDAY_MIN = 3;
const HEATMAP_SATURDAY_MAX = 7;
const HEATMAP_WEEKDAY_MIN = 10;

/** @param {string} key */
function heatmapCountFloor(key) {
  const dow = parseCalendarDayKey(key).getDay();
  if (dow === 0) return HEATMAP_SUNDAY_MIN;
  if (dow === 6) return HEATMAP_SATURDAY_MIN;
  return HEATMAP_WEEKDAY_MIN;
}

/**
 * Deterministic per-day task counts for the month-grid heatmap:
 * - Sundays: rand(0–2)
 * - Saturdays: rand(3–7)
 * - Mon–Fri: random split of the remainder, min 10 each
 * @param {string} focusDayKey
 * @param {number} totalTarget
 * @param {Map<string, number>} [baseByDay]
 * @returns {Map<string, number>}
 */
export function buildHeatmapDayTargets(focusDayKey, totalTarget, baseByDay = new Map()) {
  const gridKeys = monthGridDayKeys(focusDayKey);
  /** @type {string[]} */
  const sundayKeys = [];
  /** @type {string[]} */
  const saturdayKeys = [];
  /** @type {string[]} */
  const monFriKeys = [];
  for (const key of gridKeys) {
    const dow = parseCalendarDayKey(key).getDay();
    if (dow === 0) sundayKeys.push(key);
    else if (dow === 6) saturdayKeys.push(key);
    else monFriKeys.push(key);
  }
  if (
    sundayKeys.length !== 6 ||
    saturdayKeys.length !== 6 ||
    monFriKeys.length !== 30
  ) {
    throw new Error(
      `Expected 6 Sun / 6 Sat / 30 Mon–Fri in month grid, got ${sundayKeys.length}/${saturdayKeys.length}/${monFriKeys.length}`,
    );
  }

  const seed = heatmapSeedFromFocusDay(focusDayKey);
  const sundayCounts = sundayKeys.map((_, index) =>
    seededRandInt(seed, index, HEATMAP_SUNDAY_MIN, HEATMAP_SUNDAY_MAX),
  );
  const saturdayCounts = saturdayKeys.map((_, index) =>
    seededRandInt(seed, 20 + index, HEATMAP_SATURDAY_MIN, HEATMAP_SATURDAY_MAX),
  );
  const weekendSum =
    sundayCounts.reduce((sum, value) => sum + value, 0) +
    saturdayCounts.reduce((sum, value) => sum + value, 0);
  const weekdayBudget = totalTarget - weekendSum;
  const weekdayMinSum = monFriKeys.length * HEATMAP_WEEKDAY_MIN;
  if (weekdayBudget < weekdayMinSum) {
    throw new Error(
      `Heatmap weekday budget ${weekdayBudget} too small for ${monFriKeys.length} days at min ${HEATMAP_WEEKDAY_MIN}`,
    );
  }

  const weekdayCounts = allocateRandomWeekdayCounts(
    monFriKeys.length,
    weekdayBudget,
    HEATMAP_WEEKDAY_MIN,
    seed,
  );
  seededShuffle(weekdayCounts, seed);

  /** @type {Map<string, number>} */
  const targets = new Map();
  for (const [index, key] of sundayKeys.entries()) {
    targets.set(key, sundayCounts[index]);
  }
  for (const [index, key] of saturdayKeys.entries()) {
    targets.set(key, saturdayCounts[index]);
  }
  for (const [index, key] of monFriKeys.entries()) {
    targets.set(key, weekdayCounts[index]);
  }

  for (const key of gridKeys) {
    const base = baseByDay.get(key) ?? 0;
    if (base > (targets.get(key) ?? 0)) {
      targets.set(key, base);
    }
  }

  rebalanceHeatmapTargets(targets, gridKeys, baseByDay, totalTarget);

  const sum = [...targets.values()].reduce((a, b) => a + b, 0);
  if (sum !== totalTarget) {
    throw new Error(
      `Heatmap day targets sum to ${sum}, expected ${totalTarget}`,
    );
  }
  return targets;
}

/**
 * @param {number} slotCount
 * @param {number} budget
 * @param {number} minValue
 * @param {number} seed
 * @returns {number[]}
 */
function allocateRandomWeekdayCounts(slotCount, budget, minValue, seed) {
  /** @type {number[]} */
  const counts = Array(slotCount).fill(minValue);
  let remaining = budget - minValue * slotCount;
  if (remaining < 0) {
    throw new Error(
      `Weekday budget ${budget} below minimum ${minValue * slotCount}`,
    );
  }

  const weights = counts.map((_, index) => 1 + (seedMix(seed, 100 + index) % 100));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < slotCount; index++) {
    counts[index] += Math.floor((remaining * weights[index]) / weightSum);
  }

  normalizeCountList(counts, budget, minValue);

  let guard = 0;
  while (guard < slotCount * (budget + 500)) {
    const sum = counts.reduce((a, b) => a + b, 0);
    const delta = budget - sum;
    if (delta === 0) return counts;
    const index = seedMix(seed, 300 + guard) % slotCount;
    if (delta > 0) {
      counts[index] += 1;
    } else if (counts[index] > minValue) {
      counts[index] -= 1;
    }
    guard += 1;
  }

  throw new Error("Failed to allocate random weekday heatmap counts");
}

/**
 * @param {Map<string, number>} targets
 * @param {string[]} gridKeys
 * @param {Map<string, number>} baseByDay
 * @param {number} totalTarget
 */
function rebalanceHeatmapTargets(targets, gridKeys, baseByDay, totalTarget) {
  let sum = [...targets.values()].reduce((a, b) => a + b, 0);
  let delta = totalTarget - sum;
  if (delta === 0) return;

  const slots = gridKeys.map((key) => ({
    key,
    floor: Math.max(heatmapCountFloor(key), baseByDay.get(key) ?? 0),
    target: targets.get(key) ?? 0,
  }));

  let guard = 0;
  while (delta !== 0 && guard < gridKeys.length * (Math.abs(delta) + 2000)) {
    const ordered = [...slots].sort((a, b) =>
      delta > 0 ? a.target - b.target : b.target - a.target,
    );
    let moved = false;
    for (const slot of ordered) {
      if (delta > 0) {
        slot.target += 1;
        targets.set(slot.key, slot.target);
        delta -= 1;
        moved = true;
        break;
      }
      if (slot.target > slot.floor) {
        slot.target -= 1;
        targets.set(slot.key, slot.target);
        delta += 1;
        moved = true;
        break;
      }
    }
    if (!moved) {
      throw new Error("Failed to rebalance heatmap day targets");
    }
    guard += 1;
  }

  if (delta !== 0) {
    throw new Error("Failed to rebalance heatmap day targets");
  }
}

/**
 * @param {number[]} counts mutated in place
 * @param {number} targetSum
 * @param {number} minValue
 */
function normalizeCountList(counts, targetSum, minValue) {
  let sum = counts.reduce((a, b) => a + b, 0);
  if (sum === targetSum) return;

  if (sum > targetSum) {
    const order = counts
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value);
    let cursor = 0;
    while (sum > targetSum) {
      const slot = order[cursor % order.length];
      if (counts[slot.index] > minValue) {
        counts[slot.index] -= 1;
        sum -= 1;
      }
      cursor += 1;
      if (cursor > counts.length * (sum - targetSum + 2000)) {
        throw new Error("Failed to reduce heatmap day counts to target sum");
      }
    }
    return;
  }

  const order = counts
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  let cursor = 0;
  while (sum < targetSum) {
    const slot = order[cursor % order.length];
    counts[slot.index] += 1;
    sum += 1;
    cursor += 1;
    if (cursor > counts.length * (targetSum - sum + 2000)) {
      throw new Error("Failed to raise heatmap day counts to target sum");
    }
  }
}

/** @param {SeedTask[]} tasks */
export function countSeedTasksByPacificDay(tasks) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const task of tasks) {
    if (!task.windowStart) continue;
    const key = pacificDayKeyFromIso(task.windowStart);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** @param {string} date YYYY-MM-DD @param {number} minutesFromMidnight */
function formatLocalDateTime(date, minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Snap to 15-minute increments for realistic scheduling. */
function roundToQuarterHour(minutes) {
  return Math.round(minutes / 15) * 15;
}

/**
 * Pick a varied task window for bulk seed data.
 * ~60% within 8am–3pm, ~30% extended to 5–8pm, ~10% random 2–7h anywhere in the day.
 * @param {string} date
 * @param {number} seed
 * @param {(local: string) => string} ptGridDay
 */
export function pickSeedTaskWindow(date, seed, ptGridDay) {
  const roll = seedMix(seed, 1) % 100;
  let startMin;
  let endMin;

  if (roll < 10) {
    const durationMin = (2 + (seedMix(seed, 2) % 6)) * 60;
    const dayStart = 6 * 60;
    const dayEnd = 21 * 60;
    const maxStart = dayEnd - durationMin;
    startMin = roundToQuarterHour(
      dayStart + (seedMix(seed, 3) % (maxStart - dayStart + 1)),
    );
    endMin = startMin + durationMin;
  } else if (roll < 40) {
    startMin = roundToQuarterHour(
      (7 + (seedMix(seed, 4) % 6)) * 60 + (seedMix(seed, 5) % 4) * 15,
    );
    endMin = roundToQuarterHour(
      (15 + (seedMix(seed, 6) % 6)) * 60 + (seedMix(seed, 7) % 4) * 15,
    );
    if (endMin <= startMin + 120) {
      endMin = roundToQuarterHour(startMin + 120 + (seedMix(seed, 8) % 180));
    }
  } else {
    startMin = roundToQuarterHour(
      (8 + (seedMix(seed, 9) % 4)) * 60 + (seedMix(seed, 10) % 4) * 15,
    );
    endMin = roundToQuarterHour(
      (12 + (seedMix(seed, 11) % 4)) * 60 + (seedMix(seed, 12) % 4) * 15,
    );
    if (endMin <= startMin + 60) {
      endMin = roundToQuarterHour(Math.min(15 * 60, startMin + 120));
    }
    endMin = Math.min(endMin, 15 * 60 + 45);
  }

  return {
    windowStart: ptGridDay(formatLocalDateTime(date, startMin)),
    windowEnd: ptGridDay(formatLocalDateTime(date, endMin)),
  };
}

/** @param {unknown} value */
function crewList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

/**
 * @param {number} dayOffset
 * @param {number} seed
 */
function statusForDayOffset(dayOffset, seed) {
  if (dayOffset <= -2) {
    const pool = ["Completed", "Completed", "Failed", "Cancelled", "Undetermined"];
    return pool[seed % pool.length];
  }
  if (dayOffset >= -1 && dayOffset <= 1) {
    const pool = [
      "In Progress",
      "Assigned",
      "Completed",
      "In Progress",
      "Assigned",
      "Completed",
    ];
    return pool[seed % pool.length];
  }
  const pool = ["Assigned", "Assigned", "Unassigned", "Assigned", "Unassigned"];
  return pool[seed % pool.length];
}

/**
 * @param {SeedTask} task
 * @param {string[]} crewIds
 */
function buildStatusHistory(task, crewIds) {
  /** @type {NonNullable<SeedTask['history']>} */
  const history = [];
  const actor = task.createdBy;

  if (crewIds.length > 0 && task.status !== "Unassigned") {
    history.push({
      eventType: "status_changed",
      actorUserId: actor,
      fromStatus: "Unassigned",
      toStatus: "Assigned",
      recordedAt: addMinutes(task.createdAt, 5 + (task.id % 20)),
    });
  }

  const activeStatuses = new Set([
    "In Progress",
    "Completed",
    "Failed",
    "Undetermined",
  ]);
  if (activeStatuses.has(task.status)) {
    const firstStart = (task.crewEvents ?? []).find((e) => e.type === "started");
    const at =
      firstStart?.at ??
      addMinutes(task.windowStart ?? task.createdAt, 10 + (task.id % 15));
    history.push({
      eventType: "status_changed",
      actorUserId: firstStart?.userId ?? crewIds[0] ?? actor,
      fromStatus: crewIds.length > 0 ? "Assigned" : "Unassigned",
      toStatus: "In Progress",
      recordedAt: at,
    });
  }

  if (task.status === "Completed") {
    history.push({
      eventType: "status_changed",
      actorUserId: crewIds[0] ?? actor,
      fromStatus: "In Progress",
      toStatus: "Completed",
      recordedAt: task.completedAt ?? task.updatedAt,
    });
  } else if (task.status === "Failed") {
    history.push({
      eventType: "status_changed",
      actorUserId: crewIds[0] ?? actor,
      fromStatus: "In Progress",
      toStatus: "Failed",
      recordedAt: task.completedAt ?? task.updatedAt,
      summary: task.failedReason ?? "Task failed",
    });
  } else if (task.status === "Undetermined") {
    history.push({
      eventType: "status_changed",
      actorUserId: crewIds[0] ?? actor,
      fromStatus: "In Progress",
      toStatus: "Undetermined",
      recordedAt: task.completedAt ?? task.updatedAt,
      summary: task.failedReason ?? "Mixed crew outcomes",
    });
  } else if (task.status === "Cancelled") {
    history.push({
      eventType: "status_changed",
      actorUserId: actor,
      fromStatus: crewIds.length > 0 ? "Assigned" : "Unassigned",
      toStatus: "Cancelled",
      recordedAt: task.cancelledAt ?? task.updatedAt,
      summary: "Task cancelled",
    });
  }

  return history;
}

/**
 * @param {SeedTask} task
 * @param {Record<string, string>} crew
 * @param {Record<number, { latitude?: number, longitude?: number }>} venueCoords
 */
function ensureCrewEvents(task, crew, venueCoords) {
  const crewIds = crewList(task.crew);
  if (crewIds.length === 0) return task.crewEvents ?? [];

  const events = [...(task.crewEvents ?? [])];
  const coords =
    task.destinationId != null ? venueCoords[task.destinationId] : null;
  const lat = coords?.latitude ?? 36.11;
  const lng = coords?.longitude ?? -115.17;

  const startedUsers = new Set(
    events.filter((e) => e.type === "started").map((e) => e.userId),
  );
  const endedUsers = new Set(
    events.filter((e) => e.type === "ended").map((e) => e.userId),
  );

  const needsStart = ["In Progress", "Completed", "Failed", "Undetermined"];
  const needsEnd = ["Completed", "Failed", "Undetermined"];

  if (needsStart.includes(task.status)) {
    for (const [index, userId] of crewIds.entries()) {
      if (startedUsers.has(userId)) continue;
      events.push({
        userId,
        type: "started",
        at: addMinutes(
          task.windowStart ?? task.createdAt,
          8 + index * 4 + (task.id % 5),
        ),
        lat: lat + index * 0.0001,
        lng: lng - index * 0.0001,
      });
    }
  }

  if (needsEnd.includes(task.status)) {
    const endAt = task.completedAt ?? task.updatedAt;
    for (const [index, userId] of crewIds.entries()) {
      if (endedUsers.has(userId)) continue;
      events.push({
        userId,
        type: "ended",
        at: addMinutes(endAt, -3 + index * 2),
        lat: lat + index * 0.0001,
        lng: lng - index * 0.0001,
      });
    }
  }

  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

/**
 * @param {SeedTask} task
 * @param {Record<string, string>} crew
 */
function minAttachments(task) {
  if (task.status === "Unassigned") return 0;
  if (task.status === "Assigned") {
    if (task.taskType === "Delivery" || task.taskType === "Install") return 1;
    return task.id % 2 === 0 ? 1 : 0;
  }
  if (task.status === "In Progress") return 1;
  if (task.status === "Failed" || task.status === "Undetermined") return 1;
  if (task.taskType === "Site Survey") return 2;
  if (task.taskType === "Delivery") return 2;
  if (task.taskType === "Install") return 2;
  return 1;
}

/** @param {SeedTask} task @param {Record<string, string>} crew */
function ensureAttachments(task, crew) {
  const crewIds = crewList(task.crew);
  const uploader = crewIds[0] ?? task.createdBy;
  const second = crewIds[1] ?? uploader;
  const baseAt =
    task.completedAt ??
    task.updatedAt ??
    addMinutes(task.windowStart ?? task.createdAt, 30);
  const existing = [...(task.attachments ?? [])];
  const target = minAttachments(task);
  if (existing.length >= target) return existing;

  /** @type {Array<{ kind: string, poolKind: string, mimeType: string, fileName: string, caption?: string }>} */
  const templates = [
    {
      kind: "photo",
      poolKind: "photo",
      mimeType: "image/jpeg",
      fileName: "site-photo.jpg",
      caption: "Site condition",
    },
    {
      kind: "photo",
      poolKind: "photo",
      mimeType: "image/jpeg",
      fileName: "proof-photo.jpg",
      caption: "Proof of work",
    },
    {
      kind: "document",
      poolKind: "document",
      mimeType: "application/pdf",
      fileName: "field-notes.pdf",
    },
    {
      kind: "signature",
      poolKind: "signature",
      mimeType: "image/gif",
      fileName: "signoff.gif",
      caption: "Customer sign-off",
    },
    {
      kind: "video",
      poolKind: "video",
      mimeType: "video/mp4",
      fileName: "walkthrough.mp4",
    },
  ];

  let i = 0;
  while (existing.length < target && i < templates.length) {
    const tpl = templates[i];
    existing.push({
      kind: tpl.kind,
      storageKey: pickSeedStorageKey(tpl.poolKind, task.id + i),
      mimeType: tpl.mimeType,
      fileName: tpl.fileName,
      caption: tpl.caption ?? null,
      uploadedBy: i % 2 === 0 ? uploader : second,
      at: addMinutes(baseAt, -20 + i * 5),
    });
    i += 1;
  }
  return existing;
}

/** @param {SeedTask} task */
function ensureDocuments(task) {
  const existing = [...(task.documents ?? [])];
  if (existing.length > 0) return existing;
  if (task.status !== "Completed" || task.taskType !== "Delivery") return existing;
  if (task.id % 10 >= 3) return existing;

  const generatedAt = task.completedAt ?? task.updatedAt;
  return [
    {
      kind: "delivery_docket",
      storageKey: pickSeedStorageKey("delivery_docket", task.id),
      fileName: `delivery-docket-${task.id}.pdf`,
      generatedAt,
      generatedBy: task.createdBy,
    },
    ...(task.id % 5 === 0
      ? [
          {
            kind: "pod",
            storageKey: pickSeedStorageKey("pod", task.id + 1),
            fileName: `pod-${task.id}.pdf`,
            generatedAt: addMinutes(generatedAt, 1),
            generatedBy: null,
          },
        ]
      : []),
  ];
}

/** @param {SeedTask} task @param {Record<string, string>} crew */
function ensureCompletionNotes(task, crew) {
  const crewIds = crewList(task.crew);
  if (crewIds.length === 0) return task.completionNotes ?? [];
  if ((task.completionNotes ?? []).length > 0) return task.completionNotes ?? [];

  const terminal = new Set(["Completed", "Failed", "Undetermined"]);
  if (!terminal.has(task.status)) return [];

  const outcome =
    task.status === "Completed"
      ? "Completed"
      : task.status === "Failed"
        ? "Failed"
        : crewIds.length > 1 && task.status === "Undetermined"
          ? /** @type {const} */ (["Completed", "Failed"])[task.id % 2]
          : "Failed";

  return crewIds.map((userId, index) => ({
    userId,
    outcome:
      task.status === "Undetermined" && crewIds.length > 1
        ? index === 0
          ? "Completed"
          : "Failed"
        : outcome,
    notes:
      index === 0
        ? (task.completedNotes ?? task.failedReason ?? null)
        : null,
  }));
}

/** @param {SeedTask} task @param {number} retentionDays */
function ensureCancelledFields(task, retentionDays) {
  if (task.status !== "Cancelled") {
    return {
      cancelledAt: null,
      statusBeforeCancel: null,
      archiveAt: null,
    };
  }
  const cancelledAt = task.cancelledAt ?? task.updatedAt;
  const statusBeforeCancel =
    task.statusBeforeCancel ??
    (crewList(task.crew).length > 0 ? "Assigned" : "Unassigned");
  return {
    cancelledAt,
    statusBeforeCancel,
    archiveAt: addDaysIso(cancelledAt, retentionDays),
  };
}

/**
 * @param {SeedTask} task
 * @param {{
 *   crew: Record<string, string>,
 *   venueCoords: Record<number, { latitude?: number, longitude?: number }>,
 *   retentionDays: number,
 * }} ctx
 * @returns {SeedTask}
 */
export function enrichSeedTask(task, ctx) {
  const crewIds = crewList(task.crew);
  const crewEvents = ensureCrewEvents(task, ctx.crew, ctx.venueCoords);
  const withEvents = { ...task, crewEvents };
  const attachments = ensureAttachments(withEvents, ctx.crew);
  const documents = ensureDocuments(withEvents);
  const completionNotes = ensureCompletionNotes(withEvents, ctx.crew);
  const cancelled = ensureCancelledFields(withEvents, ctx.retentionDays);
  const history =
    task.history ?? buildStatusHistory(withEvents, crewIds);

  return {
    ...withEvents,
    attachments,
    documents,
    completionNotes,
    history,
    ...cancelled,
  };
}

/**
 * @param {string} fromYmd
 * @param {string} toYmd
 */
function daysBetweenYmd(fromYmd, toYmd) {
  const from = parseCalendarDayKey(fromYmd);
  const to = parseCalendarDayKey(toYmd);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * @param {{
 *   ptGridDay: (local: string) => string,
 *   addDays: (ymd: string, days: number) => string,
 *   anchorDate: string,
 *   dayQuotas: Map<string, number>,
 *   crew: Record<string, string>,
 *   creators: Record<string, string>,
 *   venues: Record<string, number>,
 *   venueCoords: Record<number, { latitude?: number, longitude?: number }>,
 *   contacts: number[],
 *   startId: number,
 * }} ctx
 * @returns {SeedTask[]}
 */
export function generateBulkTasks(ctx) {
  const crewValues = Object.values(ctx.crew);
  const creatorValues = Object.values(ctx.creators);
  const venueIds = Object.values(ctx.venues);
  const types = [
    "Delivery",
    "Install",
    "Pickup",
    "Removal",
    "Site Survey",
    "Other",
  ];

  /** @type {string[]} */
  const dayAssignments = [];
  for (const [date, count] of [...ctx.dayQuotas.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (let n = 0; n < count; n++) {
      dayAssignments.push(date);
    }
  }

  /** @type {SeedTask[]} */
  const tasks = [];

  for (let i = 0; i < dayAssignments.length; i++) {
    const id = ctx.startId + i;
    const type = types[i % types.length];
    const date = dayAssignments[i];
    const dayOffset = daysBetweenYmd(ctx.anchorDate, date);
    const status = statusForDayOffset(dayOffset, id);
    const destinationId = venueIds[i % venueIds.length];
    const crewSize = status === "Unassigned" ? 0 : 1 + (i % 3);
    const crew =
      crewSize === 0
        ? []
        : Array.from({ length: crewSize }, (_, j) =>
            crewValues[(i + j) % crewValues.length],
          );
    const createdBy = creatorValues[i % creatorValues.length];
    const { windowStart, windowEnd } = pickSeedTaskWindow(
      date,
      id,
      ctx.ptGridDay,
    );
    const createdAt = addMinutes(windowStart, -120 - (i % 60));
    let updatedAt = addMinutes(windowStart, 30 + (i % 90));
    const isTerminal = ["Completed", "Failed", "Undetermined"].includes(status);
    const unassigned = status === "Unassigned";

    /** @type {SeedTask} */
    const task = {
      id,
      taskType: type,
      status,
      description:
        `${date.replace(/-/g, "").slice(4)}-AUTO-${id} - Generated ${type.toLowerCase()} seed\n` +
        `Auto-generated task for dev testing. Day offset ${dayOffset >= 0 ? "+" : ""}${dayOffset}.`,
      externalKey: String(99000 + id),
      createdBy,
      destinationId: unassigned && i % 5 === 0 ? null : destinationId,
      crewSize: unassigned ? null : crewSize,
      hours: 1 + (i % 4),
      isTimeSpecific: i % 4 === 0,
      canStartEarly: i % 2 === 0,
      windowStart,
      windowEnd,
      createdAt,
      updatedAt,
      crew,
      contacts:
        i % 3 === 0
          ? []
          : [
              {
                id: ctx.contacts[i % ctx.contacts.length],
                isPoc: true,
              },
            ],
    };

    if (isTerminal) {
      task.completedAt = addMinutes(windowEnd, -30 + (i % 20));
      task.updatedAt = task.completedAt;
      if (status === "Failed") {
        task.failedReason = "Generated failure for dev testing.";
      }
      if (status === "Completed") {
        task.completedNotes = "Auto-generated completion note.";
      }
      if (status === "Undetermined") {
        task.failedReason = "Mixed crew outcomes (generated).";
        task.completedNotes = "Partial completion on generated task.";
      }
    }

    if (status === "In Progress") {
      task.updatedAt = addMinutes(windowStart, 15 + (i % 30));
    }

    if (status === "Cancelled") {
      task.updatedAt = addMinutes(windowStart, -60 - (i % 30));
    }

    tasks.push(task);
  }

  return tasks;
}

/**
 * @param {SeedTask[]} baseTasks
 * @param {{
 *   crew: Record<string, string>,
 *   creators: Record<string, string>,
 *   venues: Record<string, number>,
 *   venueCoords: Record<number, { latitude?: number, longitude?: number }>,
 *   contacts: number[],
 *   pt: (local: string) => string,
 *   ptGridDay: (local: string) => string,
 *   addDays: (ymd: string, days: number) => string,
 *   anchorDate: string,
 *   focusDayKey: string,
 *   retentionDays?: number,
 *   bulkCount?: number,
 * }} ctx
 */
export function enrichAllSeedTasks(baseTasks, ctx) {
  const enrichCtx = {
    crew: ctx.crew,
    venueCoords: ctx.venueCoords,
    retentionDays: ctx.retentionDays ?? 7,
  };
  const bulkCount = ctx.bulkCount ?? 20;
  const totalTarget = baseTasks.length + bulkCount;
  const baseByDay = countSeedTasksByPacificDay(baseTasks);
  const gridKeySet = new Set(monthGridDayKeys(ctx.focusDayKey));
  let baseOffGrid = 0;
  for (const [key, count] of baseByDay) {
    if (!gridKeySet.has(key)) baseOffGrid += count;
  }
  const targets = buildHeatmapDayTargets(
    ctx.focusDayKey,
    totalTarget - baseOffGrid,
    baseByDay,
  );

  /** @type {Map<string, number>} */
  const dayQuotas = new Map();
  for (const [key, target] of targets) {
    const deficit = target - (baseByDay.get(key) ?? 0);
    if (deficit > 0) dayQuotas.set(key, deficit);
  }
  const plannedBulk = [...dayQuotas.values()].reduce((sum, n) => sum + n, 0);
  if (plannedBulk !== bulkCount) {
    throw new Error(
      `Heatmap bulk quota ${plannedBulk} does not match bulkCount ${bulkCount}`,
    );
  }

  const bulk = generateBulkTasks({
    ptGridDay: ctx.ptGridDay,
    addDays: ctx.addDays,
    anchorDate: ctx.anchorDate,
    dayQuotas,
    crew: ctx.crew,
    creators: ctx.creators,
    venues: ctx.venues,
    venueCoords: ctx.venueCoords,
    contacts: ctx.contacts,
    startId: baseTasks.length + 1,
  });
  return [...baseTasks, ...bulk].map((task) => enrichSeedTask(task, enrichCtx));
}
