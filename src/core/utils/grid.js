/**
 * Utility to convert Rust world coordinates into a grid (e.g., H14) and infer map side.
 * Uses a default map size of 4500 when none is provided.
 */
const DEFAULT_MAP_SIZE = 3500;
const GRID_COLUMNS = 26; // A-Z

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function posToGrid(x, y, mapSize = DEFAULT_MAP_SIZE) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return 'Unknown';
  }

  const size = mapSize || DEFAULT_MAP_SIZE;
  const cell = size / GRID_COLUMNS;

  const colIndex = clamp(Math.floor(x / cell), 0, GRID_COLUMNS - 1);
  const rowIndex = clamp(Math.floor((size - y) / cell) + 1, 1, GRID_COLUMNS);

  const colLetter = String.fromCharCode(65 + colIndex);
  return `${colLetter}${rowIndex}`;
}

function inferSide(x, y, mapSize = DEFAULT_MAP_SIZE) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return 'UNKNOWN';
  }
  const size = mapSize || DEFAULT_MAP_SIZE;
  const distances = {
    NORTH: size - y,
    SOUTH: y,
    WEST: x,
    EAST: size - x,
  };
  let best = 'NORTH';
  let min = distances[best];
  for (const [side, dist] of Object.entries(distances)) {
    if (dist < min) {
      min = dist;
      best = side;
    }
  }
  return best;
}

module.exports = {
  DEFAULT_MAP_SIZE,
  posToGrid,
  inferSide,
};
