import map from "@/assets/topDown_baseTiles.png"
import spr_alex from "@/assets/spr_alex.png"
import spr_anna from "@/assets/spr_anna.png"
import spr_ardley from "@/assets/spr_ardley.png"
import spr_colt from "@/assets/spr_colt.png"
import spr_ester from "@/assets/spr_ester.png"
import spr_tom from "@/assets/spr_tom.png" 

export const AVATAR_SPRITES = [
  spr_alex.src,
  spr_anna.src,
  spr_ardley.src,
  spr_colt.src,
  spr_ester.src,
  spr_tom.src,
];

export const AVATAR_SPRITES_ALIAS = {
  "spr_alex.png": spr_alex.src,
  "spr_anna.png": spr_anna.src,
  "spr_ardley.png": spr_ardley.src,
  "spr_colt.png": spr_colt.src,
  "spr_ester.png": spr_ester.src,
  "spr_tom.png": spr_tom.src,
};

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
