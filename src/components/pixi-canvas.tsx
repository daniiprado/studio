
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet, Graphics, Sprite, Texture } from 'pixi.js';
import type { Player } from '@/lib/types';
import { CHARACTERS_MAP } from '@/lib/characters';
import { rtdb } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { throttle } from 'lodash';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
  gameState: 'lobby' | 'playing';
  setGameState: (state: 'lobby' | 'playing') => void;
}

type PlayerSprite = AnimatedSprite & { currentAnimationName?: string; characterId?: string; };

// 0: Grass, 1: Wall, 2: Floor, 3: Desk
const TILE_SIZE = 16;
const MAP_WIDTH_TILES = 40;
const MAP_HEIGHT_TILES = 30;

// prettier-ignore
const mapLayout = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 1, 3, 3, 1, 2, 1, 3, 3, 2, 2, 1, 2, 1, 3, 3, 2, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const TILE_COLORS = {
  0: 0x228B22, // Grass
  1: 0x4a4a4a, // Wall
  2: 0xD3D3D3, // Floor
  3: 0x8B4513, // Desk
};

const PixiCanvas = ({ currentPlayer, onlinePlayers, gameState, setGameState }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const lobbyRef = useRef<Container | null>(null);
  const playerSpritesRef = useRef<Record<string, PlayerSprite>>({});
  const playerTextRef = useRef<Record<string, Text>>({});
  const loadedSheetsRef = useRef<Record<string, Spritesheet>>({});
  const keysDown = useRef<Record<string, boolean>>({});
  
  const [isPixiInitialized, setPixiInitialized] = useState(false);
  const currentPlayerRef = useRef(currentPlayer);
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const updatePlayerInDb = useCallback(throttle(async (data: Partial<Player>) => {
    const localPlayer = currentPlayerRef.current;
    if (!localPlayer) return;

    if ((data.x !== undefined && (typeof data.x !== 'number' || isNaN(data.x))) || 
        (data.y !== undefined && (typeof data.y !== 'number' || isNaN(data.y)))) {
      console.error("Invalid coordinates detected. Aborting database update.", data);
      return;
    }

    const playerRef = ref(rtdb, `players/${localPlayer.uid}`);
    await update(playerRef, data);
  }, 100), []);
  
  const checkCollision = (x: number, y: number, width: number, height: number): boolean => {
    const characterBounds = {
        left: x - (width / 4),
        right: x + (width / 4),
        top: y - (height / 8),
        bottom: y + (height / 4),
    };

    const corners = [
        { x: characterBounds.left, y: characterBounds.top },
        { x: characterBounds.right, y: characterBounds.top },
        { x: characterBounds.left, y: characterBounds.bottom },
        { x: characterBounds.right, y: characterBounds.bottom },
    ];
  
    for (const corner of corners) {
      const tileX = Math.floor(corner.x / TILE_SIZE);
      const tileY = Math.floor(corner.y / TILE_SIZE);
  
      if (tileX < 0 || tileX >= MAP_WIDTH_TILES || tileY < 0 || tileY >= MAP_HEIGHT_TILES) {
        return true; // Out of bounds
      }
  
      const tileType = mapLayout[tileY]?.[tileX];
      if (tileType === 1 || tileType === 3) { // 1: Wall, 3: Desk
        return true; // Collision
      }
    }
  
    return false;
  };

  useEffect(() => {
    if (!pixiContainer.current || appRef.current) return;

    const app = new Application();
    let backgroundTexture: Texture | null = null;
    
    const onKeyDown = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };

    const initPixi = async () => {
      await app.init({
        backgroundColor: 0x1099bb,
        resizeTo: pixiContainer.current || window,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      appRef.current = app;
      if (!pixiContainer.current) return;
      pixiContainer.current.replaceChildren(app.canvas as HTMLCanvasElement);

      // --- WORLD CREATION ---
      const world = new Container();
      world.sortableChildren = true;
      worldRef.current = world;
      
      const mapContainer = new Container();
      mapContainer.zIndex = 0;
      world.addChild(mapContainer);

      for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tileType = mapLayout[y][x] as keyof typeof TILE_COLORS;
            const tile = new Sprite(Texture.WHITE);
            tile.tint = TILE_COLORS[tileType];
            tile.width = TILE_SIZE;
            tile.height = TILE_SIZE;
            tile.x = x * TILE_SIZE;
            tile.y = y * TILE_SIZE;
            mapContainer.addChild(tile);
        }
      }
      
      // --- LOBBY CREATION ---
      const lobbyContainer = new Container();
      lobbyRef.current = lobbyContainer;
      
      backgroundTexture = await Assets.load('https://placehold.co/1280x720.png');
      const background = new Sprite(backgroundTexture);
      background.anchor.set(0.5);
      lobbyContainer.addChild(background);

      const buttonGraphic = new Graphics();
      buttonGraphic.roundRect(0, 0, 220, 70, 15).fill({ color: 0x000000, alpha: 0.6 });
      buttonGraphic.stroke({ width: 3, color: 0xffffff });

      const buttonText = new Text({
        text: 'ENTRAR',
        style: { fill: 0xffffff, fontSize: 28, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 'bold' }
      });
      buttonText.anchor.set(0.5);
      buttonText.position.set(buttonGraphic.width / 2, buttonGraphic.height / 2);
      
      const enterButton = new Container();
      enterButton.addChild(buttonGraphic, buttonText);
      enterButton.eventMode = 'static';
      enterButton.cursor = 'pointer';

      const onEnterClick = () => {
        setGameState('playing');
      };
      
      enterButton.on('pointertap', onEnterClick);
      lobbyContainer.addChild(enterButton);
      
      const resizeHandler = () => {
        const screenWidth = app.screen.width;
        const screenHeight = app.screen.height;

        if (lobbyRef.current && backgroundTexture) {
          const background = lobbyRef.current.getChildAt(0) as Sprite;
          const enterButton = lobbyRef.current.getChildAt(1) as Container;

          const screenRatio = screenWidth / screenHeight;
          const bgRatio = backgroundTexture.width / backgroundTexture.height;
          if (screenRatio > bgRatio) {
              background.width = screenWidth;
              background.height = screenWidth / bgRatio;
          } else {
              background.height = screenHeight;
              background.width = screenHeight * bgRatio;
          }
          background.position.set(screenWidth / 2, screenHeight / 2);
          enterButton.position.set(screenWidth / 2 - enterButton.width / 2, screenHeight / 2 - enterButton.height / 2);
        }
      };
      app.renderer.on('resize', resizeHandler);
      resizeHandler();

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      app.ticker.add((time) => {
        if (gameStateRef.current !== 'playing') return;
        
        const localPlayer = currentPlayerRef.current;
        if (!localPlayer) return;

        const playerSprite = playerSpritesRef.current[localPlayer.uid];
        if (!playerSprite || playerSprite.destroyed) return;
        
        if (isNaN(playerSprite.x)) playerSprite.x = 0;
        if (isNaN(playerSprite.y)) playerSprite.y = 0;

        const sheet = loadedSheetsRef.current[localPlayer.characterId];
        if (!sheet) return;
        
        const speed = 1.5;
        let dx = 0;
        let dy = 0;

        if (keysDown.current['w'] || keysDown.current['arrowup']) dy -= 1;
        if (keysDown.current['s'] || keysDown.current['arrowdown']) dy += 1;
        if (keysDown.current['a'] || keysDown.current['arrowleft']) dx -= 1;
        if (keysDown.current['d'] || keysDown.current['arrowright']) dx += 1;

        const oldX = playerSprite.x;
        const oldY = playerSprite.y;
        
        if (dx !== 0 || dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            const normalizedDx = dx / magnitude;
            const normalizedDy = dy / magnitude;
            
            const moveX = normalizedDx * speed;
            const moveY = normalizedDy * speed;

            const targetX = playerSprite.x + moveX;
            const targetY = playerSprite.y + moveY;

            // Check X axis
            if (!checkCollision(targetX, oldY, playerSprite.width * playerSprite.scale.x, playerSprite.height * playerSprite.scale.y)) {
                playerSprite.x = targetX;
            }
    
            // Check Y axis, using the potentially new X to prevent clipping corners
            if (!checkCollision(playerSprite.x, targetY, playerSprite.width * playerSprite.scale.x, playerSprite.height * playerSprite.scale.y)) {
                playerSprite.y = targetY;
            }
        }

        const moved = playerSprite.x !== oldX || playerSprite.y !== oldY;
        let newDirection: Player['direction'] = (playerSprite.currentAnimationName?.split('_')[0] as Player['direction']) || 'front';

        if (moved) {
          if (Math.abs(dy) > Math.abs(dx)) {
            newDirection = dy < 0 ? 'back' : 'front';
          } else if (dx !== 0) {
            newDirection = dx < 0 ? 'left' : 'right';
          }
            
          if (!isNaN(playerSprite.x) && !isNaN(playerSprite.y)) {
            updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
          }
        }
        
        const newAnimationName = moved ? `${newDirection}_walk` : playerSprite.currentAnimationName;
        if (playerSprite.currentAnimationName !== newAnimationName && sheet.animations[newAnimationName || '']) {
            playerSprite.textures = sheet.animations[newAnimationName || 'front_walk'];
            playerSprite.currentAnimationName = newAnimationName;
            playerSprite.animationSpeed = 0.15;
        }
        
        if (moved && !playerSprite.playing) {
            playerSprite.play();
        } else if (!moved && playerSprite.playing) {
            playerSprite.gotoAndStop(0);
        }

        const playerText = playerTextRef.current[localPlayer.uid];
        if (playerText && !playerText.destroyed) {
          playerText.x = playerSprite.x;
          playerText.y = playerSprite.y - (playerSprite.height * playerSprite.scale.y) - 5;
        }
      });
      setPixiInitialized(true);
    };
    
    initPixi();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, [setGameState]);

  useEffect(() => {
    if (!isPixiInitialized) return;

    const app = appRef.current;
    if (!app) return;

    const world = worldRef.current;
    const lobby = lobbyRef.current;

    if (gameState === 'playing') {
        if (lobby?.parent) app.stage.removeChild(lobby);
        if (world && !world.parent) app.stage.addChild(world);
    } else { // lobby
        if (world?.parent) app.stage.removeChild(world);
        if (lobby && !lobby.parent) app.stage.addChild(lobby);
    }

  }, [gameState, isPixiInitialized]);


  useEffect(() => {
    if (!appRef.current || !worldRef.current || !isPixiInitialized) return;
    const world = worldRef.current;

    if (gameState !== 'playing') {
      return;
    }

    const loadAssetsAndPlayers = async () => {
      const playersToRender = new Map<string, Player>();
      playersToRender.set(currentPlayer.uid, currentPlayer);

      onlinePlayers.forEach(p => playersToRender.set(p.uid, p));
      
      const allPlayers = Array.from(playersToRender.values());
      const allPlayerIds = allPlayers.map(p => p.uid);
      const characterIds = new Set(allPlayers.map(p => p.characterId).filter(Boolean));

      for (const id of characterIds) {
        if (!loadedSheetsRef.current[id] && CHARACTERS_MAP[id]) {
            const character = CHARACTERS_MAP[id];
            const baseTexture = await Assets.load<Texture>(character.png.src);
            const sheet = new Spritesheet(baseTexture, character.json);
            await sheet.parse();
            loadedSheetsRef.current[id] = sheet;
        }
      }

      const currentPlayersInScene = Object.keys(playerSpritesRef.current);
      currentPlayersInScene.forEach(uid => {
        if (!allPlayerIds.includes(uid)) {
          if (playerSpritesRef.current[uid]) {
              playerSpritesRef.current[uid].destroy();
              delete playerSpritesRef.current[uid];
          }
          if (playerTextRef.current[uid]) {
              playerTextRef.current[uid].destroy();
              delete playerTextRef.current[uid];
          }
        }
      });

      for (const player of allPlayers) {
        if (!player.characterId) continue;
        const sheet = loadedSheetsRef.current[player.characterId];
        if (!sheet) continue;

        const isCurrentUser = player.uid === currentPlayer.uid;
        const animationName = `${player.direction || 'front'}_walk`;

        if (playerSpritesRef.current[player.uid]) {
          const sprite = playerSpritesRef.current[player.uid];
          const text = playerTextRef.current[player.uid];
          
          if(sprite.characterId !== player.characterId){
             sprite.destroy();
             if(text) text.destroy();
             delete playerSpritesRef.current[player.uid];
             delete playerTextRef.current[player.uid];
          } else {
             if (!isCurrentUser) {
                const newX = typeof player.x === 'number' && !isNaN(player.x) ? player.x : sprite.x;
                const newY = typeof player.y === 'number' && !isNaN(player.y) ? player.y : sprite.y;
                sprite.x = newX;
                sprite.y = newY;
                
                if (sprite.currentAnimationName !== animationName && sheet.animations[animationName]) {
                    sprite.textures = sheet.animations[animationName];
                    sprite.currentAnimationName = animationName;
                    sprite.gotoAndStop(0);
                }
             }
             if(text) {
                text.x = sprite.x;
                text.y = sprite.y - (sprite.height * sprite.scale.y) - 5;
                text.text = player.name || 'Player';
             }
          }
        }

        if (!playerSpritesRef.current[player.uid]) {
          if(!sheet.animations[animationName]) continue;
          
          const sprite: PlayerSprite = new AnimatedSprite(sheet.animations[animationName]);
          sprite.characterId = player.characterId;
          sprite.currentAnimationName = animationName;
          sprite.animationSpeed = 0.15;
          sprite.anchor.set(0.5);
          sprite.scale.set(0.5);
          sprite.x = (typeof player.x === 'number' && !isNaN(player.x)) ? player.x : 150;
          sprite.y = (typeof player.y === 'number' && !isNaN(player.y)) ? player.y : 400;
          sprite.zIndex = 1;
          sprite.gotoAndStop(0);
          
          world.addChild(sprite);
          playerSpritesRef.current[player.uid] = sprite;

          const text = new Text({
            text: player.name || 'Player',
            style: {
              fontFamily: 'Inter, sans-serif', fontSize: 12,
              fill: 0xffffff, stroke: { color: 0x000000, width: 3, join: 'round' },
              align: 'center',
            }
          });
          text.anchor.set(0.5, 1);
          text.x = sprite.x;
          text.y = sprite.y - (sprite.height * sprite.scale.y) - 5;
          text.zIndex = 2;
          world.addChild(text);
          playerTextRef.current[player.uid] = text;
        }
      }
    };
    
    loadAssetsAndPlayers();
    
  }, [onlinePlayers, currentPlayer, gameState, isPixiInitialized, updatePlayerInDb]);

  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
