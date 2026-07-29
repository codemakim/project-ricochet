import './styles.css';
import {
  AppController,
  createCombatGame,
  exposeDevelopmentGame,
} from './game/meta/AppController';

const root = document.querySelector<HTMLElement>('#app-root');
if (!root) throw new Error('#app-root is required');
if (new URLSearchParams(location.search).get('combat') === '1') {
  root.innerHTML = '<main id="game-root" aria-label="Project Ricochet game"></main>';
  exposeDevelopmentGame(createCombatGame('game-root'));
} else {
  new AppController(root).start();
}
