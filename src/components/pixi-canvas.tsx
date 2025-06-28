
'use client';

import React, { useRef, useEffect, useLayoutEffect } from 'react';
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
  x: 312,
  y: 200,
  name: 'Quest Giver',
  direction: 'front'
} as const;

const PROXIMITY_RANGE = 50;

const PixiCanvas = ({ currentPlayer, onlinePlayers, gameState, setGameState, onProximityChange }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ currentPlayer, onlinePlayers, gameState, setGameState, onProximityChange });
  
  useLayoutEffect(() => {
    propsRef.current = { currentPlayer, onlinePlayers, gameState, setGameState, onProximityChange };
  });

  useEffect(() => {
    if (!pixiContainer.current) {
        return;
    }

    let app: Application | null = new Application();
    let tickerCallback = (time: any) => {};

    const keysDown: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => { keysDown[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown[e.key.toLowerCase()] = false; };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    const initPixi = async () => {
        if (!app || !pixiContainer.current) return;
        
        await app.init({
            backgroundColor: 0x1099bb,
            resizeTo: pixiContainer.current,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        });
        
        pixiContainer.current.appendChild(app.canvas);
        
        const playerSprites: Record<string, PlayerSprite> = {};
        const playerText: Record<string, Text> = {};
        const loadedSheets: Record<string, Spritesheet> = {};
        
        const world = new Container();
        app.stage.addChild(world);
        world.sortableChildren = true;
        
        const mapContainer = new Container();
        mapContainer.zIndex = 0;
        world.addChild(mapContainer);

        for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
            for (let x = 0; x < MAP_WIDTH_TILES; x++) {
                const tileType = mapLayout[y]?.[x] as keyof typeof TILE_COLORS ?? 0;
                const tile = new Sprite(Texture.WHITE);
                tile.tint = TILE_COLORS[tileType];
                tile.width = TILE_SIZE;
                tile.height = TILE_SIZE;
                tile.x = x * TILE_SIZE;
                tile.y = y * TILE_SIZE;
                mapContainer.addChild(tile);
            }
        }
        
        const lobby = new Container();
        app.stage.addChild(lobby);
        
        const backgroundTexture = await Assets.load(lobbyImage.src);
        const background = new Sprite(backgroundTexture);
        background.anchor.set(0.5);
        lobby.addChild(background);

        const buttonGraphic = new Graphics();
        buttonGraphic.roundRect(0, 0, 220, 70, 15).fill({ color: 0xBF00FF, alpha: 0.8 });
        buttonGraphic.stroke({ width: 3, color: 0xFFFFFF });

        const buttonText = new Text({
            text: 'ENTRAR',
            style: new TextStyle({ fill: 0xffffff, fontSize: 28, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 'bold' })
        });
        buttonText.anchor.set(0.5);
        buttonText.position.set(buttonGraphic.width / 2, buttonGraphic.height / 2);
        
        const enterButton = new Container();
        enterButton.addChild(buttonGraphic, buttonText);
        enterButton.eventMode = 'static';
        enterButton.cursor = 'pointer';
        enterButton.on('pointertap', () => {
          propsRef.current.setGameState('playing');
        });
        lobby.addChild(enterButton);

        const resizeHandler = () => {
            if (!app || app.destroyed) return;
            const screenWidth = app.screen.width;
            const screenHeight = app.screen.height;
            const { gameState: currentGameState } = propsRef.current;
            
            world.visible = currentGameState === 'playing';
            lobby.visible = currentGameState === 'lobby';
            
            if (currentGameState === 'playing') {
                const worldWidth = MAP_WIDTH_TILES * TILE_SIZE;
                const worldHeight = MAP_HEIGHT_TILES * TILE_SIZE;
                const scaleX = screenWidth / worldWidth;
                const scaleY = screenHeight / worldHeight;
                const scale = Math.max(1, Math.min(scaleX, scaleY));
                world.scale.set(scale);
                world.x = (screenWidth - (worldWidth * scale)) / 2;
                world.y = (screenHeight - (worldHeight * scale)) / 2;
            } else {
                 if (background.texture.valid) {
                    const bgRatio = background.texture.width / background.texture.height;
                    const screenRatio = screenWidth / screenHeight;
                    
                    if (bgRatio > screenRatio) { 
                        background.height = screenHeight;
                        background.width = screenHeight * bgRatio;
                    } else { 
                        background.width = screenWidth;
                        background.height = screenWidth / bgRatio;
                    }
                }
                background.position.set(screenWidth / 2, screenHeight / 2);
                enterButton.position.set(
                    screenWidth / 2 - enterButton.width / 2,
                    screenHeight / 2 - enterButton.height / 2
                );
            }
        };

        app.renderer.on('resize', resizeHandler);
        resizeHandler();
      
        const updatePlayerInDb = throttle((data: Partial<Player>) => {
            const { currentPlayer: localPlayer } = propsRef.current;
            if (!localPlayer) return;
            const playerRef = ref(rtdb, `players/${localPlayer.uid}`);
            update(playerRef, data);
        }, 100);

        const checkCollision = (x: number, y: number): boolean => {
            const playerWidth = 16 * 0.5;
            const playerHeight = 16 * 0.5;
            const bounds = {
                left: x - playerWidth / 2,
                right: x + playerWidth / 2,
                top: y - playerHeight,
                bottom: y,
            };
            const corners = [
                { x: bounds.left, y: bounds.top },
                { x: bounds.right, y: bounds.top },
                { x: bounds.left, y: bounds.bottom },
                { x: bounds.right, y: bounds.bottom },
            ];
            for (const corner of corners) {
                const tileX = Math.floor(corner.x / TILE_SIZE);
                const tileY = Math.floor(corner.y / TILE_SIZE);
                if (tileX < 0 || tileX >= MAP_WIDTH_TILES || tileY < 0 || tileY >= MAP_HEIGHT_TILES) return true;
                const tileType = mapLayout[tileY]?.[tileX];
                if (tileType === 1 || tileType === 3) return true;
            }
            return false;
        };

        const npcSprite = await createNpcSprite(world, loadedSheets);
        const npcProximityIndicator = createNpcProximityIndicator(world);
        let proximityState = false;

        tickerCallback = () => {
            if (!app || app.destroyed) return;
            const { gameState: currentGameState, currentPlayer: localPlayer, onlinePlayers: currentOnlinePlayers, onProximityChange: currentOnProximityChange } = propsRef.current;

            world.visible = currentGameState === 'playing';
            lobby.visible = currentGameState === 'lobby';
            
            if (currentGameState !== 'playing') {
                resizeHandler();
                return;
            }
            
            if (!localPlayer) return;
            const playerSprite = playerSprites[localPlayer.uid];
            
            if (playerSprite && playerSprite.parent) {
                const speed = 2.5;
                let dx = 0;
                let dy = 0;

                if (keysDown['w'] || keysDown['arrowup']) dy -= 1;
                if (keysDown['s'] || keysDown['arrowdown']) dy += 1;
                if (keysDown['a'] || keysDown['arrowleft']) dx -= 1;
                if (keysDown['d'] || keysDown['arrowright']) dx += 1;
                
                let newDirection: Player['direction'] = localPlayer.direction;
                let moved = false;
                
                if (dx !== 0) {
                    const newX = playerSprite.x + dx * speed;
                    if (!checkCollision(newX, playerSprite.y)) {
                        playerSprite.x = newX;
                        moved = true;
                        newDirection = dx < 0 ? 'left' : 'right';
                    }
                }
                if (dy !== 0) {
                    const newY = playerSprite.y + dy * speed;
                    if (!checkCollision(playerSprite.x, newY)) {
                        playerSprite.y = newY;
                        moved = true;
                        newDirection = dy < 0 ? 'back' : 'front';
                    }
                }

                if (moved) {
                    updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });

                    const sheet = loadedSheets[localPlayer.characterId];
                    if(sheet){
                        const newAnimationName = `${newDirection}_walk`;
                        if (playerSprite.currentAnimationName !== newAnimationName && sheet.animations[newAnimationName]) {
                            playerSprite.textures = sheet.animations[newAnimationName];
                            playerSprite.currentAnimationName = newAnimationName;
                            playerSprite.animationSpeed = 0.15;
                        }
                        if (!playerSprite.playing) playerSprite.play();
                    }
                } else {
                    if (playerSprite.playing) playerSprite.gotoAndStop(0);
                }
            }
            
            updatePlayerSprites(world, [localPlayer, ...currentOnlinePlayers], playerSprites, playerText, loadedSheets, localPlayer.uid);
            
            const pSprite = playerSprites[localPlayer.uid];
            if (pSprite && npcSprite) {
                const distance = Math.hypot(pSprite.x - npcSprite.x, pSprite.y - npcSprite.y);
                const isNear = distance < PROXIMITY_RANGE;
                if (isNear !== proximityState) {
                    proximityState = isNear;
                    currentOnProximityChange(isNear);
                }
                npcProximityIndicator.visible = isNear;
                if (isNear) {
                    npcProximityIndicator.x = npcSprite.x;
                    npcProximityIndicator.y = npcSprite.y - (npcSprite.height * npcSprite.scale.y) - 10;
                    const pulse = Math.sin(app.ticker.lastTime / 200) * 0.1 + 0.9;
                    npcProximityIndicator.scale.set(pulse);
                }
            }
        };

        app.ticker.add(tickerCallback);
    };

    initPixi();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      
      if (app) {
        if(app.ticker) {
            app.ticker.remove(tickerCallback);
        }
        if (!app.destroyed) {
            app.destroy(true, { children: true, texture: true, baseTexture: true });
        }
        app = null;
      }
    };
  }, []);

  return <div ref={pixiContainer} className="w-full h-full" />;
};

async function createNpcSprite(world: Container, loadedSheets: Record<string, Spritesheet>) {
    const character = CHARACTERS_MAP[NPC.characterId];
    if (!character) return null;
    
    if (!loadedSheets[NPC.characterId]) {
        const baseTexture = await Assets.load<Texture>(character.png.src);
        const sheet = new Spritesheet(baseTexture, character.json);
        await sheet.parse();
        loadedSheets[NPC.characterId] = sheet;
    }
    
    const sheet = loadedSheets[NPC.characterId];
    const npcSprite = new AnimatedSprite(sheet.animations[`${NPC.direction}_walk`]);
    npcSprite.characterId = NPC.characterId;
    npcSprite.gotoAndStop(0);
    npcSprite.anchor.set(0.5);
    npcSprite.scale.set(0.5);
    npcSprite.x = NPC.x;
    npcSprite.y = NPC.y;
    npcSprite.zIndex = 1;

    const text = new Text({
        text: NPC.name,
        style: new TextStyle({
          fontFamily: 'Inter, sans-serif', fontSize: 12,
          fill: 0xffff00, stroke: { color: 0x000000, width: 3, join: 'round' },
          align: 'center',
        })
    });
    text.anchor.set(0.5, 1);
    text.x = npcSprite.x;
    text.y = npcSprite.y - (npcSprite.height * npcSprite.scale.y) - 5;
    text.zIndex = 2;
    
    world.addChild(npcSprite, text);
    return npcSprite;
}

function createNpcProximityIndicator(world: Container) {
    const indicator = new Graphics();
    indicator.circle(0, 0, 20).stroke({ width: 2, color: 0xFFFF00, alpha: 0.8 });
    indicator.visible = false;
    indicator.zIndex = 2;
    world.addChild(indicator);
    return indicator;
}

async function updatePlayerSprites(world: Container, players: Player[], playerSprites: Record<string, PlayerSprite>, playerText: Record<string, Text>, loadedSheets: Record<string, Spritesheet>, currentUserId: string) {
    const activePlayerIds = new Set(players.map(p => p.uid));
    
    for(const uid in playerSprites){
        if(!activePlayerIds.has(uid)){
            if (playerSprites[uid]) playerSprites[uid].destroy();
            if (playerText[uid]) playerText[uid].destroy();
            delete playerSprites[uid];
            delete playerText[uid];
        }
    }
    
    for (const player of players) {
        if(!player.characterId || !player.uid) continue;

        if(!loadedSheets[player.characterId]){
            const character = CHARACTERS_MAP[player.characterId];
            if(character){
                const baseTexture = await Assets.load<Texture>(character.png.src);
                const sheet = new Spritesheet(baseTexture, character.json);
                await sheet.parse();
                loadedSheets[player.characterId] = sheet;
            }
        }
        const sheet = loadedSheets[player.characterId];
        if(!sheet) continue;

        if(playerSprites[player.uid]){
            const sprite = playerSprites[player.uid];
            const text = playerText[player.uid];

            if(sprite.characterId !== player.characterId) {
                sprite.destroy();
                text.destroy();
                delete playerSprites[player.uid];
                delete playerText[player.uid];
            } else {
                if(player.uid !== currentUserId){
                    sprite.x = player.x;
                    sprite.y = player.y;
                }
                const newAnim = `${player.direction || 'front'}_walk`;
                if(sprite.currentAnimationName !== newAnim && sheet.animations[newAnim]) {
                   sprite.textures = sheet.animations[newAnim];
                   sprite.currentAnimationName = newAnim;
                   sprite.gotoAndStop(0);
                }
                text.x = sprite.x;
                text.y = sprite.y - (sprite.height * sprite.scale.y) - 5;
                if (text.text !== player.name) {
                    text.text = player.name;
                }
            }
        } 
        if(!playerSprites[player.uid]) {
            const animationName = `${player.direction || 'front'}_walk`;
            const sprite: PlayerSprite = new AnimatedSprite(sheet.animations[animationName]);
            sprite.characterId = player.characterId;
            sprite.currentAnimationName = animationName;
            sprite.animationSpeed = 0.15;
            sprite.anchor.set(0.5);
            sprite.scale.set(0.5);
            sprite.x = player.x;
            sprite.y = player.y;
            sprite.zIndex = 1;
            sprite.gotoAndStop(0);
            world.addChild(sprite);
            playerSprites[player.uid] = sprite;

            const textObj = new Text({
                text: player.name || 'Player',
                style: new TextStyle({
                    fontFamily: 'Inter, sans-serif', fontSize: 12,
                    fill: 0xffffff, stroke: { color: 0x000000, width: 3, join: 'round' },
                    align: 'center',
                })
            });
            textObj.anchor.set(0.5, 1);
            textObj.x = sprite.x;
            textObj.y = sprite.y - (sprite.height * sprite.scale.y) - 5;
            textObj.zIndex = 2;
            world.addChild(textObj);
            playerText[player.uid] = textObj;
        }
    }
}

export default PixiCanvas;
