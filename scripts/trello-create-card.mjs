#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
let cardName = null;
let cardDesc = null;
let listName = 'TODO';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name') cardName = args[i + 1];
  if (args[i] === '--desc') cardDesc = args[i + 1];
  if (args[i] === '--list') listName = args[i + 1];
}

if (!cardName) {
  console.error(
    "Usage: node scripts/trello-create-card.mjs --name '<Card Name>' [--desc '<Description>'] [--list '<ListName>']",
  );
  process.exit(1);
}

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const BOARD_URL = process.env.TRELLO_BOARD_URL;

if (!TRELLO_KEY || !TRELLO_TOKEN || !BOARD_URL) {
  console.error('Missing TRELLO_KEY, TRELLO_TOKEN, or TRELLO_BOARD_URL in .env');
  process.exit(1);
}

const BOARD_ID = BOARD_URL.split('/b/')[1].split('/')[0];

async function createCard() {
  try {
    const listsRes = await fetch(
      `https://api.trello.com/1/boards/${BOARD_ID}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    );
    const lists = await listsRes.json();
    const targetList = lists.find(
      (l) => l.name.toUpperCase() === listName.toUpperCase(),
    );

    if (!targetList) {
      console.error(`List "${listName}" not found on board.`);
      process.exit(1);
    }

    const params = new URLSearchParams({
      idList: targetList.id,
      name: cardName,
      key: TRELLO_KEY,
      token: TRELLO_TOKEN,
    });

    if (cardDesc) {
      params.append('desc', cardDesc);
    }

    const createRes = await fetch(
      `https://api.trello.com/1/cards?${params.toString()}`,
      { method: 'POST' },
    );

    if (createRes.ok) {
      const createdCard = await createRes.json();
      console.log(
        `Successfully created card: "${createdCard.name}" in list "${targetList.name}". Card ID: ${createdCard.shortLink}`,
      );
    } else {
      console.error('Failed to create card:', await createRes.text());
    }
  } catch (error) {
    console.error('Error communicating with Trello:', error);
  }
}

createCard();
