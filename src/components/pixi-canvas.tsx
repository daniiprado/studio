'use client';
import { useRef, useEffect, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Player } from '@/lib/types';
import { CHARACTERS_MAP } from '@/lib/characters';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { throttle } from 'lodash';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
}

const PixiCanvas = ({ currentPlayer, onlinePlayers }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const playerSpritesRef = useRef<Record<string, PIXI.AnimatedSprite>>({});
  const playerTextRef = useRef<Record<string, PIXI.Text>>({});
  const loadedSheetsRef = useRef<Record<string, PIXI.Spritesheet>>({});
  const keysDown = useRef<Record<string, boolean>>({});

  const updatePlayerInDb = throttle(async (data: Partial<Player>) => {
    if (!currentPlayer) return;
    const playerDocRef = doc(db, 'players', currentPlayer.uid);
    await updateDoc(playerDocRef, data);
  }, 200);

  const initPixi = useCallback(async () => {
    const app = new PIXI.Application();
    await app.init({
      width: pixiContainer.current!.clientWidth,
      height: pixiContainer.current!.clientHeight,
      backgroundColor: 0x1099bb,
      resizeTo: pixiContainer.current!,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    appRef.current = app;
    pixiContainer.current!.appendChild(app.view as HTMLCanvasElement);

    const world = new PIXI.Container();
    worldRef.current = world;
    app.stage.addChild(world);
    
    // Keyboard listeners
    const onKeyDown = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Game loop
    let currentAnimation = 'front_walk';

    app.ticker.add((time) => {
      const delta = time.delta;
      const speed = 2.0 * delta;
      const playerSprite = playerSpritesRef.current[currentPlayer.uid];
      const playerText = playerTextRef.current[currentPlayer.uid];

      if (playerSprite && world) {
        let moved = false;
        let newAnimation = currentAnimation;
        let newDirection: Player['direction'] = currentPlayer.direction;
        
        let dx = 0;
        let dy = 0;

        if (keysDown.current['w'] || keysDown.current['arrowup']) dy -= 1;
        if (keysDown.current['s'] || keysDown.current['arrowdown']) dy += 1;
        if (keysDown.current['a'] || keysDown.current['arrowleft']) dx -= 1;
        if (keysDown.current['d'] || keysDown.current['arrowright']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            moved = true;
            
            if (dy < 0) { newDirection = 'back'; newAnimation = 'back_walk'; }
            else if (dy > 0) { newDirection = 'front'; newAnimation = 'front_walk'; }
            else if (dx < 0) { newDirection = 'left'; newAnimation = 'left_walk'; }
            else if (dx > 0) { newDirection = 'right'; newAnimation = 'right_walk'; }
            
            // Prioritize vertical animations during diagonal movement
            if (dy < 0) { newAnimation = 'back_walk'; }
            if (dy > 0) { newAnimation = 'front_walk'; }

            // Diagonal movement normalization
            const length = Math.sqrt(dx * dx + dy * dy);
            playerSprite.x += (dx / length) * speed;
            playerSprite.y += (dy / length) * speed;
        }

        if (newAnimation !== currentAnimation && loadedSheetsRef.current[currentPlayer.characterId]) {
          playerSprite.textures = loadedSheetsRef.current[currentPlayer.characterId].animations[newAnimation];
          currentAnimation = newAnimation;
        }

        if(moved) {
            if(!playerSprite.playing) playerSprite.play();
            updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
        } else {
            if(playerSprite.playing) {
                playerSprite.gotoAndStop(0);
            }
        }
        
        if (playerText) {
          playerText.x = playerSprite.x;
          playerText.y = playerSprite.y - playerSprite.height / 2 - 4;
        }

        // Center camera on player
        world.pivot.x = playerSprite.x;
        world.pivot.y = playerSprite.y;
        world.position.x = app.screen.width / 2;
        world.position.y = app.screen.height / 2;
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  }, [currentPlayer, updatePlayerInDb]);

  useEffect(() => {
    if (!pixiContainer.current || appRef.current) return;

    let cleanupTicker: (() => void) | undefined;
    
    initPixi().then(cleanup => {
        cleanupTicker = cleanup;
    });

    return () => {
      cleanupTicker?.();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, [initPixi]);

  useEffect(() => {
    if (!appRef.current || !worldRef.current) return;
    const world = worldRef.current;

    const loadAssetsAndPlayers = async () => {
        // Load all required character assets
        const characterIds = new Set(onlinePlayers.map(p => p.characterId));
        for (const id of characterIds) {
            if (!loadedSheetsRef.current[id] && CHARACTERS_MAP[id]) {
                const characterAsset = CHARACTERS_MAP[id];
                loadedSheetsRef.current[id] = await PIXI.Assets.load(characterAsset.json);
            }
        }

        const currentPlayersInScene = Object.keys(playerSpritesRef.current);
        const onlinePlayerIds = onlinePlayers.map(p => p.uid);

        // Remove offline players
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
        for (const player of onlinePlayers) {
            const sheet = loadedSheetsRef.current[player.characterId];
            if (!sheet) continue;

            const isCurrentUser = player.uid === currentPlayer.uid;

            const animationName = player.direction === 'front' ? 'front_walk' :
                                  player.direction === 'back' ? 'back_walk' :
                                  player.direction === 'left' ? 'left_walk' : 'right_walk';

            if (playerSpritesRef.current[player.uid]) { // Player exists, update
                const sprite = playerSpritesRef.current[player.uid];
                const text = playerTextRef.current[player.uid];
                
                // If character changed, recreate sprite
                if (sprite.label !== player.characterId) {
                     world.removeChild(sprite, text);
                     delete playerSpritesRef.current[player.uid];
                     delete playerTextRef.current[player.uid];
                     // will be recreated in the 'else' block
                } else {
                    if (!isCurrentUser) { // Update remote players
                        const isMoving = sprite.x !== player.x || sprite.y !== player.y;
                        sprite.x = player.x;
                        sprite.y = player.y;

                        if (sprite.currentAnimation !== animationName) {
                            sprite.textures = sheet.animations[animationName];
                            sprite.currentAnimation = animationName;
                        }

                        if(isMoving) {
                            if(!sprite.playing) sprite.play();
                        } else {
                            if(sprite.playing) sprite.gotoAndStop(0);
                        }
                    }
                    text.x = sprite.x;
                    text.y = sprite.y - sprite.height / 2 - 4;
                    text.text = player.name || 'Player';
                }
            }
            
            if (!playerSpritesRef.current[player.uid]) { // Player is new, create sprite
                const sprite = new PIXI.AnimatedSprite(sheet.animations[animationName]);
                sprite.label = player.characterId; // Tag sprite with character ID
                sprite.currentAnimation = animationName;
                sprite.animationSpeed = 0.15;
                sprite.anchor.set(0.5, 0.5);
                
                // Use the most up-to-date coordinates for the current user
                const initialX = isCurrentUser ? currentPlayer.x : player.x;
                const initialY = isCurrentUser ? currentPlayer.y : player.y;
                sprite.x = initialX;
                sprite.y = initialY;
                
                sprite.zIndex = 1;

                if (isCurrentUser) {
                    sprite.play();
                } else {
                    sprite.gotoAndStop(0);
                }
                
                world.addChild(sprite);
                playerSpritesRef.current[player.uid] = sprite;

                const text = new PIXI.Text({text: player.name || 'Player', style: {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12,
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: 3, join: 'round' },
                    align: 'center',
                }});
                text.anchor.set(0.5, 1);
                text.x = initialX;
                text.y = initialY - sprite.height / 2 - 4;
                text.zIndex = 2; // Text on top of player
                world.addChild(text);
                playerTextRef.current[player.uid] = text;
            }
        }
        world.sortableChildren = true;
    };
    
    loadAssetsAndPlayers();
    
  }, [onlinePlayers, currentPlayer]);


  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
