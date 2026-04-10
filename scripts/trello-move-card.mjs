#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
let cardRef = null;
let targetListName = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--card') cardRef = args[i + 1];
  if (args[i] === '--list') targetListName = args[i + 1];
}

if (!cardRef || !targetListName) {
  console.error(
    'Usage: node scripts/trello-move-card.mjs --card <DISC-XXX> --list <ListName>',
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

async function moveCard() {
  try {
    const listsRes = await fetch(
      `https://api.trello.com/1/boards/${BOARD_ID}/lists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    );
    const lists = await listsRes.json();
    const targetList = lists.find(
      (l) => l.name.toUpperCase() === targetListName.toUpperCase(),
    );

    if (!targetList) {
      console.error(`List "${targetListName}" not found on board.`);
      process.exit(1);
    }

    const cardsRes = await fetch(
      `https://api.trello.com/1/boards/${BOARD_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
    );
    const cards = await cardsRes.json();

    const searchString = `[${cardRef}]`.toUpperCase();
    const card = cards.find(
      (c) =>
        c.name.toUpperCase().includes(searchString) ||
        c.name.toUpperCase().includes(cardRef.toUpperCase()),
    );

    if (!card) {
      console.error(`Card containing ${cardRef} not found on board.`);
      process.exit(1);
    }

    const moveRes = await fetch(
      `https://api.trello.com/1/cards/${card.id}?idList=${targetList.id}&key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`,
      { method: 'PUT' },
    );

    if (moveRes.ok) {
      console.log(`Successfully moved "${card.name}" to "${targetList.name}".`);
    } else {
      console.error('Failed to move card:', await moveRes.text());
    }
  } catch (error) {
    console.error('Error communicating with Trello:', error);
  }
}

moveCard();
