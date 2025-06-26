const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const storageBaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;

const avatarPath = 'assetsPals%2Ftiles%2Favatars%2F';

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
