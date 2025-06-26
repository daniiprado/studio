'use client';
import { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { Player } from '@/lib/types';
import { WORLD_TILESET_URL, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TILE_DEFINITIONS } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { throttle } from 'lodash';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
}

// A more advanced procedural map generator
const generateMap = () => {
    const map: string[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill('grass1'));
  
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  
    // Generate houses
    const numHouses = randInt(5, 8);
    for (let i = 0; i < numHouses; i++) {
      const houseWidth = randInt(5, 8);
      const houseHeight = randInt(4, 7);
      // Ensure houses are not on the very edge of the map
      const startX = randInt(1, MAP_WIDTH - houseWidth - 1);
      const startY = randInt(1, MAP_HEIGHT - houseHeight - 1);
  
      const wallType = `wall${randInt(1, 3)}`;
      const roofType = `roof${randInt(1, 3)}`;
  
      // Place walls and roof
      for (let y = startY; y < startY + houseHeight; y++) {
        for (let x = startX; x < startX + houseWidth; x++) {
          // simple check to avoid overlapping houses for this example
          if (map[y][x].startsWith('grass')) {
             // A simple single-tile-high roof
            map[y][x] = y === startY ? roofType : wallType;
          }
        }
      }
    }
  
    // Scatter trees
    const numTrees = 70;
    for (let i = 0; i < numTrees; i++) {
        const x = randInt(0, MAP_WIDTH - 1);
        const y = randInt(0, MAP_HEIGHT - 1);
        
        if (map[y][x].startsWith('grass')) {
          const treeColor = ['green', 'brown', 'red'][randInt(0, 2)];
          // Using just one tree type per color for simplicity of scattering
          map[y][x] = `tree1_${treeColor}`; 
        }
    }
    
    // Scatter different grass types for visual variety
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x] === 'grass1' && Math.random() < 0.2) {
                map[y][x] = `grass${randInt(2, 3)}`;
            }
        }
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
      
      const tileTextures: Record<string, PIXI.Texture> = {};
      for (const [key, def] of Object.entries(TILE_DEFINITIONS)) {
        tileTextures[key] = new PIXI.Texture({
          source: tilesetTexture.source,
          frame: new PIXI.Rectangle(def.x * TILE_SIZE, def.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        });
      }
      
      // Draw map
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const tileId = mapData[y][x];
          
          // Always draw a base grass tile first, using the specified grass type if available
          const grassId = tileId.startsWith('grass') ? tileId : 'grass1';
          const baseTile = new PIXI.Sprite(tileTextures[grassId]);
          baseTile.x = x * TILE_SIZE;
          baseTile.y = y * TILE_SIZE;
          world.addChild(baseTile);
          
          // If the tileId from the map is not a grass tile, draw it on top
          if (!tileId.startsWith('grass') && tileTextures[tileId]) {
            const featureTile = new PIXI.Sprite(tileTextures[tileId]);
            featureTile.x = x * TILE_SIZE;
            featureTile.y = y * TILE_SIZE;
            world.addChild(featureTile);
          }
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
        const playerText = playerTextRef.current[currentPlayer.uid];

        if (playerSprite && world) {
          let newX = playerSprite.x;
          let newY = playerSprite.y;

          if (keysDown.current['w']) newY -= speed;
          if (keysDown.current['s']) newY += speed;
          if (keysDown.current['a']) newX -= speed;
          if (keysDown.current['d']) newX += speed;

          // Clamp position to map boundaries
          newX = Math.max(TILE_SIZE / 2, Math.min(newX, MAP_WIDTH * TILE_SIZE - TILE_SIZE / 2));
          newY = Math.max(TILE_SIZE / 2, Math.min(newY, MAP_HEIGHT * TILE_SIZE - TILE_SIZE / 2));
          
          if(playerSprite.x !== newX || playerSprite.y !== newY) {
            playerSprite.x = newX;
            playerSprite.y = newY;
            updatePlayerPositionInDb(newX, newY);
          }
          
          if (playerText) {
            playerText.x = playerSprite.x;
            playerText.y = playerSprite.y - TILE_SIZE;
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

    const currentPlayersInScene = Object.keys(playerSpritesRef.current);
    const onlinePlayerIds = onlinePlayers.map(p => p.uid);

    // Remove offline players from scene
    currentPlayersInScene.forEach(uid => {
      if (!onlinePlayerIds.includes(uid)) {
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
        // Update existing remote player's sprite
        const sprite = playerSpritesRef.current[player.uid];
        const text = playerTextRef.current[player.uid];
        if (player.uid !== currentPlayer.uid) { // Don't snap other players' positions, interpolate later
          sprite.x = player.x;
          sprite.y = player.y;
          text.x = player.x;
          text.y = player.y - TILE_SIZE;
        }
      } else {
        // Create new sprite for a player
        try {
          const playerTextureSource = await PIXI.Assets.load(player.avatarUrl);
          const frame = new PIXI.Rectangle(0, 0, TILE_SIZE, TILE_SIZE);
          const texture = new PIXI.Texture({ source: playerTextureSource.source, frame });
          
          const sprite = new PIXI.Sprite(texture);
          sprite.anchor.set(0.5, 0.5);
          sprite.x = player.x;
          sprite.y = player.y;
          sprite.zIndex = 1;
          world.addChild(sprite);
          playerSpritesRef.current[player.uid] = sprite;

          const text = new PIXI.Text({text: player.name || 'Player', style: {
            fontFamily: 'Inter',
            fontSize: 12,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2, join: 'round' },
          }});
          text.anchor.set(0.5, 1);
          text.x = player.x;
          text.y = player.y - TILE_SIZE;
          text.zIndex = 2; // Text on top of player
          world.addChild(text);
          playerTextRef.current[player.uid] = text;
          
        } catch(e) {
          console.error("Failed to load player texture", player.avatarUrl, e);
        }
      }
    });

    world.sortableChildren = true;

  }, [onlinePlayers, currentPlayer]);


  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
