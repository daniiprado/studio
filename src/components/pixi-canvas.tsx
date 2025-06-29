
'use client';

import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet, Graphics, Sprite, Texture, TextStyle, Rectangle } from 'pixi.js';
import type { Player } from '@/lib/types';
import { CHARACTERS_MAP } from '@/lib/characters';
import { rtdb } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { throttle } from 'lodash';
import lobbyImage from '@/assets/lobby.jpg';
import mapData from '@/assets/map.json';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
  gameState: 'lobby' | 'playing';
  setGameState: (state: 'lobby' | 'playing') => void;
  onProximityChange: (isNear: boolean) => void;
}

type PlayerSprite = AnimatedSprite & { currentAnimationName?: string; characterId?: string; };

const TILE_SIZE = mapData.tilewidth;
const MAP_WIDTH_TILES = mapData.width;
const MAP_HEIGHT_TILES = mapData.height;
const TILESET_URL = '/topDown_baseTiles.png'; 

const NPC = {
  uid: 'npc-quest-giver',
  characterId: 'ana',
  x: 312,
  y: 200,
  name: 'Quest Giver',
  direction: 'front'
} as const;

const PROXIMITY_RANGE = 75;
const NPC_PROXIMITY_RANGE = 50;

let collisionMap: boolean[][] = [];
let officeMap: number[][] = [];

const PixiCanvas = (props: PixiCanvasProps) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  
  useEffect(() => {
    propsRef.current = props;
  });

  useLayoutEffect(() => {
    const pixiElement = pixiContainerRef.current;
    if (!pixiElement) return;

    // Use a 'const' to ensure the app reference is stable for this effect's lifetime.
    const app = new Application();
    
    let tickerCallback: ((time: any) => void) | null = null;
    const keysDown: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => { keysDown[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown[e.key.toLowerCase()] = false; };
    
    // Wrap all async setup in a function.
    const init = async () => {
        await app.init({
            resizeTo: pixiElement,
            backgroundColor: 0x60bb38,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        });
        
        pixiElement.appendChild(app.view);
        
        // Add event listeners correctly
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        
        const world = new Container();
        world.sortableChildren = true;
        app.stage.addChild(world);
        
        const mapContainer = new Container();
        mapContainer.zIndex = 0;
        world.addChild(mapContainer);

        const baseTexture = await Assets.load<Texture>(TILESET_URL);
        if (app.destroyed) return;

        const tilesetInfo = mapData.tilesets[0];
        const tilesetCols = 33;
        const firstGid = tilesetInfo.firstgid;

        const baseLayer = mapData.layers.find(l => l.name === 'base');
        const treesLayer = mapData.layers.find(l => l.name === 'trees');
        const officesLayer = mapData.layers.find(l => l.name === 'offices');

        if (baseLayer) {
            for (let i = 0; i < baseLayer.data.length; i++) {
                const gid = baseLayer.data[i];
                if (gid === 0) continue;

                const tileIndex = gid - firstGid;
                const sx = (tileIndex % tilesetCols) * TILE_SIZE;
                const sy = Math.floor(tileIndex / tilesetCols) * TILE_SIZE;

                try {
                  const texture = new Texture({
                      source: baseTexture.source,
                      frame: new Rectangle(sx, sy, TILE_SIZE, TILE_SIZE),
                  });

                  const tileSprite = new Sprite(texture);
                  tileSprite.x = (i % MAP_WIDTH_TILES) * TILE_SIZE;
                  tileSprite.y = Math.floor(i / MAP_WIDTH_TILES) * TILE_SIZE;
                  mapContainer.addChild(tileSprite);
                } catch (e) {
                  console.error(`Error creating texture for GID ${gid}:`, e);
                }
            }
        }
        
        if (treesLayer) {
            collisionMap = Array.from({ length: MAP_HEIGHT_TILES }, () => Array(MAP_WIDTH_TILES).fill(false));
            for (let i = 0; i < treesLayer.data.length; i++) {
                if (treesLayer.data[i] !== 0) {
                    const x = i % MAP_WIDTH_TILES;
                    const y = Math.floor(i / MAP_WIDTH_TILES);
                    collisionMap[y][x] = true;
                }
            }
        }
        
        if (officesLayer) {
            officeMap = Array.from({ length: MAP_HEIGHT_TILES }, () => Array(MAP_WIDTH_TILES).fill(0));
            for (let i = 0; i < officesLayer.data.length; i++) {
                const gid = officesLayer.data[i];
                if (gid !== 0) {
                    const tileX = i % MAP_WIDTH_TILES;
                    const tileY = Math.floor(i / MAP_WIDTH_TILES);
                    officeMap[tileY][tileX] = gid;
                }
            }
        }

        const lobby = new Container();
        app.stage.addChild(lobby);
        
        const backgroundLobbyTexture = await Assets.load(lobbyImage.src);
        if (app.destroyed) return;

        const background = new Sprite(backgroundLobbyTexture);
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
          if (!app.destroyed) propsRef.current.setGameState('playing');
        });
        lobby.addChild(enterButton);

        const playerSprites: Record<string, PlayerSprite> = {};
        const playerText: Record<string, Text> = {};
        const playerInteractionIcons: Record<string, Container> = {};
        const loadedSheets: Record<string, Spritesheet> = {};
        const loadingSheets: Record<string, boolean> = {};
        let npcSprite: PlayerSprite | null = null;
        let npcProximityIndicator: Graphics | null = null;
        let npcProximityState = false;
        
        const updatePlayerSprites = (allPlayers: Player[], currentUserId?: string) => {
            if (app.destroyed) return;
            const activePlayerIds = new Set(allPlayers.map(p => p.uid));
    
            for(const uid in playerSprites){
                if(!activePlayerIds.has(uid)){
                    if (playerSprites[uid]) playerSprites[uid].destroy();
                    if (playerText[uid]) playerText[uid].destroy();
                    if (playerInteractionIcons[uid]) playerInteractionIcons[uid].destroy();
                    delete playerSprites[uid];
                    delete playerText[uid];
                    delete playerInteractionIcons[uid];
                }
            }
            
            for (const player of allPlayers) {
                if(!player.characterId || !player.uid || player.x === undefined || player.y === undefined) continue;
        
                if(!loadedSheets[player.characterId]){
                    if (!loadingSheets[player.characterId]) {
                        loadingSheets[player.characterId] = true;
                        const character = CHARACTERS_MAP[player.characterId];
                        if (character) {
                            (async () => {
                                try {
                                    if (app.destroyed) return;
                                    const baseTexture = await Assets.load<Texture>(character.png.src);
                                    if (app.destroyed) return;
                                    const sheet = new Spritesheet(baseTexture, character.json);
                                    await sheet.parse();
                                    loadedSheets[player.characterId] = sheet;
                                } catch(e) {
                                    console.error(`Failed to load character sheet for ${player.characterId}`, e);
                                    delete loadingSheets[player.characterId];
                                }
                            })();
                        }
                    }
                    continue; 
                }
                
                const sheet = loadedSheets[player.characterId];
                let sprite = playerSprites[player.uid];
                let text = playerText[player.uid];
        
                if(sprite){
                    if(sprite.characterId !== player.characterId) {
                        sprite.destroy();
                        if (text) text.destroy();
                        delete playerSprites[player.uid];
                        delete playerText[player.uid];
                        sprite = undefined;
                    } else if (player.uid !== currentUserId) {
                        sprite.x = player.x;
                        sprite.y = player.y;
                        const newAnim = `${player.direction || 'front'}_walk`;
                        if(sprite.currentAnimationName !== newAnim && sheet.animations[newAnim]) {
                           sprite.textures = sheet.animations[newAnim];
                           sprite.currentAnimationName = newAnim;
                           sprite.gotoAndStop(0);
                        }
                    }
                } 
                
                if(!sprite) {
                    if (!sheet) continue;
                    const animationName = `${player.direction || 'front'}_walk`;
                    const newSprite: PlayerSprite = new AnimatedSprite(sheet.animations[animationName]);
                    newSprite.characterId = player.characterId;
                    newSprite.currentAnimationName = animationName;
                    newSprite.animationSpeed = 0.15;
                    newSprite.anchor.set(0.5);
                    newSprite.scale.set(0.5);
                    newSprite.x = player.x;
                    newSprite.y = player.y;
                    world.addChild(newSprite);
                    playerSprites[player.uid] = newSprite;
        
                    const newText = new Text({
                        text: player.name || 'Player',
                        style: new TextStyle({
                            fontFamily: 'Inter, sans-serif', fontSize: 12,
                            fill: 0xffffff, stroke: { color: 0x000000, width: 3, join: 'round' },
                            align: 'center',
                        })
                    });
                    newText.anchor.set(0.5, 1);
                    world.addChild(newText);
                    playerText[player.uid] = newText;
                }
            }
        };

        const createNpcSpriteInternal = async () => {
            const character = CHARACTERS_MAP[NPC.characterId];
            if (!character) return null;
        
            if (!loadedSheets[NPC.characterId] && !loadingSheets[NPC.characterId]) {
                loadingSheets[NPC.characterId] = true;
                try {
                    if (app.destroyed) return null;
                    const baseTexture = await Assets.load<Texture>(character.png.src);
                    if (app.destroyed) return null;
                    const sheet = new Spritesheet(baseTexture, character.json);
                    await sheet.parse();
                    loadedSheets[NPC.characterId] = sheet;
                } catch(e) {
                    console.error(`Failed to load character sheet for ${NPC.characterId}`, e);
                    delete loadingSheets[NPC.characterId];
                    return null;
                }
            }
            
            const sheet = loadedSheets[NPC.characterId];
            if (!sheet) return null;
        
            const newNpcSprite: PlayerSprite = new AnimatedSprite(sheet.animations[`${NPC.direction}_walk`]);
            newNpcSprite.characterId = NPC.characterId;
            newNpcSprite.gotoAndStop(0);
            newNpcSprite.anchor.set(0.5);
            newNpcSprite.scale.set(0.5);
            newNpcSprite.x = NPC.x;
            newNpcSprite.y = NPC.y;
            newNpcSprite.zIndex = NPC.y;
        
            const text = new Text({
                text: NPC.name,
                style: new TextStyle({
                  fontFamily: 'Inter, sans-serif', fontSize: 12,
                  fill: 0xffff00, stroke: { color: 0x000000, width: 3, join: 'round' },
                  align: 'center',
                })
            });
            text.anchor.set(0.5, 1);
            text.x = newNpcSprite.x;
            text.y = newNpcSprite.y - (newNpcSprite.height * newNpcSprite.scale.y) - 5;
            text.zIndex = newNpcSprite.zIndex + 1;
            
            world.addChild(newNpcSprite, text);
            return newNpcSprite;
        }

        npcSprite = await createNpcSpriteInternal();
        if (app.destroyed) return;
        
        npcProximityIndicator = createNpcProximityIndicator(world);

        const resizeHandler = () => {
            if (app.destroyed) return;
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
                        background.height = screenHeight / bgRatio;
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
            if (app.destroyed) return;
            const { currentPlayer: localPlayer } = propsRef.current;
            if (!localPlayer) return;
            const playerRef = ref(rtdb, `players/${localPlayer.uid}`);
            update(playerRef, data);
        }, 100);

        const checkCollision = (x: number, y: number): boolean => {
            if (!collisionMap.length) return false;
            const playerWidth = 16 * 0.5;
            const playerHeight = 16 * 0.5;
            const bounds = {
                left: x - playerWidth / 2, right: x + playerWidth / 2,
                top: y - playerHeight, bottom: y,
            };
            const corners = [
                { x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.top },
                { x: bounds.left, y: bounds.bottom }, { x: bounds.right, y: bounds.bottom },
            ];
            for (const corner of corners) {
                const tileX = Math.floor(corner.x / TILE_SIZE);
                const tileY = Math.floor(corner.y / TILE_SIZE);
                if (collisionMap[tileY]?.[tileX]) return true;
            }
            return false;
        };
        
        tickerCallback = () => {
            if (app.destroyed) return;

            const { gameState, currentPlayer: localPlayer, onlinePlayers, onProximityChange } = propsRef.current;
            resizeHandler();
            
            const allPlayers = localPlayer ? [localPlayer, ...onlinePlayers] : onlinePlayers;
            updatePlayerSprites(allPlayers, localPlayer?.uid);

            if (gameState !== 'playing' || !localPlayer) return;

            const playerSprite = playerSprites[localPlayer.uid];
            if (!playerSprite || !playerSprite.parent) return;

            const speed = 2.5;
            let dx = 0; let dy = 0;
            if (keysDown['w'] || keysDown['arrowup']) dy -= 1;
            if (keysDown['s'] || keysDown['arrowdown']) dy += 1;
            if (keysDown['a'] || keysDown['arrowleft']) dx -= 1;
            if (keysDown['d'] || keysDown['arrowright']) dx += 1;
            
            let newDirection: Player['direction'] = playerSprite.currentAnimationName?.split('_')[0] as any || 'front';
            let moved = false;
            const targetX = playerSprite.x + dx * speed;
            const targetY = playerSprite.y + dy * speed;
            if (dx !== 0 || dy !== 0) {
                let canMoveX = !checkCollision(targetX, playerSprite.y);
                let canMoveY = !checkCollision(playerSprite.x, targetY);
                if (canMoveX && canMoveY && !checkCollision(targetX, targetY)) {
                    playerSprite.x = targetX; playerSprite.y = targetY; moved = true;
                } else if (canMoveX) {
                    playerSprite.x = targetX; moved = true;
                } else if (canMoveY) {
                    playerSprite.y = targetY; moved = true;
                }
            }

            if (moved) {
                if (dy < 0) newDirection = 'back'; else if (dy > 0) newDirection = 'front';
                if (dx < 0) newDirection = 'left'; else if (dx > 0) newDirection = 'right';
                updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
                const sheet = loadedSheets[localPlayer.characterId];
                if(sheet){
                    const newAnimationName = `${newDirection}_walk`;
                    if (playerSprite.currentAnimationName !== newAnimationName && sheet.animations[newAnimationName]) {
                        playerSprite.textures = sheet.animations[newAnimationName];
                        playerSprite.currentAnimationName = newAnimationName;
                    }
                    if (!playerSprite.playing) {
                        playerSprite.animationSpeed = 0.15;
                        playerSprite.play();
                    }
                }
            } else {
                if (playerSprite.playing) playerSprite.gotoAndStop(0);
            }
            
            for (const uid in playerSprites) {
              const sprite = playerSprites[uid];
              const text = playerText[uid];
              if (sprite && text) {
                text.x = sprite.x;
                text.y = sprite.y - (sprite.height * sprite.scale.y) - 5;
                sprite.zIndex = sprite.y;
              }
            }

            const getOfficeId = (x: number, y: number): number => {
                if (!officeMap.length) return 0;
                const tileX = Math.floor(x / TILE_SIZE);
                const tileY = Math.floor(y / TILE_SIZE);
                return officeMap[tileY]?.[tileX] || 0;
            };

            const localPlayerOfficeId = getOfficeId(playerSprite.x, playerSprite.y);
            
            for(const otherPlayer of onlinePlayers) {
                const otherSprite = playerSprites[otherPlayer.uid];
                if (!otherSprite) continue;

                const distance = Math.hypot(playerSprite.x - otherSprite.x, playerSprite.y - otherSprite.y);
                const isInProximity = distance < PROXIMITY_RANGE;

                const otherPlayerOfficeId = getOfficeId(otherSprite.x, otherSprite.y);
                const isInSameOffice = localPlayerOfficeId !== 0 && otherPlayerOfficeId === localPlayerOfficeId;

                const canInteract = isInProximity || isInSameOffice;

                let iconContainer = playerInteractionIcons[otherPlayer.uid];
                if (!iconContainer) {
                    iconContainer = new Container();
                    const micIcon = createMicIcon();
                    const cameraIcon = createCameraIcon();
                    cameraIcon.x = 15;
                    iconContainer.addChild(micIcon, cameraIcon);
                    world.addChild(iconContainer);
                    playerInteractionIcons[otherPlayer.uid] = iconContainer;
                }
                
                const micIcon = iconContainer.getChildByName('mic');
                const cameraIcon = iconContainer.getChildByName('camera');
                if (micIcon) micIcon.visible = canInteract && !!otherPlayer.isMicOn;
                if (cameraIcon) cameraIcon.visible = canInteract && !!otherPlayer.isCameraOn;
                iconContainer.x = otherSprite.x - 7.5;
                iconContainer.y = otherSprite.y - (otherSprite.height * otherSprite.scale.y) - 20;
                iconContainer.zIndex = otherSprite.y + 1;
            }

            world.sortChildren();
            
            if (npcSprite && !app.destroyed) {
                const distance = Math.hypot(playerSprite.x - npcSprite.x, playerSprite.y - npcSprite.y);
                const isNear = distance < NPC_PROXIMITY_RANGE;
                if (isNear !== npcProximityState) {
                    npcProximityState = isNear;
                    onProximityChange(isNear);
                }
                if (npcProximityIndicator) {
                    npcProximityIndicator.visible = isNear;
                    if (isNear) {
                        npcProximityIndicator.x = npcSprite.x;
                        npcProximityIndicator.y = npcSprite.y - (npcSprite.height * npcSprite.scale.y) - 10;
                        const pulse = Math.sin(app.ticker.lastTime / 200) * 0.1 + 0.9;
                        npcProximityIndicator.scale.set(pulse);
                    }
                }
            }
        };
        app.ticker.add(tickerCallback);
    };

    init().catch(err => {
        console.error("Failed to initialize Pixi canvas:", err);
    });

    // The cleanup function is the single source of truth for teardown.
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      
      // Safety check: ensure the app instance exists and hasn't been destroyed.
      if (app && !app.destroyed) {
        if (tickerCallback) {
            app.ticker.remove(tickerCallback);
        }
        // This is the only place the app is destroyed.
        app.destroy(true, { children: true, texture: true, baseTexture: true });
      }
    };
  }, []); 

  return <div ref={pixiContainerRef} className="w-full h-full" />;
};


function createNpcProximityIndicator(world: Container) {
    const indicator = new Graphics();
    indicator.circle(0, 0, 20).stroke({ width: 2, color: 0xFFFF00, alpha: 0.8 });
    indicator.visible = false;
    indicator.zIndex = 9999;
    world.addChild(indicator);
    return indicator;
}

function createMicIcon() {
    const mic = new Graphics();
    mic.roundRect(-4, -8, 8, 10, 4).fill(0xCCCCCC);
    mic.rect(-1.5, 2, 3, 5).fill(0x999999);
    mic.name = 'mic';
    mic.visible = false;
    return mic;
}

function createCameraIcon() {
    const camera = new Graphics();
    camera.roundRect(-8, -5, 16, 10, 3).fill(0x999999);
    camera.circle(2, 0, 3).fill(0x44DDFF);
    camera.name = 'camera';
    camera.visible = false;
    return camera;
}

export default PixiCanvas;
