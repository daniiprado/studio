
'use client';

import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet, Graphics, Sprite, Texture, TextStyle, Rectangle, Ticker } from 'pixi.js';
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
const TILESET_COLUMNS = 33; 

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

const PixiCanvas = (props: PixiCanvasProps) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  
  useEffect(() => {
    propsRef.current = props;
  });

  useLayoutEffect(() => {
    const pixiElement = pixiContainerRef.current;
    if (!pixiElement) return;

    // Create the app instance synchronously. It will never be undefined in the cleanup.
    const app = new Application();
    
    // Use a cancellation flag to stop async operations if the component unmounts.
    let isDestroyed = false;

    const keysDown: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => { keysDown[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    const init = async () => {
      try {
        await app.init({
            resizeTo: pixiElement,
            backgroundColor: 0x60bb38,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        });
        // Check flag after every await
        if (isDestroyed) return;

        pixiElement.appendChild(app.view);
        
        const world = new Container();
        world.sortableChildren = true;
        app.stage.addChild(world);
        
        const mapContainer = new Container();
        mapContainer.zIndex = 0;
        world.addChild(mapContainer);
        
        const [tilesetTexture, loadedMapData] = await Promise.all([
          Assets.load<Texture>(TILESET_URL),
          Promise.resolve(mapData)
        ]);

        if (isDestroyed) return;
        
        let collisionMap: boolean[][] = Array.from({ length: MAP_HEIGHT_TILES }, () => Array(MAP_WIDTH_TILES).fill(false));
        let officeMap: number[][] = Array.from({ length: MAP_HEIGHT_TILES }, () => Array(MAP_WIDTH_TILES).fill(0));

        loadedMapData.layers.forEach(layer => {
            if (!layer.visible) return;
            const { data, width, name } = layer;

            for (let y = 0; y < layer.height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = y * width + x;
                    const gid = data[i];
                    if (gid === 0) continue;

                    const tileIndex = gid - loadedMapData.tilesets[0].firstgid;
                    const sx = (tileIndex % TILESET_COLUMNS) * TILE_SIZE;
                    const sy = Math.floor(tileIndex / TILESET_COLUMNS) * TILE_SIZE;
                    
                    const texture = new Texture({
                        source: tilesetTexture.source,
                        frame: new Rectangle(sx, sy, TILE_SIZE, TILE_SIZE),
                    });

                    const tileSprite = new Sprite(texture);
                    tileSprite.x = x * TILE_SIZE;
                    tileSprite.y = y * TILE_SIZE;
                    mapContainer.addChild(tileSprite);

                    if (name === 'trees') {
                        collisionMap[y][x] = true;
                    }
                    if (name === 'offices') {
                        officeMap[y][x] = gid;
                    }
                }
            }
        });

        const lobby = new Container();
        app.stage.addChild(lobby);
        
        const backgroundLobbyTexture = await Assets.load(lobbyImage.src);
        if (isDestroyed) return;

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
          propsRef.current.setGameState('playing');
        });
        lobby.addChild(enterButton);

        const playerSprites: Record<string, PlayerSprite> = {};
        const playerText: Record<string, Text> = {};
        const playerInteractionIcons: Record<string, Container> = {};
        const loadedSheets: Record<string, Spritesheet> = {};
        const loadingSheets: Record<string, boolean> = {};
        
        const createNpcSpriteInternal = async () => {
            const character = CHARACTERS_MAP[NPC.characterId];
            if (!character) return null;
        
            if (!loadedSheets[NPC.characterId] && !loadingSheets[NPC.characterId]) {
                loadingSheets[NPC.characterId] = true;
                try {
                    const npcBaseTexture = await Assets.load<Texture>(character.png.src);
                    if (isDestroyed) return null;
                    const sheet = new Spritesheet(npcBaseTexture, character.json);
                    await sheet.parse();
                    if (isDestroyed) return null;
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

        const npcSprite = await createNpcSpriteInternal();
        if (isDestroyed) return;
        
        const npcProximityIndicator = createNpcProximityIndicator(world);
        let npcProximityState = false;

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
                if (collisionMap[tileY]?.[tileX]) return true;
            }
            return false;
        };
        
        const tickerCallback = (time: Ticker) => {
            if (isDestroyed) return;

            const { gameState, currentPlayer: localPlayer, onlinePlayers, onProximityChange } = propsRef.current;
            resizeHandler();
            
            const allPlayers = localPlayer ? [localPlayer, ...onlinePlayers] : onlinePlayers;
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
                                    const charBaseTexture = await Assets.load<Texture>(character.png.src);
                                    if(isDestroyed) return;
                                    const sheet = new Spritesheet(charBaseTexture, character.json);
                                    await sheet.parse();
                                    if(isDestroyed) return;
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
                    } else if (player.uid !== localPlayer?.uid) {
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

            if (gameState !== 'playing' || !localPlayer) return;
            const playerSprite = playerSprites[localPlayer.uid];
            if (!playerSprite || !playerSprite.parent) return;

            const speed = 2.0; 
            let dx = 0; let dy = 0;
            if (keysDown['w'] || keysDown['arrowup']) dy -= 1;
            if (keysDown['s'] || keysDown['arrowdown']) dy += 1;
            if (keysDown['a'] || keysDown['arrowleft']) dx -= 1;
            if (keysDown['d'] || keysDown['arrowright']) dx += 1;
            
            let newDirection: Player['direction'] = playerSprite.currentAnimationName?.split('_')[0] as any || 'front';
            let moved = false;
            
            const moveX = dx * speed * time.deltaTime;
            const moveY = dy * speed * time.deltaTime;

            const targetX = playerSprite.x + moveX;
            const targetY = playerSprite.y + moveY;

            if (dx !== 0 || dy !== 0) {
                let canMoveX = !checkCollision(targetX, playerSprite.y);
                let canMoveY = !checkCollision(playerSprite.x, targetY);
                if (canMoveX && canMoveY && !checkCollision(targetX, targetY)) {
                    playerSprite.x = targetX;
                    playerSprite.y = targetY;
                    moved = true;
                } else if (canMoveX) {
                    playerSprite.x = targetX;
                    moved = true;
                } else if (canMoveY) {
                    playerSprite.y = targetY;
                    moved = true;
                }
            }

            if (moved) {
                if (dy < 0) newDirection = 'back';
                else if (dy > 0) newDirection = 'front';
                else if (dx < 0) newDirection = 'left';
                else if (dx > 0) newDirection = 'right';

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
                    iconContainer.addChild(createMicIcon(), createCameraIcon());
                    world.addChild(iconContainer);
                    playerInteractionIcons[otherPlayer.uid] = iconContainer;
                }
                
                const micIcon = iconContainer.getChildByName('mic');
                const cameraIcon = iconContainer.getChildByName('camera');
                if (micIcon) micIcon.visible = canInteract && !!otherPlayer.isMicOn;
                if (cameraIcon) {
                    cameraIcon.visible = canInteract && !!otherPlayer.isCameraOn;
                    cameraIcon.x = 15;
                }
                iconContainer.x = otherSprite.x - 7.5;
                iconContainer.y = otherSprite.y - (otherSprite.height * otherSprite.scale.y) - 20;
                iconContainer.zIndex = otherSprite.y + 1;
            }

            world.sortChildren();
            
            if (npcSprite) {
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

      } catch (error) {
        console.error("Error during Pixi initialization:", error);
      }
    };

    init();

    // The robust cleanup function.
    return () => {
      isDestroyed = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      
      // `app` is guaranteed to be defined here from the synchronous creation above.
      // The only check we need is if it has already been destroyed.
      if (!app.destroyed) {
        app.destroy(true, { children: true, texture: true, baseTexture: true });
      }
    };
  }, []);

  return <div ref={pixiContainerRef} className="w-full h-full" />;
};


export default PixiCanvas;
