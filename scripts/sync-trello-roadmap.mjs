#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'https://api.trello.com/1';
const DEFAULT_ROADMAP_PATH = 'docs/roadmap/roadmap.trello.json';

function parseArgs(argv) {
  const options = {
    roadmapPath: DEFAULT_ROADMAP_PATH,
    dryRun: false,
    validateOnly: false,
    createMissingLists: true,
    createMissingLabels: true,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--roadmap') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --roadmap');
      }
      options.roadmapPath = value;
      i += 1;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--validate-only') {
      options.validateOnly = true;
      continue;
    }

    if (arg === '--no-create-lists') {
      options.createMissingLists = false;
      continue;
    }

    if (arg === '--no-create-labels') {
      options.createMissingLabels = false;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/sync-trello-roadmap.mjs [options]

Options:
  --roadmap <path>      Path to roadmap json (default: ${DEFAULT_ROADMAP_PATH})
  --dry-run             Read board data and show changes without writing
  --validate-only       Validate roadmap file only (no Trello API calls)
  --no-create-lists     Do not create missing lists
  --no-create-labels    Do not create missing labels
  --verbose             Print API operations
  --help, -h            Show this help

Environment variables:
  TRELLO_KEY            Trello API key
  TRELLO_TOKEN          Trello API token with read,write scope
  TRELLO_BOARD_URL      Optional board URL override
`);
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeDesc(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function formatCardName(cardSpec) {
  return cardSpec.id ? `[${cardSpec.id}] ${cardSpec.name}` : cardSpec.name;
}

function extractRoadmapId(cardName) {
  const match = /^\[([A-Za-z0-9_-]+)\]\s+/.exec(cardName || '');
  return match ? match[1] : null;
}

function idSetEqual(a, b) {
  const left = [...(a || [])].sort();
  const right = [...(b || [])].sort();
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function parseBoardShortLink(boardUrl) {
  const match = /trello\.com\/b\/([A-Za-z0-9]+)\//.exec(boardUrl || '');
  if (!match) {
    throw new Error(`Could not parse board short link from URL: ${boardUrl}`);
  }
  return match[1];
}

function uniqueItems(items) {
  const seen = new Set();
  const result = [];
  for (const rawItem of items || []) {
    const item = String(rawItem || '').trim();
    if (!item) {
      continue;
    }
    const key = normalizeText(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

async function loadRoadmapFile(roadmapPath) {
  const absolutePath = path.isAbsolute(roadmapPath)
    ? roadmapPath
    : path.resolve(process.cwd(), roadmapPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const data = JSON.parse(raw);
  return { absolutePath, data };
}

function validateRoadmap(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Roadmap data must be a JSON object');
  }

  if (!Array.isArray(data.lists) || data.lists.length === 0) {
    throw new Error("Roadmap must include a non-empty 'lists' array");
  }

  if (!Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error("Roadmap must include a non-empty 'cards' array");
  }

  const listNames = new Set();
  for (const list of data.lists) {
    const name = typeof list === 'string' ? list : list?.name;
    if (!name || typeof name !== 'string') {
      throw new Error('Each list must be a string or an object with a name');
    }
    const key = normalizeText(name);
    if (listNames.has(key)) {
      throw new Error(`Duplicated list name in roadmap: ${name}`);
    }
    listNames.add(key);
  }

  const cardIds = new Set();
  for (const card of data.cards) {
    if (!card.name || typeof card.name !== 'string') {
      throw new Error("Each card must have a string 'name'");
    }
    if (!card.list || typeof card.list !== 'string') {
      throw new Error(`Card '${card.name}' must define 'list'`);
    }
    if (!listNames.has(normalizeText(card.list))) {
      throw new Error(
        `Card '${card.name}' points to unknown list '${card.list}'`,
      );
    }
    if (card.id) {
      if (cardIds.has(card.id)) {
        throw new Error(`Duplicated card id in roadmap: ${card.id}`);
      }
      cardIds.add(card.id);
    }
  }
}

class TrelloClient {
  constructor({ key, token, dryRun, verbose }) {
    this.key = key;
    this.token = token;
    this.dryRun = dryRun;
    this.verbose = verbose;
  }

  async request(method, endpoint, query = {}) {
    const params = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(query).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      ),
      key: this.key,
      token: this.token,
    });

    if (this.verbose) {
      console.log(`[trello] ${method} ${endpoint}`);
    }

    if (this.dryRun && method !== 'GET') {
      console.log(`[dry-run] ${method} ${endpoint}`);
      return null;
    }

    const response = await fetch(`${API_BASE}${endpoint}?${params}`, {
      method,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Trello API error: ${method} ${endpoint} (${response.status}) ${responseText}`,
      );
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return response.text();
    }

    return response.json();
  }

  getBoard(shortLink) {
    return this.request('GET', `/boards/${shortLink}`, {
      fields: 'id,name,url',
    });
  }

  getBoardLists(boardId) {
    return this.request('GET', `/boards/${boardId}/lists`, {
      fields: 'id,name,pos,closed',
      filter: 'open',
    });
  }

  createList(boardId, name, pos = 'bottom') {
    return this.request('POST', '/lists', {
      idBoard: boardId,
      name,
      pos,
    });
  }

  getBoardLabels(boardId) {
    return this.request('GET', `/boards/${boardId}/labels`, {
      fields: 'id,name,color',
      limit: 1000,
    });
  }

  createLabel(boardId, name, color = 'blue') {
    return this.request('POST', '/labels', {
      idBoard: boardId,
      name,
      color,
    });
  }

  getBoardCards(boardId) {
    return this.request('GET', `/boards/${boardId}/cards`, {
      fields: 'id,name,desc,idList,idLabels,closed,url',
      filter: 'open',
    });
  }

  createCard({ idList, name, desc, idLabels }) {
    return this.request('POST', '/cards', {
      idList,
      name,
      desc,
      idLabels: idLabels.length > 0 ? idLabels.join(',') : undefined,
    });
  }

  updateCard(cardId, { idList, name, desc, idLabels }) {
    return this.request('PUT', `/cards/${cardId}`, {
      idList,
      name,
      desc,
      idLabels: idLabels.length > 0 ? idLabels.join(',') : '',
    });
  }

  getCardChecklists(cardId) {
    return this.request('GET', `/cards/${cardId}/checklists`, {
      fields: 'id,name',
      checkItems: 'all',
      checkItem_fields: 'id,name,state',
    });
  }

  createChecklist(cardId, name) {
    return this.request('POST', `/cards/${cardId}/checklists`, {
      name,
    });
  }

  createChecklistItem(checklistId, name) {
    return this.request('POST', `/checklists/${checklistId}/checkItems`, {
      name,
    });
  }
}

async function ensureLists(client, boardId, roadmap, options) {
  const lists = await client.getBoardLists(boardId);
  const byName = new Map(lists.map((item) => [normalizeText(item.name), item]));
  let created = 0;

  for (const rawListSpec of roadmap.lists) {
    const listSpec = typeof rawListSpec === 'string' ? { name: rawListSpec } : rawListSpec;
    const key = normalizeText(listSpec.name);
    const existing = byName.get(key);
    if (existing) {
      continue;
    }

    if (!options.createMissingLists) {
      throw new Error(
        `List '${listSpec.name}' does not exist on Trello board and list auto-create is disabled`,
      );
    }

    console.log(`Creating missing list: ${listSpec.name}`);
    const createdList = await client.createList(
      boardId,
      listSpec.name,
      listSpec.pos || 'bottom',
    );
    created += 1;

    if (createdList) {
      byName.set(key, createdList);
    } else {
      byName.set(key, { id: `dry-list-${key}`, name: listSpec.name });
    }
  }

  return { byName, created };
}

async function ensureLabels(client, boardId, roadmap, options) {
  const labelSpecs = Array.isArray(roadmap.labels) ? roadmap.labels : [];
  const labels = await client.getBoardLabels(boardId);
  const byName = new Map(
    labels
      .filter((item) => item.name)
      .map((item) => [normalizeText(item.name), item]),
  );
  let created = 0;

  for (const rawLabelSpec of labelSpecs) {
    const labelSpec = typeof rawLabelSpec === 'string' ? { name: rawLabelSpec } : rawLabelSpec;
    const key = normalizeText(labelSpec.name);
    if (!key) {
      continue;
    }

    const existing = byName.get(key);
    if (existing) {
      continue;
    }

    if (!options.createMissingLabels) {
      throw new Error(
        `Label '${labelSpec.name}' does not exist on Trello board and label auto-create is disabled`,
      );
    }

    console.log(`Creating missing label: ${labelSpec.name}`);
    const createdLabel = await client.createLabel(
      boardId,
      labelSpec.name,
      labelSpec.color || 'blue',
    );
    created += 1;

    if (createdLabel) {
      byName.set(key, createdLabel);
    } else {
      byName.set(key, { id: `dry-label-${key}`, name: labelSpec.name });
    }
  }

  return { byName, created };
}

async function syncChecklist(client, cardId, title, checklistItems) {
  const items = uniqueItems(checklistItems);
  if (items.length === 0) {
    return { createdChecklist: 0, createdItems: 0 };
  }

  const checklists = await client.getCardChecklists(cardId);
  let checklist = checklists.find(
    (item) => normalizeText(item.name) === normalizeText(title),
  );
  let createdChecklist = 0;

  if (!checklist) {
    checklist = await client.createChecklist(cardId, title);
    createdChecklist = 1;
  }

  const existingItems = new Set(
    (checklist.checkItems || []).map((item) => normalizeText(item.name)),
  );
  let createdItems = 0;
  for (const item of items) {
    if (existingItems.has(normalizeText(item))) {
      continue;
    }
    await client.createChecklistItem(checklist.id, item);
    createdItems += 1;
  }

  return { createdChecklist, createdItems };
}

async function syncCards(client, boardId, roadmap, mappings, options) {
  const cards = await client.getBoardCards(boardId);
  const byRoadmapId = new Map();
  const byName = new Map();

  for (const card of cards) {
    const roadmapId = extractRoadmapId(card.name);
    if (roadmapId && !byRoadmapId.has(roadmapId)) {
      byRoadmapId.set(roadmapId, card);
    }
    byName.set(normalizeText(card.name), card);
  }

  const counters = {
    createdCards: 0,
    updatedCards: 0,
    unchangedCards: 0,
    createdChecklists: 0,
    createdChecklistItems: 0,
  };

  for (const cardSpec of roadmap.cards) {
    const desiredName = formatCardName(cardSpec);
    const desiredDesc = normalizeDesc(cardSpec.desc || '');
    const desiredList = mappings.lists.get(normalizeText(cardSpec.list));

    if (!desiredList) {
      throw new Error(
        `Card '${desiredName}' points to missing mapped list '${cardSpec.list}'`,
      );
    }

    const desiredLabelIds = (cardSpec.labels || []).map((labelName) => {
      const label = mappings.labels.get(normalizeText(labelName));
      if (!label) {
        throw new Error(
          `Card '${desiredName}' references unknown label '${labelName}'`,
        );
      }
      return label.id;
    });

    let existingCard = null;
    if (cardSpec.id) {
      existingCard = byRoadmapId.get(cardSpec.id) || null;
    } else {
      existingCard = byName.get(normalizeText(desiredName)) || null;
    }

    let targetCard = existingCard;
    if (!targetCard) {
      console.log(`Creating card: ${desiredName}`);
      targetCard = await client.createCard({
        idList: desiredList.id,
        name: desiredName,
        desc: desiredDesc,
        idLabels: desiredLabelIds,
      });
      counters.createdCards += 1;
    } else {
      const hasNameChange = targetCard.name !== desiredName;
      const hasDescChange = normalizeDesc(targetCard.desc) !== desiredDesc;
      const hasListChange = targetCard.idList !== desiredList.id;
      const hasLabelChange = !idSetEqual(targetCard.idLabels, desiredLabelIds);

      if (hasNameChange || hasDescChange || hasListChange || hasLabelChange) {
        console.log(`Updating card: ${desiredName}`);
        await client.updateCard(targetCard.id, {
          idList: desiredList.id,
          name: desiredName,
          desc: desiredDesc,
          idLabels: desiredLabelIds,
        });
        counters.updatedCards += 1;
      } else {
        counters.unchangedCards += 1;
      }
    }

    const checklistItems = uniqueItems(cardSpec.checklist || []);
    if (checklistItems.length === 0) {
      continue;
    }

    const checklistTitle = cardSpec.checklistTitle || 'Checklist';
    if (options.dryRun) {
      console.log(
        `[dry-run] checklist sync for '${desiredName}' (${checklistItems.length} items)`,
      );
      continue;
    }

    if (!targetCard || !targetCard.id) {
      throw new Error(
        `Could not resolve created card id for checklist sync on '${desiredName}'`,
      );
    }

    const checklistResult = await syncChecklist(
      client,
      targetCard.id,
      checklistTitle,
      checklistItems,
    );
    counters.createdChecklists += checklistResult.createdChecklist;
    counters.createdChecklistItems += checklistResult.createdItems;
  }

  return counters;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { absolutePath, data: roadmap } = await loadRoadmapFile(
    options.roadmapPath,
  );

  validateRoadmap(roadmap);
  console.log(`Roadmap file loaded: ${absolutePath}`);
  console.log(
    `Roadmap stats: ${roadmap.lists.length} lists, ${roadmap.cards.length} cards`,
  );

  if (options.validateOnly) {
    console.log('Validation complete (no Trello API calls).');
    return;
  }

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error(
      'Missing Trello credentials. Set TRELLO_KEY and TRELLO_TOKEN environment variables.',
    );
  }

  const boardUrl =
    process.env.TRELLO_BOARD_URL || roadmap.boardUrl || roadmap.meta?.boardUrl;
  if (!boardUrl) {
    throw new Error(
      'Missing board URL. Set TRELLO_BOARD_URL or provide boardUrl in roadmap file.',
    );
  }

  const boardShortLink = parseBoardShortLink(boardUrl);
  const client = new TrelloClient({
    key,
    token,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  const board = await client.getBoard(boardShortLink);
  console.log(`Connected to Trello board: ${board.name} (${board.url})`);

  const listResult = await ensureLists(client, board.id, roadmap, options);
  const labelResult = await ensureLabels(client, board.id, roadmap, options);

  const cardResult = await syncCards(
    client,
    board.id,
    roadmap,
    { lists: listResult.byName, labels: labelResult.byName },
    options,
  );

  console.log('Sync summary:');
  console.log(`- Lists created: ${listResult.created}`);
  console.log(`- Labels created: ${labelResult.created}`);
  console.log(`- Cards created: ${cardResult.createdCards}`);
  console.log(`- Cards updated: ${cardResult.updatedCards}`);
  console.log(`- Cards unchanged: ${cardResult.unchangedCards}`);
  console.log(`- Checklists created: ${cardResult.createdChecklists}`);
  console.log(`- Checklist items created: ${cardResult.createdChecklistItems}`);

  if (options.dryRun) {
    console.log('Dry-run completed. No Trello write operations were executed.');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
