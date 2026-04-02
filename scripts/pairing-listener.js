#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(
  repoRoot,
  'node_modules',
  '@liamcottle',
  'rustplus.js',
  'cli',
  'index.js'
);

const configFile =
  process.env.RUSTPLUS_CONFIG_FILE || path.join(repoRoot, 'rustplus.config.json');

function startListener() {
  const child = spawn(process.execPath, [cliPath, `--config-file=${configFile}`, 'fcm-listen'], {
    cwd: repoRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let objectCapture = null;

  child.stdout.on('data', chunk => {
    const text = chunk.toString('utf8');
    process.stdout.write(text);

    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line === '{') {
        objectCapture = ['{'];
        continue;
      }

      if (objectCapture) {
        objectCapture.push(line);
        if (line === '}') {
          tryExtractPairing(objectCapture.join('\n'));
          objectCapture = null;
        }
      }
    }
  });

  child.stderr.on('data', chunk => {
    process.stderr.write(chunk.toString('utf8'));
  });

  child.on('exit', code => {
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    setTimeout(() => process.exit(0), 100);
  });

  printInstructions();
}

function tryExtractPairing(block) {
  const extracted = {
    ip: readSingleQuotedField(block, 'ip'),
    port: readSingleQuotedField(block, 'port'),
    playerId: readSingleQuotedField(block, 'playerId'),
    playerToken: readSingleQuotedField(block, 'playerToken'),
    name: readSingleQuotedField(block, 'name'),
    type: readSingleQuotedField(block, 'type'),
  };

  if (!extracted.ip || !extracted.port || !extracted.playerId || !extracted.playerToken) {
    return;
  }

  if (extracted.type && extracted.type !== 'server') {
    return;
  }

  const serverLabel = extracted.name || `${extracted.ip}:${extracted.port}`;
  const maskedToken = maskToken(extracted.playerToken);

  console.log('');
  console.log('=== Pairing captured ===');
  console.log(`Server: ${serverLabel}`);
  console.log(`Address: ${extracted.ip}:${extracted.port}`);
  console.log(`Player ID: ${extracted.playerId}`);
  console.log(`Player Token: ${maskedToken} (full value shown below)`);
  console.log('');
  console.log('Paste these into your .env:');
  console.log(`RUST_SERVER_IP=${extracted.ip}`);
  console.log(`RUST_SERVER_PORT=${extracted.port}`);
  console.log(`RUST_PLAYER_ID=${extracted.playerId}`);
  console.log(`RUST_PLAYER_TOKEN=${extracted.playerToken}`);
  console.log('========================');
  console.log('');
}

function readSingleQuotedField(input, fieldName) {
  const expression = new RegExp(`\\b${escapeRegex(fieldName)}\\s*:\\s*'([^']*)'`);
  const match = input.match(expression);
  return match ? match[1] : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskToken(token) {
  if (!token) {
    return '';
  }
  if (token.length <= 4) {
    return '*'.repeat(token.length);
  }
  return `${'*'.repeat(token.length - 4)}${token.slice(-4)}`;
}

function printInstructions() {
  console.log('Pairing listener started.');
  console.log('Open Rust game, connect to your server, and click "Pair with Server".');
  console.log('When a server pairing notification arrives, env values will be printed.');
  console.log(`Using config file: ${configFile}`);
  console.log('');
}

startListener();
