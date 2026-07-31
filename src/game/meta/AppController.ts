import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import {
  ORB_CORE_DEFINITIONS,
  ORB_CORE_IDS,
  type OrbCoreId,
} from '../orbs/orbCoreRules';
import { createRunConfig, type RunConfig, type RunResult } from '../run/runContract';
import { CombatScene, RUN_ENDED_EVENT } from '../scenes/CombatScene';
import { MetaStore } from './MetaStore';
import {
  purchaseCore,
  setLoadout,
  settleRun,
  type MetaProgress,
  type Settlement,
} from './metaProgress';
import { META_TUNING } from './metaTuning';

export function createCombatGame(parent: string, config?: RunConfig): Phaser.Game {
  const scene = new CombatScene();
  if (config) scene.setRunConfig(config);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#050816',
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  });
}

export class AppController {
  private progress: MetaProgress;
  private game?: Phaser.Game;

  constructor(
    private readonly root: HTMLElement,
    private readonly store = new MetaStore(),
  ) {
    this.progress = store.load();
  }

  start(): void {
    this.renderDeploy();
  }

  private renderDeploy(): void {
    const options = this.progress.unlockedCores
      .map((id) => `<option value="${id}">${ORB_CORE_DEFINITIONS[id].label}</option>`)
      .join('');
    this.root.innerHTML = `
      <section class="meta-screen">
        <p class="eyebrow">PROJECT RICOCHET</p>
        <h1>출격 준비</h1>
        <p class="parts">부품 <strong>${this.progress.parts}</strong></p>
        <div class="loadout" aria-label="시작 코어 구성">
          ${this.progress.loadout.map((_, index) => `
            <label>시작 코어
              <select data-loadout-slot="${index}">${options}</select>
            </label>
          `).join('')}
        </div>
        <button class="primary" data-action="deploy">출격</button>
        <button data-action="workshop">코어 작업장</button>
      </section>
    `;
    this.progress.loadout.forEach((core, index) => {
      const select = this.root.querySelector<HTMLSelectElement>(`[data-loadout-slot="${index}"]`);
      if (select) select.value = core;
    });
    this.root.querySelector('[data-action="deploy"]')?.addEventListener('click', () => this.deploy());
    this.root.querySelector('[data-action="workshop"]')?.addEventListener('click', () => this.renderWorkshop());
  }

  private deploy(): void {
    const loadout = [...this.root.querySelectorAll<HTMLSelectElement>('[data-loadout-slot]')]
      .map(({ value }) => value as OrbCoreId);
    this.progress = setLoadout(this.progress, loadout);
    this.store.save(this.progress);
    const config = createRunConfig(
      this.progress.loadout,
      undefined,
      undefined,
      this.progress.unlockedCores,
    );
    this.root.innerHTML = '<main id="game-root" aria-label="Project Ricochet game"></main>';
    this.game = createCombatGame('game-root', config);
    this.game.events.once(RUN_ENDED_EVENT, (result: RunResult) => this.finish(result));
    exposeDevelopmentGame(this.game);
  }

  private finish(result: RunResult): void {
    const settlement = settleRun(this.progress, result);
    this.progress = settlement.progress;
    this.store.save(this.progress);
    this.game?.destroy(true);
    this.game = undefined;
    this.renderResult(result, settlement);
  }

  private renderResult(result: RunResult, settlement: Settlement): void {
    const seconds = Math.floor(result.durationMs / 1000);
    this.root.innerHTML = `
      <section class="meta-screen result">
        <p class="eyebrow">${result.success ? 'MISSION COMPLETE' : 'SYSTEM DOWN'}</p>
        <h1>${result.success ? '전장 돌파' : '런 종료'}</h1>
        <dl>
          <div><dt>전투 시간</dt><dd>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</dd></div>
          <div><dt>격파 보스</dt><dd>${result.defeatedBossIds.length}</dd></div>
          <div><dt>획득 부품</dt><dd>+${settlement.earned}</dd></div>
          <div><dt>보유 부품</dt><dd>${settlement.progress.parts}</dd></div>
        </dl>
        <button class="primary" data-action="continue">계속</button>
      </section>
    `;
    this.root.querySelector('[data-action="continue"]')
      ?.addEventListener('click', () => this.renderDeploy());
  }

  private renderWorkshop(message = ''): void {
    const price = META_TUNING.corePrices[this.progress.unlockedCores.length - 1];
    this.root.innerHTML = `
      <section class="meta-screen">
        <p class="eyebrow">CORE WORKSHOP</p>
        <h1>코어 작업장</h1>
        <p class="parts">부품 <strong>${this.progress.parts}</strong></p>
        ${message ? `<p role="status">${message}</p>` : ''}
        <div class="core-list">
          ${ORB_CORE_IDS.map((id) => {
            const unlocked = this.progress.unlockedCores.includes(id);
            return `
              <article>
                <strong>${ORB_CORE_DEFINITIONS[id].label}</strong>
                ${unlocked
                  ? '<span>해금됨</span>'
                  : `<button data-buy-core="${id}" ${price === undefined || this.progress.parts < price ? 'disabled' : ''}>${price ?? '-'} 부품</button>`}
              </article>
            `;
          }).join('')}
        </div>
        <button data-action="back">돌아가기</button>
      </section>
    `;
    this.root.querySelectorAll<HTMLButtonElement>('[data-buy-core]').forEach((button) => {
      button.addEventListener('click', () => {
        try {
          this.progress = purchaseCore(this.progress, button.dataset.buyCore as OrbCoreId);
          this.store.save(this.progress);
          this.renderWorkshop('코어 해금 완료');
        } catch (error) {
          this.renderWorkshop(error instanceof Error ? error.message : '구매 실패');
        }
      });
    });
    this.root.querySelector('[data-action="back"]')
      ?.addEventListener('click', () => this.renderDeploy());
  }
}

export function exposeDevelopmentGame(game: Phaser.Game): void {
  if (!(import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) return;
  const developmentWindow = window as typeof window & { __RICHOCHET_GAME__?: Phaser.Game };
  developmentWindow.__RICHOCHET_GAME__ = game;
}
