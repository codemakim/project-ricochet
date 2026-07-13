import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { CombatScene } from './game/scenes/CombatScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050816',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [CombatScene],
});

if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) {
  const developmentWindow = window as typeof window & { __RICHOCHET_GAME__?: Phaser.Game };
  developmentWindow.__RICHOCHET_GAME__ = game;
}
