const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const storageBaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;

const avatarPath = 'assets%2F';

export const AVATAR_SPRITES = [
  'spr_alex.png',
  'spr_anna.png',
  'spr_ardley.png',
  'spr_colt.png',
  'spr_ester.png',
  'spr_tom.png',
].map(fileName => `${storageBaseUrl}${avatarPath}${fileName}?alt=media`);


export const WORLD_TILESET_URL = `${storageBaseUrl}assetsPals%2Ftiles%2Fworld%2FtopDown_baseTiles.png?alt=media`;

export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 50;
export const TILE_SIZE = 16;

// Coordinates are in tile units (not pixels)
export const TILE_DEFINITIONS: Record<string, { x: number; y: number }> = {
    // Grass/Cliffs
    grass1: { x: 1, y: 7 }, // Light green grass
    grass2: { x: 0, y: 7 }, // Darker green grass
    grass3: { x: 2, y: 7 }, // Grass with some detail

    // Walls
    wall1: { x: 6, y: 11 }, // Grey stone wall
    wall2: { x: 7, y: 11 }, // Brown wood wall
    wall3: { x: 8, y: 11 }, // White plaster wall

    // Roofs
    roof1: { x: 13, y: 6 }, // Red shingles
    roof2: { x: 14, y: 6 }, // Brown thatch
    roof3: { x: 15, y: 6 }, // Grey slate

    // Trees (Green)
    tree1_green: { x: 11, y: 21 },
    tree2_green: { x: 12, y: 21 },
    tree3_green: { x: 13, y: 21 },
    
    // Trees (Brown/Autumn)
    tree1_brown: { x: 11, y: 22 },
    tree2_brown: { x: 12, y: 22 },
    tree3_brown: { x: 13, y: 22 },
    
    // Trees (Red/Fantasy)
    tree1_red: { x: 11, y: 23 },
    tree2_red: { x: 12, y: 23 },
    tree3_red: { x: 13, y: 23 },
};
