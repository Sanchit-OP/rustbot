/**
 * Utility to convert Rust world coordinates into a grid (e.g., H14) and infer map side.
 * Uses a default map size of 4500 when none is provided.
 */
const DEFAULT_MAP_SIZE = 4500;
const DEFAULT_GRID_CELL_SIZE = 150;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function posToGrid(x, y, mapSize = DEFAULT_MAP_SIZE) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return 'Unknown';
  }

  const size = mapSize || DEFAULT_MAP_SIZE;
  // Rust divides the map into Math.ceil(size/150) equal columns and rows.
  // e.g. 4250 map → ceil(28.33) = 29 cells, each 146.55 units wide.
  // Using Math.round or a fixed 150 causes off-by-one on non-round map sizes.
  const gridCount = Math.ceil(size / DEFAULT_GRID_CELL_SIZE);
  const cellSize = size / gridCount;

  const colIndex = clamp(Math.floor(x / cellSize), 0, gridCount - 1);
  const rowIndex = clamp(Math.floor((size - y) / cellSize), 0, gridCount - 1);

  const colLabel = toColumnLabel(colIndex);
  return `${colLabel}${rowIndex}`;
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

function getGridDimension(mapSize) {
  const size = Number(mapSize) || DEFAULT_MAP_SIZE;
  return clamp(Math.round(size / DEFAULT_GRID_CELL_SIZE), 1, 200);
}

function toColumnLabel(index) {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

module.exports = {
  DEFAULT_MAP_SIZE,
  DEFAULT_GRID_CELL_SIZE,
  posToGrid,
  inferSide,
  getGridDimension,
};
