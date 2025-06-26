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

type PlayerSprite = PIXI.AnimatedSprite & { currentAnimationName?: string; };

const PixiCanvas = ({ currentPlayer, onlinePlayers }: PixiCanvasProps) => {
  const pixiContainer = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const playerSpritesRef = useRef<Record<string, PlayerSprite>>({});
  const playerTextRef = useRef<Record<string, PIXI.Text>>({});
  const loadedSheetsRef = useRef<Record<string, PIXI.Spritesheet>>({});
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
  }, 100), [currentPlayerRef]);

  useEffect(() => {
    if (!pixiContainer.current || appRef.current) return;

    const app = new PIXI.Application();
    const onKeyDown = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysDown.current[e.key.toLowerCase()] = false; };

    const initPixi = async () => {
      await app.init({
        backgroundColor: 0x1099bb,
        resizeTo: window,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      appRef.current = app;
      if (!pixiContainer.current) return;
      pixiContainer.current.replaceChildren(app.view as HTMLCanvasElement);

      const world = new PIXI.Container();
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
        
        const moved = dx !== 0 || dy !== 0;
        let newAnimationName = playerSprite.currentAnimationName || `${localPlayer.direction}_walk`;
        let newDirection = playerSprite.currentAnimationName?.split('_')[0] as Player['direction'] ?? 'front';

        if (moved) {
            if (dy < 0) { newDirection = 'back'; }
            else if (dy > 0) { newDirection = 'front'; }
            else if (dx < 0) { newDirection = 'left'; }
            else if (dx > 0) { newDirection = 'right'; }
            
            newAnimationName = `${newDirection}_walk`;
            
            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }

            playerSprite.x += dx * speed * time.delta;
            playerSprite.y += dy * speed * time.delta;
          
            if (playerSprite.currentAnimationName !== newAnimationName) {
                playerSprite.textures = sheet.animations[newAnimationName];
                playerSprite.currentAnimationName = newAnimationName;
            }
          
            if (!playerSprite.playing) playerSprite.play();
            updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
        } else {
          if (playerSprite.playing) playerSprite.gotoAndStop(0);
        }

        const playerText = playerTextRef.current[localPlayer.uid];
        if (playerText) {
          playerText.x = playerSprite.x;
          playerText.y = playerSprite.y - playerSprite.height - 4;
        }

        if (worldRef.current) {
          worldRef.current.pivot.x = playerSprite.x;
          worldRef.current.pivot.y = playerSprite.y;
          worldRef.current.position.x = app.screen.width / 2;
          worldRef.current.position.y = app.screen.height / 2;
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
  }, []);

  useEffect(() => {
    if (!appRef.current || !worldRef.current) return;
    const world = worldRef.current;

    const loadAssetsAndPlayers = async () => {
      const characterIds = new Set(onlinePlayers.map(p => p.characterId));
      for (const id of characterIds) {
        if (!loadedSheetsRef.current[id] && CHARACTERS_MAP[id]) {
            const character = CHARACTERS_MAP[id];
            // Manually create the spritesheet from the imported assets
            const sheet = new PIXI.Spritesheet(
                PIXI.BaseTexture.from(character.png.src),
                character.json
            );
            await sheet.parse();
            loadedSheetsRef.current[id] = sheet;
        }
      }

      const currentPlayersInScene = Object.keys(playerSpritesRef.current);
      const onlinePlayerIds = onlinePlayers.map(p => p.uid);

      currentPlayersInScene.forEach(uid => {
        if (!onlinePlayerIds.includes(uid)) {
          if (playerSpritesRef.current[uid]) world.removeChild(playerSpritesRef.current[uid]);
          if (playerTextRef.current[uid]) world.removeChild(playerTextRef.current[uid]);
          delete playerSpritesRef.current[uid];
          delete playerTextRef.current[uid];
        }
      });

      for (const player of onlinePlayers) {
        const sheet = loadedSheetsRef.current[player.characterId];
        if (!sheet) continue;

        const isCurrentUser = player.uid === currentPlayer.uid;
        const animationName = `${player.direction || 'front'}_walk`;

        if (playerSpritesRef.current[player.uid]) {
          const sprite = playerSpritesRef.current[player.uid];
          const text = playerTextRef.current[player.uid];

          if (sprite.texture.label !== player.characterId) {
            world.removeChild(sprite, text);
            delete playerSpritesRef.current[player.uid];
            delete playerTextRef.current[player.uid];
          } else if (!isCurrentUser) {
            // Smooth movement for other players can be added here later
            sprite.x = player.x;
            sprite.y = player.y;
            if (sprite.currentAnimationName !== animationName) {
              sprite.textures = sheet.animations[animationName];
              sprite.currentAnimationName = animationName;
              sprite.gotoAndStop(0);
            }
            text.x = sprite.x;
            text.y = sprite.y - sprite.height - 4;
            text.text = player.name || 'Player';
          }
        }

        if (!playerSpritesRef.current[player.uid]) {
          const sprite: PlayerSprite = new PIXI.AnimatedSprite(sheet.animations[animationName]);
          sprite.texture.label = player.characterId;
          sprite.currentAnimationName = animationName;
          sprite.animationSpeed = 0.15;
          sprite.anchor.set(0.5);
          // Use the most up-to-date position for the current player
          sprite.x = isCurrentUser ? currentPlayer.x : player.x;
          sprite.y = isCurrentUser ? currentPlayer.y : player.y;
          sprite.zIndex = 1;
          sprite.play();
          
          world.addChild(sprite);
          playerSpritesRef.current[player.uid] = sprite;

          const text = new PIXI.Text({
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
          text.y = sprite.y - sprite.height - 4;
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
