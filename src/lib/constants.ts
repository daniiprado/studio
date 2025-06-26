import map from "@/assets/topDown_baseTiles.png"

export const WORLD_TILESET_URL = map.src;

export const MAP_WIDTH = 10;
export const MAP_HEIGHT = 10;
export const TILE_SIZE = 16;

// Coordinates are in tile units (not pixels)
export const TILE_DEFINITIONS: Record<string, { x: number; y: number }> = {
    grass_green: { x: 0, y: 1 },
    grass_purple: { x: 1, y: 1 },
    cliff_green: { x: 0, y: 2 },
    tree_green: { x: 0, y: 6 },
    tree_yellow: { x: 0, y: 7 },
    tree_orange: { x: 0, y: 8 },
    wall_wood: { x: 0, y: 10 },
    roof_red: { x: 0, y: 11 },
    roof_brown: { x: 1, y: 11 },
    roof_orange: { x: 2, y: 11 },
};
