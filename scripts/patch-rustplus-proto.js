#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const protoPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@liamcottle',
  'rustplus.js',
  'rustplus.proto'
);

function patchRustplusProto() {
  if (!fs.existsSync(protoPath)) {
    console.log('[patch-rustplus-proto] rustplus.proto not found, skipping');
    return;
  }

  const original = fs.readFileSync(protoPath, 'utf8');

  // Replace ALL required fields with optional.
  // Proto2 `required` causes hard crashes when a server omits any field
  // (e.g. queuedPlayers, itemIsBlueprint). Making everything optional is safe —
  // the library just returns undefined for missing fields instead of throwing.
  const patched = original.replace(/\brequired\b/g, 'optional');

  const changedCount = (original.match(/\brequired\b/g) || []).length;

  if (patched === original) {
    console.log('[patch-rustplus-proto] no required fields found — already patched or not needed');
    return;
  }

  fs.writeFileSync(protoPath, patched, 'utf8');
  console.log(`[patch-rustplus-proto] patched ${changedCount} required → optional fields in rustplus.proto`);
}

patchRustplusProto();
