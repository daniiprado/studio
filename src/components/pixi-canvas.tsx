
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet, Graphics, Texture } from 'pixi.js';
import type { Player } from '@/lib/types';
import { CHARACTERS_MAP } from '@/lib/characters';
import { rtdb } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { throttle } from 'lodash';

interface PixiCanvasProps {
  currentPlayer: Player;
  onlinePlayers: Player[];
}

type PlayerSprite = AnimatedSprite & { currentAnimationName?: string; };

const PixiCanvas = ({ currentPlayer, onlinePlayers }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const playerSpritesRef = useRef<Record<string, PlayerSprite>>({});
  const playerTextRef = useRef<Record<string, Text>>({});
  const loadedSheetsRef = useRef<Record<string, Spritesheet>>({});
  const keysDown = useRef<Record<string, boolean>>({});
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');
  
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

    if ( (data.x !== undefined && isNaN(data.x)) || (data.y !== undefined && isNaN(data.y)) ) {
      // This block should not be reached anymore with the new checks in the ticker.
      return; 
    }

    const playerRef = ref(rtdb, `players/${localPlayer.uid}`);
    await update(playerRef, data);
  }, 100), []);

  useEffect(() => {
    if (!pixiContainer.current || appRef.current) return;

    const app = new Application();
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

      const world = new Container();
      world.sortableChildren = true;
      world.visible = false; 
      worldRef.current = world;
      app.stage.addChild(world);

      const lobbyContainer = new Container();
      app.stage.addChild(lobbyContainer);

      const buttonGraphic = new Graphics();
      buttonGraphic.roundRect(0, 0, 220, 70, 15).fill({ color: 0x000000, alpha: 0.6 });
      buttonGraphic.stroke({ width: 3, color: 0xffffff });

      const buttonText = new Text({
        text: 'ENTRAR',
        style: {
          fill: 0xffffff,
          fontSize: 28,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 'bold',
        }
      });
      buttonText.anchor.set(0.5);
      buttonText.position.set(buttonGraphic.width / 2, buttonGraphic.height / 2);
      
      const enterButton = new Container();
      enterButton.addChild(buttonGraphic, buttonText);
      enterButton.position.set(
        app.screen.width / 2 - buttonGraphic.width / 2,
        app.screen.height / 2 - buttonGraphic.height / 2
      );
      enterButton.eventMode = 'static';
      enterButton.cursor = 'pointer';

      const onEnterClick = () => {
        setGameState('playing');
        lobbyContainer.visible = false;
        if(worldRef.current) worldRef.current.visible = true;
      };
      
      enterButton.on('pointertap', onEnterClick);
      lobbyContainer.addChild(enterButton);
      
      const resizeHandler = () => {
        if (lobbyContainer.visible) {
            enterButton.position.set(
                app.screen.width / 2 - enterButton.width / 2,
                app.screen.height / 2 - enterButton.height / 2
            );
        }
      };
      app.renderer.on('resize', resizeHandler);

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      app.ticker.add((time) => {
        if (gameStateRef.current !== 'playing') return;
        
        const localPlayer = currentPlayerRef.current;
        if (!localPlayer) return;

        const playerSprite = playerSpritesRef.current[localPlayer.uid];
        if (!playerSprite || playerSprite.destroyed) return;
        
        // DEFINITIVE FIX 1: Aggressively reset coordinates if they are ever NaN.
        // This handles race conditions where the sprite exists but its position hasn't been set.
        if (isNaN(playerSprite.x)) playerSprite.x = 0;
        if (isNaN(playerSprite.y)) playerSprite.y = 0;
        
        const sheet = loadedSheetsRef.current[localPlayer.characterId];
        if (!sheet) return;
        
        const speed = 2.5;
        let dx = 0;
        let dy = 0;

        if (keysDown.current['w'] || keysDown.current['arrowup']) dy -= 1;
        if (keysDown.current['s'] || keysDown.current['arrowdown']) dy += 1;
        if (keysDown.current['a'] || keysDown.current['arrowleft']) dx -= 1;
        if (keysDown.current['d'] || keysDown.current['arrowright']) dx += 1;
        
        const moved = dx !== 0 || dy !== 0;
        let newDirection: Player['direction'] = playerSprite.currentAnimationName?.split('_')[0] as Player['direction'] || 'front';

        if (moved) {
            if (dy < 0) { newDirection = 'back'; }
            else if (dy > 0) { newDirection = 'front'; }
            else if (dx < 0) { newDirection = 'left'; }
            else if (dx > 0) { newDirection = 'right'; }
            
            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }

            playerSprite.x += dx * speed * time.delta;
            playerSprite.y += dy * speed * time.delta;
            
            // DEFINITIVE FIX 2: Check the result of the calculation *before* sending to the database.
            // This prevents the throttled update function from ever being called with bad data.
            if (!isNaN(playerSprite.x) && !isNaN(playerSprite.y)) {
              updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
            }
        }
        
        const newAnimationName = `${newDirection}_walk`;
        if (playerSprite.currentAnimationName !== newAnimationName) {
            if(sheet.animations[newAnimationName]) {
                playerSprite.textures = sheet.animations[newAnimationName];
                playerSprite.currentAnimationName = newAnimationName;
            }
        }
        
        if (moved && !playerSprite.playing) {
            playerSprite.play();
        } else if (!moved && playerSprite.playing) {
            playerSprite.gotoAndStop(0);
        }

        const playerText = playerTextRef.current[localPlayer.uid];
        if (playerText) {
          playerText.x = playerSprite.x;
          playerText.y = playerSprite.y - playerSprite.height - 5;
        }

        if (worldRef.current && worldRef.current.pivot) {
          worldRef.current.pivot.x = playerSprite.x;
          worldRef.current.pivot.y = playerSprite.y;
          worldRef.current.position.set(app.screen.width / 2, app.screen.height / 2);
        }
      });
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
  }, [updatePlayerInDb]);

  useEffect(() => {
    if (!appRef.current || !worldRef.current) return;
    const world = worldRef.current;

    if (gameState !== 'playing') {
      return;
    }

    const loadAssetsAndPlayers = async () => {
      const playersToRender = new Map<string, Player>();
      playersToRender.set(currentPlayer.uid, currentPlayer);

      onlinePlayers.forEach(p => {
        if (p.uid !== currentPlayer.uid) {
            playersToRender.set(p.uid, p)
        }
      });
      
      const allPlayers = Array.from(playersToRender.values());
      const allPlayerIds = allPlayers.map(p => p.uid);
      const characterIds = new Set(allPlayers.map(p => p.characterId).filter(Boolean));

      for (const id of characterIds) {
        if (!loadedSheetsRef.current[id] && CHARACTERS_MAP[id]) {
            const character = CHARACTERS_MAP[id];
            const baseTexture = await Assets.load<Texture>(character.png.src);
            const sheet = new Spritesheet(
                baseTexture,
                character.json
            );
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
          
          if(sprite.textures[0].baseTexture.uid !== sheet.baseTexture.uid){
             sprite.destroy();
             text.destroy();
             delete playerSpritesRef.current[player.uid];
             delete playerTextRef.current[player.uid];
          } else {
             if (!isCurrentUser) {
                // Ensure data from DB is a valid number before applying it
                sprite.x = (typeof player.x === 'number' && !isNaN(player.x)) ? player.x : sprite.x;
                sprite.y = (typeof player.y === 'number' && !isNaN(player.y)) ? player.y : sprite.y;
                
                if (sprite.currentAnimationName !== animationName && sheet.animations[animationName]) {
                    sprite.textures = sheet.animations[animationName];
                    sprite.currentAnimationName = animationName;
                    sprite.gotoAndStop(0);
                }
             }
             text.x = sprite.x;
             text.y = sprite.y - sprite.height - 5;
             text.text = player.name || 'Player';
          }
        }

        if (!playerSpritesRef.current[player.uid]) {
          if(!sheet.animations[animationName]) continue;
          
          const sprite: PlayerSprite = new AnimatedSprite(sheet.animations[animationName]);
          sprite.currentAnimationName = animationName;
          sprite.animationSpeed = 0.15;
          sprite.anchor.set(0.5);
          // Ensure initial data is a valid number
          sprite.x = (typeof player.x === 'number' && !isNaN(player.x)) ? player.x : 0;
          sprite.y = (typeof player.y === 'number' && !isNaN(player.y)) ? player.y : 0;
          sprite.zIndex = 1;
          sprite.gotoAndStop(0);
          
          world.addChild(sprite);
          playerSpritesRef.current[player.uid] = sprite;

          const text = new Text({
            text: player.name || 'Player',
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 3, join: 'round' },
              align: 'center',
            }
          });
          text.anchor.set(0.5, 1);
          text.x = sprite.x;
          text.y = sprite.y - sprite.height - 5;
          text.zIndex = 2;
          world.addChild(text);
          playerTextRef.current[player.uid] = text;
        }
      }
    };
    
    loadAssetsAndPlayers();
    
  }, [onlinePlayers, currentPlayer, gameState]);

  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
