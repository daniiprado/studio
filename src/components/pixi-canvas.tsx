
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Application, Container, AnimatedSprite, Text, Assets, Spritesheet, Graphics } from 'pixi.js';
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

  // Use a ref for gameState to access it in the ticker without re-triggering effects
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const updatePlayerInDb = useCallback(throttle(async (data: Partial<Player>) => {
    const localPlayer = currentPlayerRef.current;
    if (!localPlayer) return;
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
      world.visible = false; // Start with the world invisible
      worldRef.current = world;
      app.stage.addChild(world);

      // --- LOBBY SCREEN ---
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
      // --- END LOBBY SCREEN ---


      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      app.ticker.add((time) => {
        if (gameStateRef.current !== 'playing') {
          return;
        }
        const localPlayer = currentPlayerRef.current;
        if (!localPlayer) return;

        const playerSprite = playerSpritesRef.current[localPlayer.uid];
        if (!playerSprite) return;
        
        const sheet = loadedSheetsRef.current[localPlayer.characterId];
        if (!sheet) return;

        const speed = 2.5;
        let dx = 0;
        let dy = 0;
        
        // Definitive Fix: Before any calculation, ensure sprite coordinates are valid.
        // This self-heals from any potential NaN state from the DB or race conditions.
        if (typeof playerSprite.x !== 'number' || isNaN(playerSprite.x)) {
            const safeX = typeof localPlayer.x === 'number' && !isNaN(localPlayer.x) ? localPlayer.x : 0;
            playerSprite.x = safeX;
        }
        if (typeof playerSprite.y !== 'number' || isNaN(playerSprite.y)) {
            const safeY = typeof localPlayer.y === 'number' && !isNaN(localPlayer.y) ? localPlayer.y : 0;
            playerSprite.y = safeY;
        }
        
        if (keysDown.current['w'] || keysDown.current['arrowup']) dy -= 1;
        if (keysDown.current['s'] || keysDown.current['arrowdown']) dy += 1;
        if (keysDown.current['a'] || keysDown.current['arrowleft']) dx -= 1;
        if (keysDown.current['d'] || keysDown.current['arrowright']) dx += 1;
        
        let moved = dx !== 0 || dy !== 0;

        if (moved) {
            let newDirection: Player['direction'] = localPlayer.direction;
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
          
            if (playerSprite.currentAnimationName !== newAnimationName) {
                if(sheet.animations[newAnimationName]) {
                    playerSprite.textures = sheet.animations[newAnimationName];
                    playerSprite.currentAnimationName = newAnimationName;
                }
            }
            updatePlayerInDb({ x: playerSprite.x, y: playerSprite.y, direction: newDirection });
        }
        
        const animationShouldPlay = moved;
        if (animationShouldPlay && !playerSprite.playing) {
            playerSprite.play();
        } else if (!animationShouldPlay && playerSprite.playing) {
            playerSprite.stop();
        }

        const playerText = playerTextRef.current[localPlayer.uid];
        if (playerText) {
          playerText.x = playerSprite.x;
          playerText.y = playerSprite.y - playerSprite.height / 2 - 10;
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

    // --- Game State Logic ---
    if (gameState !== 'playing') {
      world.visible = false;
      // Clear existing players if we go back to lobby
      Object.values(playerSpritesRef.current).forEach(s => s.destroy());
      Object.values(playerTextRef.current).forEach(t => t.destroy());
      playerSpritesRef.current = {};
      playerTextRef.current = {};
      return;
    }
    world.visible = true;
    // --- End Game State Logic ---


    const loadAssetsAndPlayers = async () => {
      const playersToRender = new Map<string, Player>();
      if (currentPlayer) {
        playersToRender.set(currentPlayer.uid, currentPlayer);
      }
      onlinePlayers.forEach(p => {
        if (currentPlayer && p.uid === currentPlayer.uid) return;
        playersToRender.set(p.uid, p)
      });
      
      const allPlayers = Array.from(playersToRender.values());
      
      const allPlayerIds = allPlayers.map(p => p.uid);
      const characterIds = new Set(allPlayers.map(p => p.characterId).filter(Boolean));

      for (const id of characterIds) {
        if (!loadedSheetsRef.current[id] && CHARACTERS_MAP[id]) {
            const character = CHARACTERS_MAP[id];
            // Use Assets.load to get the texture, then get its baseTexture for the Spritesheet
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
        if (!player.characterId) continue;
        const sheet = loadedSheetsRef.current[player.characterId];
        if (!sheet) continue;

        const isCurrentUser = currentPlayer && player.uid === currentPlayer.uid;
        const animationName = `${player.direction || 'front'}_walk`;

        if (playerSpritesRef.current[player.uid]) {
          const sprite = playerSpritesRef.current[player.uid];
          const text = playerTextRef.current[player.uid];
          
          if(sprite.textures[0].baseTexture !== sheet.baseTexture){
             world.removeChild(sprite, text);
             delete playerSpritesRef.current[player.uid];
             delete playerTextRef.current[player.uid];
          } else {
            // Always update position for all sprites, ensuring no NaN values.
            sprite.x = (typeof player.x === 'number' && !isNaN(player.x)) ? player.x : 0;
            sprite.y = (typeof player.y === 'number' && !isNaN(player.y)) ? player.y : 0;

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
          // Ensure no NaN values on creation.
          sprite.x = (typeof player.x === 'number' && !isNaN(player.x)) ? player.x : 0;
          sprite.y = (typeof player.y === 'number' && !isNaN(player.y)) ? player.y : 0;
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
    
  }, [onlinePlayers, currentPlayer, gameState]);

  return <div ref={pixiContainer} className="w-full h-full" />;
};

export default PixiCanvas;
