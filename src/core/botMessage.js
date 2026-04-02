const BOT_PREFIX = '\u{1F916}';
const RUST_PREFIXES = {
  default: ':scientist:',
  announcement: ':exclamation:',
  timer: ':eyes:',
};
const RUST_PREFIX_VALUES = new Set(Object.values(RUST_PREFIXES));

function prefix(text) {
  const input = String(text || '').trim();
  if (!input) {
    return input;
  }

  if (input.startsWith(BOT_PREFIX)) {
    return input;
  }

  return `${BOT_PREFIX} ${input}`;
}

function prefixRust(text, tone = 'default') {
  const input = String(text || '').trim();
  if (!input) {
    return input;
  }

  const rustPrefix = RUST_PREFIXES[tone] || RUST_PREFIXES.default;
  if (startsWithKnownRustPrefix(input)) {
    return input;
  }

  return `${rustPrefix} ${input}`;
}

function startsWithKnownRustPrefix(text) {
  for (const prefixValue of RUST_PREFIX_VALUES) {
    if (text.startsWith(prefixValue)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  BOT_PREFIX,
  RUST_PREFIXES,
  prefix,
  prefixRust,
};
