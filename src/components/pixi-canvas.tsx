'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet } from 'pixi.js';
import type { Player } from '@/lib/types';
import { CHARACTERS_MAP } from '@/lib/characters';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
  
  const currentPlayerRef = useRef(currentPlayer);
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  const updatePlayerInDb = useCallback(throttle(async (data: Partial<Player>) => {
    const localPlayer = currentPlayerRef.current;
    if (!localPlayer) return;
    const playerDocRef = doc(db, 'players', localPlayer.uid);
    await updateDoc(playerDocRef, data);
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
      worldRef.current = world;
      app.stage.addChild(world);

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      app.ticker.add((time) => {
        const localPlayer = currentPlayerRef.current;
        if (!localPlayer) return;

        const playerSprite = playerSpritesRef.current[localPlayer.uid];
        if (!playerSprite) return;
        
        const sheet = loadedSheetsRef.current[localPlayer.characterId];
        if (!sheet) return;

        const speed = 2.5;
        let dx = 0;
        let dy = 0;
        
        if (keysDown.current['w'] || keysDown.current['arrowup']) dy -= 1;
        if (keysDown.current['s'] || keysDown.current['arrowdown']) dy += 1;
        if (keysDown.current['a'] || keysDown.current['arrowleft']) dx -= 1;
        if (keysDown.current['d'] || keysDown.current['arrowright']) dx += 1;
        
        let moved = dx !== 0 || dy !== 0;
        let currentAnimationName = playerSprite.currentAnimationName || `${localPlayer.direction}_walk`;
        let newDirection: Player['direction'] = (playerSprite.currentAnimationName?.split('_')[0] as Player['direction']) ?? 'front';
        let animationShouldPlay = moved;
        
        if (moved) {
            if (dy < 0) { newDirection = 'back'; }
            else if (dy > 0) { newDirection = 'front'; }
            else if (dx < 0) { newDirection = 'left'; }
            else if (dx > 0) { newDirection = 'right'; }
            
            const newAnimationName = `${newDirection}_walk`;
            
            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }

            playerSprite.x += dx * speed * time.delta;
            playerSprite.y += dy * speed * time.delta;
          
            if (currentAnimationName !== newAnimationName) {
                if(sheet.animations[newAnimationName]) {
                    playerSprite.textures = sheet.animations[newAnimationName];
                    playerSprite.currentAnimationName = newAnimationName;
                }
            }
          
            updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
        }
        
        if (animationShouldPlay && !playerSprite.playing) {
            playerSprite.play();
        } else if (!animationShouldPlay && playerSprite.playing) {
            playerSprite.gotoAndStop(0);
        }

        const playerText = playerTextRef.current[localPlayer.uid];
        if (playerText) {
          playerText.x = playerSprite.x;
          playerText.y = playerSprite.y - playerSprite.height / 2 - 10;
        }

        if (worldRef.current) {
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

    const loadAssetsAndPlayers = async () => {
      const playersToRender = new Map<string, Player>();
      onlinePlayers.forEach(p => playersToRender.set(p.uid, p));
      if (currentPlayer) {
        playersToRender.set(currentPlayer.uid, currentPlayer);
      }
      
      const allPlayers = Array.from(playersToRender.values());
      const allPlayerIds = allPlayers.map(p => p.uid);
      const characterIds = new Set(allPlayers.map(p => p.characterId));

      for (const id of characterIds) {
        if (!loadedSheetsRef.current[id] && CHARACTERS_MAP[id]) {
            const character = CHARACTERS_MAP[id];
            const texture = await Assets.load(character.png.src);
            const sheet = new Spritesheet(
                texture.baseTexture,
                character.json
            );
            await sheet.parse();
            loadedSheetsRef.current[id] = sheet;
        }
      }

      const currentPlayersInScene = Object.keys(playerSpritesRef.current);
      currentPlayersInScene.forEach(uid => {
        if (!allPlayerIds.includes(uid)) {
          if (playerSpritesRef.current[uid]) world.removeChild(playerSpritesRef.current[uid]);
          if (playerTextRef.current[uid]) world.removeChild(playerTextRef.current[uid]);
          delete playerSpritesRef.current[uid];
          delete playerTextRef.current[uid];
        }
      });

      for (const player of allPlayers) {
        const sheet = loadedSheetsRef.current[player.characterId];
        if (!sheet) continue;

        const isCurrentUser = player.uid === currentPlayer.uid;
        const animationName = `${player.direction || 'front'}_walk`;

        if (playerSpritesRef.current[player.uid]) {
          const sprite = playerSpritesRef.current[player.uid];
          const text = playerTextRef.current[player.uid];
          
          if(sprite.textures[0].baseTexture !== sheet.baseTexture){
             world.removeChild(sprite, text);
             delete playerSpritesRef.current[player.uid];
             delete playerTextRef.current[player.uid];
          } else {
            // Always update position for all players from the authoritative source (props)
            sprite.x = player.x;
            sprite.y = player.y;

            // For remote players, update their animation based on DB data.
            // For the local player, the ticker handles animation changes based on input.
            if (!isCurrentUser) {
              if (sprite.currentAnimationName !== animationName && sheet.animations[animationName]) {
                sprite.textures = sheet.animations[animationName];
                sprite.currentAnimationName = animationName;
                sprite.gotoAndStop(0);
              }
            }

            text.x = sprite.x;
            text.y = sprite.y - sprite.height / 2 - 10;
            text.text = player.name || 'Player';
          }
        }

        if (!playerSpritesRef.current[player.uid]) {
          if(!sheet.animations[animationName]) continue;
          
          const sprite: PlayerSprite = new AnimatedSprite(sheet.animations[animationName]);
          sprite.currentAnimationName = animationName;
          sprite.animationSpeed = 0.15;
          sprite.anchor.set(0.5);
          sprite.x = player.x;
          sprite.y = player.y;
          sprite.zIndex = 1;
          
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
          text.y = sprite.y - sprite.height / 2 - 10;
          text.zIndex = 2;
          world.addChild(text);
          playerTextRef.current[player.uid] = text;
        }
      }
    };
    
    loadAssetsAndPlayers();
    
  }, [onlinePlayers, currentPlayer]);

  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
