
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet, Graphics, Sprite, Texture, TextStyle } from 'pixi.js';
import type { Player } from '@/lib/types';
import { CHARACTERS_MAP } from '@/lib/characters';
import { rtdb } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { throttle } from 'lodash';
import lobbyImage from '@/assets/lobby.jpg';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
  gameState: 'lobby' | 'playing';
  setGameState: (state: 'lobby' | 'playing') => void;
  onProximityChange: (isNear: boolean) => void;
  npcMessage: string | null;
}

type PlayerSprite = AnimatedSprite & { currentAnimationName?: string; characterId?: string; };

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
  [1, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 2, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 1, 3, 3, 1, 2, 1, 3, 3, 2, 2, 1, 2, 1, 3, 3, 2, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 1, 2, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
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

const TILE_COLORS = { 0: 0x228B22, 1: 0x4a4a4a, 2: 0xD3D3D3, 3: 0x8B4513 };

const NPC = {
  uid: 'npc-quest-giver',
  characterId: 'ana',
  x: 200,
  y: 120,
  name: 'Quest Giver',
  direction: 'front'
} as const;

const PROXIMITY_RANGE = 50;

const PixiCanvas = ({ currentPlayer, onlinePlayers, gameState, setGameState, onProximityChange, npcMessage }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const lobbyRef = useRef<Container | null>(null);
  const playerSpritesRef = useRef<Record<string, PlayerSprite>>({});
  const playerTextRef = useRef<Record<string, Text>>({});
  const loadedSheetsRef = useRef<Record<string, Spritesheet>>({});
  const keysDown = useRef<Record<string, boolean>>({});
  
  const [isPixiInitialized, setPixiInitialized] = useState(false);
  
  // Use refs for props to ensure the main useEffect doesn't re-run
  const currentPlayerRef = useRef(currentPlayer);
  const gameStateRef = useRef(gameState);
  const proximityStateRef = useRef(false);
  const onProximityChangeRef = useRef(onProximityChange);
  const setGameStateRef = useRef(setGameState);

  const npcSpriteRef = useRef<PlayerSprite | null>(null);
  const npcProximityIndicatorRef = useRef<Graphics | null>(null);
  const npcChatBubbleRef = useRef<{ container: Container, text: Text, background: Graphics } | null>(null);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { onProximityChangeRef.current = onProximityChange; }, [onProximityChange]);
  useEffect(() => { setGameStateRef.current = setGameState; }, [setGameState]);

  useEffect(() => {
    if (!isPixiInitialized || !npcChatBubbleRef.current || !npcSpriteRef.current) return;
    
    const bubble = npcChatBubbleRef.current;
    const sprite = npcSpriteRef.current;
    
    if (chatTimeoutRef.current) {
      clearTimeout(chatTimeoutRef.current);
    }
    
    if (npcMessage) {
      bubble.text.text = npcMessage;
      
      const padding = 10;
      const bubbleWidth = bubble.text.width + padding * 2;
      const bubbleHeight = bubble.text.height + padding * 2;

      bubble.background.clear();
      bubble.background.roundRect(0, 0, bubbleWidth, bubbleHeight, 8).fill({color: 0x000000, alpha: 0.7});
      
      bubble.text.x = padding;
      bubble.text.y = padding;
      
      bubble.container.x = sprite.x - bubbleWidth / 2;
      bubble.container.y = sprite.y - (sprite.height * sprite.scale.y) - bubbleHeight - 5;
      bubble.container.visible = true;
      
      chatTimeoutRef.current = setTimeout(() => {
        if (bubble) bubble.container.visible = false;
        chatTimeoutRef.current = null;
      }, 5000);
    } else {
      bubble.container.visible = false;
    }

  }, [npcMessage, isPixiInitialized]);
  
  useEffect(() => {
    if (!pixiContainer.current) return;
    
    let app: Application | null = new Application();
    appRef.current = app;

    const onKeyDown = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    const updatePlayerInDb = throttle(async (data: Partial<Player>) => {
      const localPlayer = currentPlayerRef.current;
      if (!localPlayer) return;

      if ((data.x !== undefined && (typeof data.x !== 'number' || isNaN(data.x))) ||
          (data.y !== undefined && (typeof data.y !== 'number' || isNaN(data.y)))) {
        console.error("Invalid coordinates detected. Aborting database update.", data);
        return;
      }

      const playerRef = ref(rtdb, `players/${localPlayer.uid}`);
      await update(playerRef, data);
    }, 100);

    const checkCollision = (x: number, y: number): boolean => {
      const playerWidth = 16 * 0.5;
      const playerHeight = 32 * 0.5; 
  
      const bounds = {
        left: x - playerWidth / 2,
        right: x + playerWidth / 2,
        bottom: y + playerHeight / 4,
      };
      
      const corners = [
          { x: bounds.left, y: bounds.bottom - playerHeight / 2 },
          { x: bounds.right, y: bounds.bottom - playerHeight / 2 },
          { x: bounds.left, y: bounds.bottom },
          { x: bounds.right, y: bounds.bottom },
      ];
  
  
      for (const corner of corners) {
          const tileX = Math.floor(corner.x / TILE_SIZE);
          const tileY = Math.floor(corner.y / TILE_SIZE);
  
          if (tileX < 0 || tileX >= MAP_WIDTH_TILES || tileY < 0 || tileY >= MAP_HEIGHT_TILES) {
              return true;
          }
  
          const tileType = mapLayout[tileY]?.[tileX];
          if (tileType === 1 || tileType === 3) {
              return true;
          }
      }
      return false;
    };


    const initPixi = async () => {
      if (!app || !pixiContainer.current) return;
      await app.init({
        backgroundColor: 0x1099bb,
        resizeTo: pixiContainer.current,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (!pixiContainer.current || !app) return;
      pixiContainer.current.replaceChildren(app.canvas as HTMLCanvasElement);

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

      const lobbyContainer = new Container();
      lobbyRef.current = lobbyContainer;
      
      const backgroundTexture = await Assets.load(lobbyImage.src);
      const background = new Sprite(backgroundTexture);
      background.anchor.set(0.5);
      lobbyContainer.addChild(background);

      const buttonGraphic = new Graphics();
      buttonGraphic.roundRect(0, 0, 220, 70, 15).fill({ color: 0xBF00FF, alpha: 0.8 });
      buttonGraphic.stroke({ width: 3, color: 0xFFFFFF });

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
      enterButton.on('pointertap', () => setGameStateRef.current('playing'));
      lobbyContainer.addChild(enterButton);
      
      const resizeHandler = () => {
        if (!app) return;
        const screenWidth = app.screen.width;
        const screenHeight = app.screen.height;

        if (lobbyRef.current && background.texture.valid) {
            const bg = background;
            const bgRatio = bg.texture.width / bg.texture.height;
            const screenRatio = screenWidth / screenHeight;
            
            if (bgRatio > screenRatio) { 
                bg.height = screenHeight;
                bg.width = screenHeight * bgRatio;
            } else { 
                bg.width = screenWidth;
                bg.height = screenWidth / bgRatio;
            }
            bg.position.set(screenWidth / 2, screenHeight / 2);

            enterButton.position.set(
                screenWidth / 2 - enterButton.width / 2,
                screenHeight / 2 - enterButton.height / 2
            );
        }
        
        if (worldRef.current) {
            const worldContainer = worldRef.current;
            const worldWidth = MAP_WIDTH_TILES * TILE_SIZE;
            const worldHeight = MAP_HEIGHT_TILES * TILE_SIZE;

            const scaleX = screenWidth / worldWidth;
            const scaleY = screenHeight / worldHeight;
            const scale = Math.min(scaleX, scaleY); // Use Math.min to fit inside

            worldContainer.scale.set(scale);
            worldContainer.x = (screenWidth - (worldWidth * scale)) / 2;
            worldContainer.y = (screenHeight - (worldHeight * scale)) / 2;
        }
      };

      app.renderer.on('resize', resizeHandler);
      resizeHandler();
      
      const indicator = new Graphics();
      indicator.circle(0, 0, 20).stroke({ width: 2, color: 0xFFFF00, alpha: 0.8 });
      indicator.visible = false;
      indicator.zIndex = 2;
      world.addChild(indicator);
      npcProximityIndicatorRef.current = indicator;

      const createNpc = async () => {
        const character = CHARACTERS_MAP[NPC.characterId];
        if (!character) return;
        
        if (!loadedSheetsRef.current[NPC.characterId]) {
            const baseTexture = await Assets.load<Texture>(character.png.src);
            const sheet = new Spritesheet(baseTexture, character.json);
            await sheet.parse();
            loadedSheetsRef.current[NPC.characterId] = sheet;
        }
        
        const sheet = loadedSheetsRef.current[NPC.characterId];
        const sprite: PlayerSprite = new AnimatedSprite(sheet.animations[`${NPC.direction}_walk`]);
        sprite.characterId = NPC.characterId;
        sprite.gotoAndStop(0);
        sprite.anchor.set(0.5);
        sprite.scale.set(0.5);
        sprite.x = NPC.x;
        sprite.y = NPC.y;
        sprite.zIndex = 1;

        const text = new Text({
            text: NPC.name,
            style: {
              fontFamily: 'Inter, sans-serif', fontSize: 12,
              fill: 0xffff00, stroke: { color: 0x000000, width: 3, join: 'round' },
              align: 'center',
            }
        });
        text.anchor.set(0.5, 1);
        text.x = sprite.x;
        text.y = sprite.y - (sprite.height * sprite.scale.y) - 5;
        text.zIndex = 2;
        
        world.addChild(sprite, text);
        npcSpriteRef.current = sprite;

        const bubbleContainer = new Container();
        bubbleContainer.zIndex = 3;
        bubbleContainer.visible = false;

        const backgroundGraphic = new Graphics();
        
        const bubbleText = new Text({
            text: '',
            style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                fill: 0xffffff,
                wordWrap: true,
                wordWrapWidth: 150,
            }
        });

        bubbleContainer.addChild(backgroundGraphic, bubbleText);
        world.addChild(bubbleContainer);
        npcChatBubbleRef.current = { container: bubbleContainer, text: bubbleText, background: backgroundGraphic };
      }
      
      await createNpc();

      app.ticker.add((ticker) => {
        if (gameStateRef.current !== 'playing' || !app) return;
        
        const localPlayer = currentPlayerRef.current;
        if (!localPlayer) return;
        
        const playerSprite = playerSpritesRef.current[localPlayer.uid];
        if (!playerSprite || playerSprite.destroyed || !playerSprite.parent) {
          return;
        }
        
        const speed = 1.5;
        let dx = 0;
        let dy = 0;
        
        if (keysDown.current['w'] || keysDown.current['arrowup']) dy -= 1;
        if (keysDown.current['s'] || keysDown.current['arrowdown']) dy += 1;
        if (keysDown.current['a'] || keysDown.current['arrowleft']) dx -= 1;
        if (keysDown.current['d'] || keysDown.current['arrowright']) dx += 1;
        
        let moved = false;
        let newDirection: Player['direction'] = localPlayer.direction;
        
        const newPos = { x: playerSprite.x, y: playerSprite.y };

        if (dx !== 0 || dy !== 0) {
          moved = true;
          if (dx !== 0 && dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / magnitude);
            dy = (dy / magnitude);
          }
      
          const nextX = newPos.x + dx * speed;
          if (!checkCollision(nextX, newPos.y)) {
            newPos.x = nextX;
          }
          const nextY = newPos.y + dy * speed;
          if (!checkCollision(newPos.x, nextY)) {
            newPos.y = nextY;
          }

          playerSprite.x = newPos.x;
          playerSprite.y = newPos.y;
      
          if (Math.abs(dy) > Math.abs(dx)) {
            newDirection = dy < 0 ? 'back' : 'front';
          } else if (dx !== 0) {
            newDirection = dx < 0 ? 'left' : 'right';
          }
          updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
        }

        
        const sheet = loadedSheetsRef.current[localPlayer.characterId];
        const newAnimationName = `${newDirection}_walk`;

        if (sheet && playerSprite.currentAnimationName !== newAnimationName && sheet.animations[newAnimationName]) {
            playerSprite.textures = sheet.animations[newAnimationName];
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
        
        if (npcSpriteRef.current && npcProximityIndicatorRef.current) {
          const distance = Math.hypot(playerSprite.x - npcSpriteRef.current.x, playerSprite.y - npcSpriteRef.current.y);
          const isNear = distance < PROXIMITY_RANGE;
          
          if (isNear !== proximityStateRef.current) {
            proximityStateRef.current = isNear;
            onProximityChangeRef.current(isNear);
          }
          
          const indicator = npcProximityIndicatorRef.current;
          indicator.visible = isNear;
          if (isNear) {
            indicator.x = npcSpriteRef.current.x;
            indicator.y = npcSpriteRef.current.y - (npcSpriteRef.current.height * npcSpriteRef.current.scale.y) - 10;
            const pulse = Math.sin(app.ticker.lastTime / 200) * 0.1 + 0.9;
            indicator.scale.set(pulse);
          }
        }
      });
      setPixiInitialized(true);
    };
    
    initPixi();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      
      if (app) {
        app.destroy(true, { children: true, texture: true, baseTexture: true });
        app = null;
      }
      appRef.current = null;
      worldRef.current = null;
      lobbyRef.current = null;
      playerSpritesRef.current = {};
      playerTextRef.current = {};
      loadedSheetsRef.current = {};
      npcSpriteRef.current = null;
      npcProximityIndicatorRef.current = null;
      npcChatBubbleRef.current = null;
      if (chatTimeoutRef.current) {
        clearTimeout(chatTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPixiInitialized) return;
    const app = appRef.current;
    if (!app) return;

    if (gameState === 'playing') {
        if (lobbyRef.current?.parent) app.stage.removeChild(lobbyRef.current);
        if (worldRef.current && !worldRef.current.parent) app.stage.addChild(worldRef.current);
    } else {
        if (worldRef.current?.parent) app.stage.removeChild(worldRef.current);
        if (lobbyRef.current && !lobbyRef.current.parent) app.stage.addChild(lobbyRef.current);
    }
  }, [gameState, isPixiInitialized]);

  useEffect(() => {
    const world = worldRef.current;
    if (!appRef.current || !world || !isPixiInitialized || gameState !== 'playing') return;

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

      Object.keys(playerSpritesRef.current).forEach(uid => {
        if (!allPlayerIds.includes(uid)) {
          playerSpritesRef.current[uid]?.destroy();
          playerTextRef.current[uid]?.destroy();
          delete playerSpritesRef.current[uid];
          delete playerTextRef.current[uid];
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
                sprite.x = (typeof player.x === 'number' && !isNaN(player.x)) ? player.x : sprite.x;
                sprite.y = (typeof player.y === 'number' && !isNaN(player.y)) ? player.y : sprite.y;
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
    
  }, [onlinePlayers, currentPlayer, gameState, isPixiInitialized]);

  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
