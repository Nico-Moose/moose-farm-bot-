const { getDb } = require('./dbService');
const { getProfileByLogin, logFarmEvent } = require('./userService');
const { sendEvent: sendLootOverlayEvent } = require('./lootOverlayBus');

const PLAYER_ALLOWED_AMOUNTS = [100, 200, 300, 500];
const PROMO_CODE = 'nico_moose';
const PROMO_AMOUNT = 149;
const HISTORY_LIMIT = 200;

function toInt(value, defVal = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : defVal;
}

function trimText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeUser(value) {
  return String(value || '').replace(/^@/, '').trim().toLowerCase();
}

function normalizeItemName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9.]+/gi, '')
    .trim();
}

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_) {
    return fallback;
  }
}

function nowFormatted() {
  const d = new Date();
  d.setHours(d.getHours() + 3);
  return String(d.getDate()).padStart(2, '0') + '.' +
    String(d.getMonth() + 1).padStart(2, '0') + '.' +
    d.getFullYear() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

function getLootPool(amount) {
  if (amount === 100) {
    return {
      caseName: 'БАЗОВЫЙ КЕЙС',
      items: [
        { id: 'bolt_jagger', label: 'Bolt + Jagger', rarity: 'rare', visualLevel: 2 },
        { id: 'l96_jagger', label: 'L96 + Jagger', rarity: 'rare', visualLevel: 2 },
        { id: 'smoke6_m4', label: 'Smoke x6 + M4', rarity: 'rare', visualLevel: 2 },
        { id: 'm249', label: 'M249', rarity: 'legendary', visualLevel: 4 }
      ]
    };
  }
  if (amount === 200) {
    return {
      caseName: 'УЛУЧШЕННЫЙ КЕЙС',
      items: [
        { id: 'bolt_silencer_jagger_inc16', label: 'Bolt + Silencer + Jagger + Incendiary 5.56 x16', rarity: 'epic', visualLevel: 3 },
        { id: 'l96_silencer_jagger_inc16', label: 'L96 + Silencer + Jagger + Incendiary 5.56 x16', rarity: 'epic', visualLevel: 3 },
        { id: 'smoke12_m4_silencer', label: 'Smoke x12 + M4 + Silencer', rarity: 'epic', visualLevel: 3 },
        { id: 'm249_jagger', label: 'M249 + Jagger', rarity: 'legendary', visualLevel: 4 }
      ]
    };
  }
  if (amount === 300) {
    return {
      caseName: 'ЭПИК КЕЙС',
      items: [
        { id: 'bolt2_silencer2_jagger2_inc32', label: 'Bolt x2 + Silencer x2 + Jagger x2 + Incendiary 5.56 x32', rarity: 'legendary', visualLevel: 4 },
        { id: 'l96_2_silencer2_jagger2_inc32', label: 'L96 x2 + Silencer x2 + Jagger x2 + Incendiary 5.56 x32', rarity: 'legendary', visualLevel: 4 },
        { id: 'smoke18_m4_2_silencer2', label: 'Smoke x18 + M4 x2 + Silencer x2', rarity: 'legendary', visualLevel: 4 },
        { id: 'm249_jagger_silencer', label: 'M249 + Jagger + Silencer', rarity: 'mythic', visualLevel: 5 },
        { id: 'drone2_mlrs1', label: 'Drone x2 + MLRS x1', rarity: 'mythic', visualLevel: 5 }
      ]
    };
  }
  if (amount === 500) {
    return {
      caseName: 'ЛЕГЕНДАРНЫЙ КЕЙС',
      items: [
        { id: 'bolt3_silencer3_jagger3_inc64', label: 'Bolt x3 + Silencer x3 + Jagger x3 + Incendiary 5.56 x64', rarity: 'mythic', visualLevel: 5 },
        { id: 'l96_3_silencer3_jagger3_inc64', label: 'L96 x3 + Silencer x3 + Jagger x3 + Incendiary 5.56 x64', rarity: 'mythic', visualLevel: 5 },
        { id: 'smoke18_m4_3_silencer3', label: 'Smoke x18 + M4 x3 + Silencer x3', rarity: 'mythic', visualLevel: 5 },
        { id: 'm249_2_jagger2_silencer2', label: 'M249 x2 + Jagger x2 + Silencer x2', rarity: 'mythic', visualLevel: 5 },
        { id: 'drone5_mlrs2', label: 'Drone x5 + MLRS x2', rarity: 'mythic', visualLevel: 5 }
      ]
    };
  }
  return null;
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function parsePrizeLabel(label) {
  const text = trimText(label);
  if (!text) return [];
  return text.split(/\s+\+\s+/).map((part) => trimText(part)).filter(Boolean).map((part) => {
    const m = part.match(/^(.*?)(?:\s+x(\d+))?$/i);
    if (!m) return { name: part, count: 1 };
    const name = trimText(m[1]) || part;
    const count = Math.max(1, toInt(m[2], 1));
    return { name, count };
  });
}

function formatPrizeLabel(parts, keepSingleCompact = false) {
  return (parts || [])
    .map((part) => ({ name: trimText(part?.name), count: toInt(part?.count, 0) }))
    .filter((part) => part.name && part.count > 0)
    .map((part) => (keepSingleCompact && part.count === 1 ? part.name : `${part.name} x${part.count}`))
    .join(' + ');
}

function mergePrizeLabels(labelA, labelB) {
  const order = [];
  const map = new Map();
  function add(label) {
    for (const part of parsePrizeLabel(label)) {
      const key = part.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: part.name, count: 0 });
        order.push(key);
      }
      map.get(key).count += part.count;
    }
  }
  add(labelA);
  add(labelB);
  return formatPrizeLabel(order.map((key) => map.get(key)), true);
}

function resolveItemAlias(value) {
  const key = normalizeItemName(value);
  const aliases = {
    'глушитель': 'silencer', 'глушак': 'silencer', 'сайл': 'silencer', 'сайленсер': 'silencer', 'silencer': 'silencer',
    'джаггер': 'jagger', 'jagger': 'jagger',
    'дрон': 'drone', 'drone': 'drone',
    'млрс': 'mlrs', 'mlrs': 'mlrs',
    'm249': 'm249', 'm2': 'm249',
    'l96': 'l96', 'l9': 'l96',
    'bolt': 'bolt', 'болт': 'bolt',
    'smoke': 'smoke', 'смок': 'smoke',
    'm4': 'm4',
    'inc': 'incendiary', 'incendiary': 'incendiary', 'зажига': 'incendiary'
  };
  return aliases[key] || key;
}

function isSpecialStackPart(name) {
  const n = normalizeItemName(name);
  return n.includes('mlrs') || n.includes('drone') || n.includes('incendiary');
}

function isRestrictedItemAlias(itemKey) {
  return itemKey === 'incendiary';
}

function getIdTakeCount(partName, partCount) {
  const key = normalizeItemName(partName);
  const count = Math.max(1, toInt(partCount, 1));
  if (key === 'smoke') return count >= 6 ? 6 : count;
  return 1;
}

function splitLootEntryLabel(label) {
  const parts = parsePrizeLabel(label);
  if (!parts.length) {
    return { canSplit: false, takeLabel: trimText(label), remainLabel: '', isFullTake: true };
  }

  const normalParts = [];
  const specialParts = [];
  for (const part of parts) {
    if (isSpecialStackPart(part.name)) specialParts.push({ ...part });
    else normalParts.push({ ...part });
  }

  if (!normalParts.length) {
    return { canSplit: false, takeLabel: formatPrizeLabel(parts), remainLabel: '', isFullTake: true };
  }

  const takeParts = [];
  const remainParts = [];
  for (const part of normalParts) {
    const takeCount = getIdTakeCount(part.name, part.count);
    const remainCount = part.count - takeCount;
    if (takeCount > 0) takeParts.push({ name: part.name, count: takeCount });
    if (remainCount > 0) remainParts.push({ name: part.name, count: remainCount });
  }
  for (const part of specialParts) takeParts.push({ name: part.name, count: part.count });

  return {
    canSplit: true,
    takeLabel: formatPrizeLabel(takeParts),
    remainLabel: formatPrizeLabel(remainParts),
    isFullTake: remainParts.length === 0
  };
}

function matchItemKey(partName, wantedKey) {
  const currentKey = normalizeItemName(partName);
  const resolvedCurrent = resolveItemAlias(currentKey);
  return resolvedCurrent === wantedKey || currentKey.includes(wantedKey) || resolvedCurrent.includes(wantedKey);
}

function takeSpecificItemFromLabel(label, wantedName, wantedAmount, options = {}) {
  const parts = parsePrizeLabel(label);
  const wantedKey = resolveItemAlias(wantedName);
  let amount = Math.max(1, toInt(wantedAmount, 1));
  if (!parts.length || !wantedKey) return { ok: false };
  if (!options.allowRestricted && isRestrictedItemAlias(wantedKey)) return { ok: false, restricted: true };

  const idx = parts.findIndex((part) => matchItemKey(part.name, wantedKey));
  if (idx === -1) return { ok: false };

  const target = { ...parts[idx] };
  const available = toInt(target.count, 0);
  if (available <= 0) return { ok: false, foundName: target.name, available: 0 };
  if (amount > available) amount = available;

  const takenLabel = `${trimText(target.name)} x${amount}`;
  const remainCount = available - amount;
  if (remainCount > 0) parts[idx].count = remainCount;
  else parts.splice(idx, 1);

  return {
    ok: true,
    takenLabel,
    remainLabel: formatPrizeLabel(parts),
    isFullTake: parts.length === 0,
    foundName: target.name,
    availableBefore: available
  };
}

function parseTakeRequest(raw) {
  const text = trimText(raw).toLowerCase();
  if (!text) return { mode: 'invalid' };
  if (text === 'последний' || text === 'last') return { mode: 'last' };
  if (/^\d+$/.test(text)) return { mode: 'id', entryId: toInt(text, 0) };
  const parts = text.split(/\s+/);
  let amount = 1;
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) amount = Math.max(1, toInt(parts.pop(), 1));
  const itemName = trimText(parts.join(' '));
  if (!itemName) return { mode: 'invalid' };
  const itemKey = resolveItemAlias(itemName);
  if (itemKey === 'smoke' && amount === 1 && parts.length === 1) amount = 6;
  return { mode: 'item', itemName, itemKey, amount };
}

function findItemInEntryParts(parts, wantedKey) {
  for (let i = 0; i < parts.length; i += 1) {
    if (matchItemKey(parts[i].name, wantedKey)) return i;
  }
  return -1;
}

function findEntryByRequestedItem(userItems, itemKey, amount) {
  if (isRestrictedItemAlias(itemKey)) return null;
  let fallbackMatch = null;
  for (let i = 0; i < userItems.length; i += 1) {
    const parts = parsePrizeLabel(userItems[i]?.prize_label || userItems[i]?.prizeLabel || '');
    const idx = findItemInEntryParts(parts, itemKey);
    if (idx === -1) continue;
    const cnt = toInt(parts[idx].count, 0);
    if (cnt >= amount) return { index: i, item: userItems[i], matchedPart: parts[idx] };
    if (itemKey === 'smoke' && cnt > 0 && !fallbackMatch) {
      fallbackMatch = { index: i, item: userItems[i], matchedPart: parts[idx] };
    }
  }
  return fallbackMatch;
}

function rowToItem(row) {
  return {
    entryId: Number(row.entry_id || 0),
    prizeId: row.prize_id || '',
    prizeLabel: row.prize_label || '',
    rarity: row.rarity || 'common',
    visualLevel: Number(row.visual_level || 1),
    donateSum: Number(row.donate_sum || 0),
    caseName: row.case_name || '',
    wonDate: row.won_date || '',
    status: row.status || 'stored',
    display: row.display_name || '',
    user: row.login || ''
  };
}

function getBalanceByTwitchId(twitchId) {
  const row = getDb().prepare('SELECT donate_balance FROM loot_balances WHERE twitch_id = ?').get(twitchId);
  return Number(row?.donate_balance || 0);
}

function setBalanceByTwitchId(twitchId, balance) {
  const safe = Math.max(0, toInt(balance, 0));
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO loot_balances (twitch_id, donate_balance, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(twitch_id) DO UPDATE SET donate_balance = excluded.donate_balance, updated_at = excluded.updated_at
  `).run(twitchId, safe, now);
  return safe;
}

function changeBalanceByTwitchId(twitchId, amount) {
  const next = Math.max(0, getBalanceByTwitchId(twitchId) + toInt(amount, 0));
  setBalanceByTwitchId(twitchId, next);
  return next;
}

function getInventoryRowsByTwitchId(twitchId) {
  return getDb().prepare(`
    SELECT entry_id, prize_id, prize_label, rarity, visual_level, donate_sum, case_name, won_date, status, updated_at
    FROM loot_inventory
    WHERE twitch_id = ?
    ORDER BY entry_id ASC
  `).all(twitchId);
}

function getNextEntryId(db) {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'loot_inventory_next_id'`).get();
  const next = Number(row?.value || 0) + 1;
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES ('loot_inventory_next_id', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(next), Date.now());
  return next;
}

function findMergeableEntry(userItems, entry) {
  return userItems.find((item) => String(item.prize_id || '').trim() === String(entry.prizeId || '').trim() && String(item.case_name || '').trim() === String(entry.caseName || '').trim());
}

function addInventoryEntryByTwitchId(twitchId, entry) {
  const db = getDb();
  const now = Date.now();
  const existing = findMergeableEntry(getInventoryRowsByTwitchId(twitchId), entry);
  if (existing) {
    const mergedPrizeLabel = mergePrizeLabels(existing.prize_label, entry.prizeLabel);
    const visualLevel = Math.max(toInt(existing.visual_level, 1), toInt(entry.visualLevel, 1));
    db.prepare(`
      UPDATE loot_inventory
      SET prize_label = ?, rarity = ?, visual_level = ?, donate_sum = ?, won_date = ?, status = 'stored', last_merged_at = ?, updated_at = ?
      WHERE twitch_id = ? AND entry_id = ?
    `).run(mergedPrizeLabel, entry.rarity || existing.rarity || 'common', visualLevel, toInt(entry.donateSum, 0), entry.wonDate, entry.wonDate, now, twitchId, existing.entry_id);
    return { entryId: Number(existing.entry_id), merged: true, prizeLabel: mergedPrizeLabel };
  }

  const entryId = getNextEntryId(db);
  db.prepare(`
    INSERT INTO loot_inventory (
      twitch_id, entry_id, prize_id, prize_label, rarity, visual_level, donate_sum, case_name, won_date, status, created_at, updated_at, last_merged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?, ?, ?)
  `).run(
    twitchId,
    entryId,
    entry.prizeId || '',
    entry.prizeLabel || 'Неизвестный предмет',
    entry.rarity || 'common',
    Math.max(1, toInt(entry.visualLevel, 1)),
    Math.max(0, toInt(entry.donateSum, 0)),
    entry.caseName || '',
    entry.wonDate || nowFormatted(),
    now,
    now,
    entry.wonDate || nowFormatted()
  );
  return { entryId, merged: false, prizeLabel: entry.prizeLabel };
}

function getTakeHistoryByTwitchId(twitchId, limit = 20) {
  return getDb().prepare(`
    SELECT entry_id, prize_id, prize_label, donate_sum, case_name, won_date, taken_date, restored, rarity, visual_level
    FROM loot_taken_history
    WHERE twitch_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(twitchId, limit).map((row) => ({
    entryId: Number(row.entry_id || 0),
    prizeId: row.prize_id || '',
    prizeLabel: row.prize_label || '',
    donateSum: Number(row.donate_sum || 0),
    caseName: row.case_name || '',
    wonDate: row.won_date || '',
    takenDate: row.taken_date || '',
    restored: !!row.restored,
    rarity: row.rarity || 'common',
    visualLevel: Number(row.visual_level || 1)
  }));
}


function buildLootSnapshotForTwitchId(twitchId) {
  const balance = getBalanceByTwitchId(twitchId);
  const inventoryRows = getInventoryRowsByTwitchId(twitchId);
  return {
    donateBalance: balance,
    inventoryCount: inventoryRows.length,
    inventory: inventoryRows.map(rowToItem),
    recentTakes: getTakeHistoryByTwitchId(twitchId, 6),
    allowedCaseAmounts: PLAYER_ALLOWED_AMOUNTS.slice(),
    promoCodeHint: PROMO_CODE
  };
}

function getRarityWeight(rarity) {
  const key = String(rarity || '').toLowerCase();
  const map = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  return map[key] || 1;
}

function buildCombinedCaseName(caseNames) {
  const values = Array.from(new Set((caseNames || []).map((value) => trimText(value)).filter(Boolean)));
  if (!values.length) return 'ЛУТ';
  if (values.length === 1) return values[0];
  return 'СБОР ИЗ НЕСКОЛЬКИХ КЕЙСОВ';
}

function normalizeBulkSelections(rawSelections) {
  if (!Array.isArray(rawSelections)) return [];
  const result = [];
  const merged = new Map();

  for (const raw of rawSelections) {
    const entryId = toInt(raw?.entryId, 0);
    const itemName = trimText(raw?.itemName || raw?.name || '');
    const amount = Math.max(1, toInt(raw?.amount || raw?.count || 1, 1));
    if (entryId <= 0 || !itemName) continue;
    const key = `${entryId}::${resolveItemAlias(itemName)}`;
    if (!merged.has(key)) {
      merged.set(key, { entryId, itemName, amount: 0 });
    }
    merged.get(key).amount += amount;
  }

  for (const item of merged.values()) result.push(item);
  return result;
}

function takeLootSelectionForUser(user, rawSelections) {
  const twitchId = user?.id;
  const login = normalizeUser(user?.login);
  const displayName = trimText(user?.display_name || user?.displayName || login || 'Игрок');
  if (!twitchId || !login) return { ok: false, error: 'not_logged_in' };

  const selections = normalizeBulkSelections(rawSelections);
  if (!selections.length) return { ok: false, error: 'loot_selection_empty' };

  const db = getDb();
  const now = nowFormatted();
  let combinedPrizeLabel = '';
  let remainLabels = [];
  let isPartialTake = false;
  let maxVisualLevel = 1;
  let maxRarity = 'common';
  let maxRarityWeight = 1;
  let totalDonateSum = 0;
  let firstEntryId = 0;
  let firstWonDate = '';
  const caseNames = [];

  try {
    const transaction = db.transaction(() => {
      for (const selection of selections) {
        const row = db.prepare(`
          SELECT entry_id, prize_id, prize_label, rarity, visual_level, donate_sum, case_name, won_date, status, updated_at
          FROM loot_inventory
          WHERE twitch_id = ? AND entry_id = ?
        `).get(twitchId, selection.entryId);

        if (!row) {
          const error = new Error('inventory_entry_not_found');
          error.code = 'inventory_entry_not_found';
          throw error;
        }

        const takeResult = takeSpecificItemFromLabel(trimText(row.prize_label || ''), selection.itemName, selection.amount, { allowRestricted: true });
        if (!takeResult?.ok) {
          const error = new Error(takeResult?.restricted ? 'restricted_item_take' : 'inventory_item_not_found');
          error.code = error.message;
          throw error;
        }

        if (takeResult.isFullTake) {
          db.prepare('DELETE FROM loot_inventory WHERE twitch_id = ? AND entry_id = ?').run(twitchId, row.entry_id);
        } else {
          db.prepare('UPDATE loot_inventory SET prize_label = ?, updated_at = ? WHERE twitch_id = ? AND entry_id = ?').run(takeResult.remainLabel, Date.now(), twitchId, row.entry_id);
        }

        combinedPrizeLabel = combinedPrizeLabel ? mergePrizeLabels(combinedPrizeLabel, takeResult.takenLabel) : takeResult.takenLabel;
        if (takeResult.remainLabel) {
          remainLabels.push(`[${toInt(row.entry_id, 0)}] ${takeResult.remainLabel}`);
        }
        if (!takeResult.isFullTake) isPartialTake = true;
        if (!firstEntryId) firstEntryId = toInt(row.entry_id, 0);
        if (!firstWonDate) firstWonDate = row.won_date || '';
        caseNames.push(row.case_name || '');
        totalDonateSum += Math.max(0, toInt(row.donate_sum, 0));
        maxVisualLevel = Math.max(maxVisualLevel, Math.max(1, toInt(row.visual_level, 1)));
        const rarityWeight = getRarityWeight(row.rarity || 'common');
        if (rarityWeight > maxRarityWeight) {
          maxRarityWeight = rarityWeight;
          maxRarity = row.rarity || 'common';
        }
      }

      const caseName = buildCombinedCaseName(caseNames);
      db.prepare(`
        INSERT INTO loot_taken_history (
          twitch_id, login, display_name, entry_id, prize_id, prize_label, donate_sum, case_name, won_date, taken_date, rarity, visual_level, restored, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        twitchId,
        login,
        displayName,
        firstEntryId || 0,
        '',
        combinedPrizeLabel || 'Неизвестный предмет',
        totalDonateSum,
        caseName,
        firstWonDate || now,
        now,
        maxRarity,
        maxVisualLevel,
        Date.now()
      );
      db.prepare(`DELETE FROM loot_taken_history WHERE id NOT IN (SELECT id FROM loot_taken_history ORDER BY id DESC LIMIT ?)`).run(HISTORY_LIMIT);
    });

    transaction();
  } catch (error) {
    return { ok: false, error: error.code || error.message || 'loot_selection_take_failed' };
  }

  const caseName = buildCombinedCaseName(caseNames);
  const remainLabel = remainLabels.join(' · ');

  logFarmEvent(twitchId, 'loot_take_multi', {
    entryId: firstEntryId || 0,
    prizeLabel: combinedPrizeLabel,
    caseName,
    selectedCount: selections.length,
    partial: isPartialTake,
    remainLabel
  });

  sendLootOverlayEvent('loot_take', {
    user: login,
    display: displayName,
    prizeLabel: combinedPrizeLabel,
    caseName,
    rarity: maxRarity,
    visualLevel: maxVisualLevel,
    donateSum: totalDonateSum,
    entryId: firstEntryId || 0
  });

  return {
    ok: true,
    entryId: firstEntryId || 0,
    prizeLabel: combinedPrizeLabel,
    remainLabel,
    partial: isPartialTake,
    takenDate: now,
    caseName,
    selectedCount: selections.length,
    snapshot: buildLootSnapshotForTwitchId(twitchId)
  };
}


function awardDonateByLogin(login, amount, actorTwitchId = null) {
  const profile = getProfileByLogin(normalizeUser(login));
  if (!profile) return { ok: false, error: 'player_not_found' };
  const safeAmount = toInt(amount, 0);
  if (safeAmount <= 0) return { ok: false, error: 'invalid_amount' };
  const balance = changeBalanceByTwitchId(profile.twitch_id, safeAmount);
  if (actorTwitchId) {
    logFarmEvent(actorTwitchId, 'admin_loot_donate', { targetLogin: profile.login, amount: safeAmount, balance });
  }
  return { ok: true, profile, donateBalance: balance, amount: safeAmount };
}

function redeemPromoForUser(user, enteredCode) {
  const twitchId = user?.id;
  if (!twitchId) return { ok: false, error: 'not_logged_in' };
  if (trimText(enteredCode).toLowerCase() !== PROMO_CODE.toLowerCase()) return { ok: false, error: 'promo_invalid' };
  const db = getDb();
  const exists = db.prepare('SELECT twitch_id FROM loot_promo_redeemed WHERE twitch_id = ? AND code = ?').get(twitchId, PROMO_CODE);
  if (exists) return { ok: false, error: 'promo_already_redeemed' };
  const now = Date.now();
  db.prepare('INSERT INTO loot_promo_redeemed (twitch_id, code, amount, redeemed_at) VALUES (?, ?, ?, ?)').run(twitchId, PROMO_CODE, PROMO_AMOUNT, now);
  const donateBalance = changeBalanceByTwitchId(twitchId, PROMO_AMOUNT);
  logFarmEvent(twitchId, 'loot_promo_redeem', { code: PROMO_CODE, amount: PROMO_AMOUNT, donateBalance });
  return { ok: true, amount: PROMO_AMOUNT, donateBalance, code: PROMO_CODE };
}

async function openLootCaseForUser(user, amount) {
  const twitchId = user?.id;
  const login = normalizeUser(user?.login);
  const displayName = trimText(user?.display_name || user?.displayName || login || 'Игрок');
  const donateSum = toInt(amount, 0);
  if (!twitchId || !login) return { ok: false, error: 'not_logged_in' };
  if (!PLAYER_ALLOWED_AMOUNTS.includes(donateSum)) return { ok: false, error: 'invalid_loot_amount' };

  const lootData = getLootPool(donateSum);
  if (!lootData?.items?.length) return { ok: false, error: 'loot_pool_not_found' };

  const currentBalance = getBalanceByTwitchId(twitchId);
  if (currentBalance < 100) return { ok: false, error: 'loot_balance_too_low', available: currentBalance, needed: 100 };
  if (currentBalance < donateSum) return { ok: false, error: 'not_enough_loot_balance', available: currentBalance, needed: donateSum };

  setBalanceByTwitchId(twitchId, currentBalance - donateSum);
  const winner = pickRandom(lootData.items);
  if (!winner) return { ok: false, error: 'loot_pick_failed' };

  const now = nowFormatted();
  const inventoryEntry = {
    prizeId: winner.id,
    prizeLabel: winner.label,
    rarity: winner.rarity || 'common',
    visualLevel: winner.visualLevel || 1,
    donateSum,
    caseName: lootData.caseName,
    wonDate: now
  };
  const inventorySaveResult = addInventoryEntryByTwitchId(twitchId, inventoryEntry);
  logFarmEvent(twitchId, 'loot_case_open', {
    donateSum,
    caseName: lootData.caseName,
    entryId: inventorySaveResult.entryId,
    prizeId: winner.id,
    prizeLabel: inventorySaveResult.prizeLabel,
    merged: !!inventorySaveResult.merged,
    donateBalance: currentBalance - donateSum
  });

  sendLootOverlayEvent('loot_open', {
    user: login,
    display: displayName,
    donateSum,
    caseName: lootData.caseName,
    items: lootData.items,
    winner
  });


  return {
    ok: true,
    donateBalance: currentBalance - donateSum,
    entryId: inventorySaveResult.entryId,
    merged: !!inventorySaveResult.merged,
    prizeLabel: inventorySaveResult.prizeLabel,
    winner,
    caseName: lootData.caseName,
    donateSum,
    snapshot: buildLootSnapshotForTwitchId(twitchId)
  };
}

async function takeLootForUser(user, rawRequest) {
  const twitchId = user?.id;
  const login = normalizeUser(user?.login);
  const displayName = trimText(user?.display_name || user?.displayName || login || 'Игрок');
  if (!twitchId || !login) return { ok: false, error: 'not_logged_in' };

  const request = typeof rawRequest === 'string' ? parseTakeRequest(rawRequest) : rawRequest;
  if (request.mode === 'item' && isRestrictedItemAlias(request.itemKey)) {
    return { ok: false, error: 'restricted_item_take' };
  }

  const inventoryRows = getInventoryRowsByTwitchId(twitchId);
  if (!inventoryRows.length) return { ok: false, error: 'inventory_empty' };

  let foundIndex = -1;
  let foundItem = null;
  let manualItemTake = null;

  if (request.mode === 'last') {
    foundIndex = inventoryRows.length - 1;
    foundItem = inventoryRows[foundIndex];
  } else if (request.mode === 'id') {
    const requestedId = toInt(request.entryId, 0);
    if (requestedId <= 0) return { ok: false, error: 'invalid_take_request' };
    foundIndex = inventoryRows.findIndex((item) => toInt(item.entry_id, 0) === requestedId);
    foundItem = foundIndex >= 0 ? inventoryRows[foundIndex] : null;
    if (!foundItem) return { ok: false, error: 'inventory_entry_not_found', entryId: requestedId };
  } else if (request.mode === 'item') {
    const foundByItem = findEntryByRequestedItem(inventoryRows, request.itemKey, request.amount);
    if (!foundByItem?.item) return { ok: false, error: 'inventory_item_not_found', itemName: request.itemName, amount: request.amount };
    foundIndex = foundByItem.index;
    foundItem = foundByItem.item;
    manualItemTake = takeSpecificItemFromLabel(trimText(foundItem.prize_label || ''), request.itemName, request.amount);
    if (!manualItemTake?.ok) return { ok: false, error: manualItemTake?.restricted ? 'restricted_item_take' : 'take_failed' };
  } else {
    return { ok: false, error: 'invalid_take_request' };
  }

  const originalLabel = trimText(foundItem.prize_label || 'Неизвестный предмет');
  let takenLabel = originalLabel;
  let remainLabelAfterTake = '';
  let isPartialTake = false;
  const takenTime = nowFormatted();
  const db = getDb();

  if (manualItemTake?.ok) {
    takenLabel = manualItemTake.takenLabel || originalLabel;
    remainLabelAfterTake = manualItemTake.remainLabel || '';
    isPartialTake = !manualItemTake.isFullTake;
    if (manualItemTake.isFullTake) {
      db.prepare('DELETE FROM loot_inventory WHERE twitch_id = ? AND entry_id = ?').run(twitchId, foundItem.entry_id);
    } else {
      db.prepare('UPDATE loot_inventory SET prize_label = ?, updated_at = ? WHERE twitch_id = ? AND entry_id = ?').run(remainLabelAfterTake, Date.now(), twitchId, foundItem.entry_id);
    }
  } else {
    const splitResult = splitLootEntryLabel(originalLabel);
    takenLabel = splitResult.takeLabel || originalLabel;
    remainLabelAfterTake = splitResult.remainLabel || '';
    isPartialTake = splitResult.canSplit && !splitResult.isFullTake && !!splitResult.remainLabel;
    if (splitResult.canSplit && !splitResult.isFullTake && splitResult.remainLabel) {
      db.prepare('UPDATE loot_inventory SET prize_label = ?, updated_at = ? WHERE twitch_id = ? AND entry_id = ?').run(splitResult.remainLabel, Date.now(), twitchId, foundItem.entry_id);
    } else {
      db.prepare('DELETE FROM loot_inventory WHERE twitch_id = ? AND entry_id = ?').run(twitchId, foundItem.entry_id);
    }
  }

  db.prepare(`
    INSERT INTO loot_taken_history (
      twitch_id, login, display_name, entry_id, prize_id, prize_label, donate_sum, case_name, won_date, taken_date, rarity, visual_level, restored, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    twitchId,
    login,
    displayName,
    toInt(foundItem.entry_id, 0),
    foundItem.prize_id || '',
    takenLabel,
    toInt(foundItem.donate_sum, 0),
    foundItem.case_name || '',
    foundItem.won_date || '',
    takenTime,
    foundItem.rarity || 'common',
    Math.max(1, toInt(foundItem.visual_level, 1)),
    Date.now()
  );
  db.prepare(`DELETE FROM loot_taken_history WHERE id NOT IN (SELECT id FROM loot_taken_history ORDER BY id DESC LIMIT ?)` ).run(HISTORY_LIMIT);

  logFarmEvent(twitchId, 'loot_take', {
    entryId: toInt(foundItem.entry_id, 0),
    prizeId: foundItem.prize_id || '',
    prizeLabel: takenLabel,
    caseName: foundItem.case_name || '',
    partial: isPartialTake,
    remainLabel: remainLabelAfterTake || ''
  });

  sendLootOverlayEvent('loot_take', {
    user: login,
    display: displayName,
    prizeLabel: takenLabel,
    caseName: foundItem.case_name || '',
    rarity: foundItem.rarity || 'common',
    visualLevel: Math.max(1, toInt(foundItem.visual_level, 1)),
    donateSum: toInt(foundItem.donate_sum, 0),
    entryId: toInt(foundItem.entry_id, 0)
  });


  return {
    ok: true,
    entryId: toInt(foundItem.entry_id, 0),
    prizeId: foundItem.prize_id || '',
    prizeLabel: takenLabel,
    remainLabel: remainLabelAfterTake,
    partial: isPartialTake,
    takenDate: takenTime,
    caseName: foundItem.case_name || '',
    snapshot: buildLootSnapshotForTwitchId(twitchId)
  };
}

function rollbackLastTakeByLogin(login, actorTwitchId = null) {
  const profile = getProfileByLogin(normalizeUser(login));
  if (!profile) return { ok: false, error: 'player_not_found' };
  const db = getDb();
  const lastTake = db.prepare(`
    SELECT id, twitch_id, entry_id, prize_id, prize_label, donate_sum, case_name, won_date, taken_date, rarity, visual_level
    FROM loot_taken_history
    WHERE twitch_id = ? AND restored = 0
    ORDER BY id DESC
    LIMIT 1
  `).get(profile.twitch_id);
  if (!lastTake) return { ok: false, error: 'take_not_found' };

  const existing = db.prepare('SELECT entry_id, prize_label FROM loot_inventory WHERE twitch_id = ? AND entry_id = ?').get(profile.twitch_id, toInt(lastTake.entry_id, 0));
  let entryId = toInt(lastTake.entry_id, 0);
  let mergedBack = false;

  if (existing) {
    const mergedLabel = mergePrizeLabels(existing.prize_label, lastTake.prize_label);
    db.prepare('UPDATE loot_inventory SET prize_label = ?, updated_at = ? WHERE twitch_id = ? AND entry_id = ?').run(mergedLabel, Date.now(), profile.twitch_id, entryId);
    mergedBack = true;
  } else {
    db.prepare(`
      INSERT INTO loot_inventory (
        twitch_id, entry_id, prize_id, prize_label, rarity, visual_level, donate_sum, case_name, won_date, status, created_at, updated_at, last_merged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stored', ?, ?, ?)
    `).run(
      profile.twitch_id,
      entryId,
      lastTake.prize_id || '',
      lastTake.prize_label || 'Неизвестный предмет',
      lastTake.rarity || 'common',
      Math.max(1, toInt(lastTake.visual_level, 1)),
      toInt(lastTake.donate_sum, 0),
      lastTake.case_name || '',
      lastTake.won_date || nowFormatted(),
      Date.now(),
      Date.now(),
      lastTake.won_date || nowFormatted()
    );
  }

  db.prepare('UPDATE loot_taken_history SET restored = 1, restored_at = ? WHERE id = ?').run(Date.now(), lastTake.id);
  if (actorTwitchId) {
    logFarmEvent(actorTwitchId, 'admin_loot_rollback', {
      targetLogin: profile.login,
      entryId,
      prizeLabel: lastTake.prize_label,
      mergedBack
    });
  }
  return {
    ok: true,
    profile,
    entryId,
    prizeLabel: lastTake.prize_label,
    mergedBack,
    snapshot: buildLootSnapshotForTwitchId(profile.twitch_id)
  };
}

module.exports = {
  PLAYER_ALLOWED_AMOUNTS,
  PROMO_CODE,
  PROMO_AMOUNT,
  parseTakeRequest,
  buildLootSnapshotForTwitchId,
  awardDonateByLogin,
  redeemPromoForUser,
  openLootCaseForUser,
  takeLootForUser,
  takeLootSelectionForUser,
  rollbackLastTakeByLogin
};
