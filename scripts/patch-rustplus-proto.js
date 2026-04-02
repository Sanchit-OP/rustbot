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
  let patched = original;

  const replacements = [
    // Older schema variation seen in some installs.
    ['required bool itemIsBlueprint = 3;', 'optional bool itemIsBlueprint = 3;'],

    // AppMarker.SellOrder - some servers omit these.
    ['required int32 itemId = 1;', 'optional int32 itemId = 1;'],
    ['required int32 quantity = 2;', 'optional int32 quantity = 2;'],
    ['required int32 currencyId = 3;', 'optional int32 currencyId = 3;'],
    ['required int32 costPerItem = 4;', 'optional int32 costPerItem = 4;'],
    ['required int32 amountInStock = 5;', 'optional int32 amountInStock = 5;'],
    ['required bool itemIsBlueprint = 6;', 'optional bool itemIsBlueprint = 6;'],
    ['required bool currencyIsBlueprint = 7;', 'optional bool currencyIsBlueprint = 7;'],
  ];

  for (const [from, to] of replacements) {
    patched = patched.split(from).join(to);
  }

  if (patched === original) {
    console.log('[patch-rustplus-proto] no changes needed');
    return;
  }

  fs.writeFileSync(protoPath, patched, 'utf8');
  console.log('[patch-rustplus-proto] patched rustplus.proto successfully');
}

patchRustplusProto();
