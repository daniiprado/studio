'use client';
import { useRef, useEffect, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Player } from '@/lib/types';
import { WORLD_TILESET_URL, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { throttle } from 'lodash';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
}

// A simple procedural map generator
const generateMap = () => {
  const map = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Basic grass
      row.push(Math.random() > 0.1 ? 0 : 1); 
    }
    map.push(row);
  }
  return map;
};

const mapData = generateMap();

const PixiCanvas = ({ currentPlayer, onlinePlayers }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const playerSpritesRef = useRef<Record<string, PIXI.Sprite>>({});
  const playerTextRef = useRef<Record<string, PIXI.Text>>({});
  const worldRef = useRef<PIXI.Container | null>(null);

  const keysDown = useRef<Record<string, boolean>>({});

  const updatePlayerPositionInDb = throttle(async (x: number, y: number) => {
    if (!currentPlayer) return;
    const playerDocRef = doc(db, 'players', currentPlayer.uid);
    await updateDoc(playerDocRef, { x, y });
  }, 200);

  useEffect(() => {
    if (!pixiContainer.current || appRef.current) return;

    const initPixi = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: pixiContainer.current!.clientWidth,
        height: pixiContainer.current!.clientHeight,
        backgroundColor: 0x222222,
        resizeTo: pixiContainer.current!,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      appRef.current = app;
      pixiContainer.current!.appendChild(app.view as HTMLCanvasElement);

      const world = new PIXI.Container();
      worldRef.current = world;
      app.stage.addChild(world);

      // Load assets
      const tilesetTexture = await PIXI.Assets.load(WORLD_TILESET_URL);
      const tileTextures = [
        new PIXI.Texture({source: tilesetTexture.source, frame: new PIXI.Rectangle(16 * 5, 16 * 8, 16, 16)}), // Grass
        new PIXI.Texture({source: tilesetTexture.source, frame: new PIXI.Rectangle(16 * 6, 16 * 8, 16, 16)}), // Flower
      ];
      
      // Draw map
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const tileId = mapData[y][x];
          const tile = new PIXI.Sprite(tileTextures[tileId]);
          tile.x = x * TILE_SIZE;
          tile.y = y * TILE_SIZE;
          world.addChild(tile);
        }
      }
      
      // Keyboard listeners
      const onKeyDown = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; };
      const onKeyUp = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      
      // Game loop
      app.ticker.add((time) => {
        const delta = time.delta;
        const speed = 2.5 * delta;
        const playerSprite = playerSpritesRef.current[currentPlayer.uid];
        if (playerSprite && world) {
          let newX = playerSprite.x;
          let newY = playerSprite.y;

          if (keysDown.current['w']) newY -= speed;
          if (keysDown.current['s']) newY += speed;
          if (keysDown.current['a']) newX -= speed;
          if (keysDown.current['d']) newX += speed;

          // Clamp position to map boundaries
          newX = Math.max(0, Math.min(newX, MAP_WIDTH * TILE_SIZE - TILE_SIZE));
          newY = Math.max(0, Math.min(newY, MAP_HEIGHT * TILE_SIZE - TILE_SIZE));
          
          if(playerSprite.x !== newX || playerSprite.y !== newY) {
            playerSprite.x = newX;
            playerSprite.y = newY;
            updatePlayerPositionInDb(newX, newY);
          }

          // Center camera on player
          world.pivot.x = playerSprite.x;
          world.pivot.y = playerSprite.y;
          world.position.x = app.screen.width / 2;
          world.position.y = app.screen.height / 2;
        }
      });
    };

    initPixi();

    return () => {
      window.removeEventListener('keydown', (e) => { keysDown.current[e.key.toLowerCase()] = true; });
      window.removeEventListener('keyup', (e) => { keysDown.current[e.key.toLowerCase()] = false; });
      appRef.current?.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!appRef.current || !worldRef.current) return;
    const world = worldRef.current;

    const currentPlayers = Object.keys(playerSpritesRef.current);
    const newPlayers = onlinePlayers.map(p => p.uid);

    // Remove offline players
    currentPlayers.forEach(uid => {
      if (!newPlayers.includes(uid)) {
        if (playerSpritesRef.current[uid]) {
            world.removeChild(playerSpritesRef.current[uid]);
            delete playerSpritesRef.current[uid];
        }
        if (playerTextRef.current[uid]) {
            world.removeChild(playerTextRef.current[uid]);
            delete playerTextRef.current[uid];
        }
      }
    });

    // Add/Update players
    onlinePlayers.forEach(async (player) => {
      if (playerSpritesRef.current[player.uid]) {
        // Update existing sprite
        const sprite = playerSpritesRef.current[player.uid];
        const text = playerTextRef.current[player.uid];
        if (player.uid !== currentPlayer.uid) { // Don't snap other players' positions, interpolate later
          sprite.x = player.x;
          sprite.y = player.y;
        }
        text.x = player.x + TILE_SIZE/2;
        text.y = player.y - 14;
      } else {
        // Create new sprite
        try {
          const texture = await PIXI.Assets.load(player.avatarUrl);
          const sprite = new PIXI.Sprite(texture);
          sprite.anchor.set(0.5, 0.5);
          sprite.width = TILE_SIZE * 1.5;
          sprite.height = TILE_SIZE * 1.5;
          sprite.x = player.x;
          sprite.y = player.y;
          world.addChild(sprite);
          playerSpritesRef.current[player.uid] = sprite;

          const text = new PIXI.Text({text: player.name || 'Player', style: {
            fontFamily: 'Inter',
            fontSize: 12,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2, join: 'round' },
          }});
          text.anchor.set(0.5, 0.5);
          text.x = player.x + TILE_SIZE/2;
          text.y = player.y - 14;
          world.addChild(text);
          playerTextRef.current[player.uid] = text;
          
        } catch(e) {
          console.error("Failed to load player texture", player.avatarUrl, e);
        }
      }
    });
  }, [onlinePlayers, currentPlayer]);


  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
