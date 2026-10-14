import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { renderDevelopmentBalancePanel } from '../dev/DevelopmentBalancePanel';
import {
  loadDevelopmentBalanceSettings,
  saveDevelopmentBalanceSettings,
  type DevelopmentBalanceSettings,
} from '../dev/developmentBalanceSettings';
import {
  ORB_CORE_DEFINITIONS,
  ORB_CORE_IDS,
  type OrbCoreId,
} from '../orbs/orbCoreRules';
import {
  FUSION_ORB_IDS,
  ORB_FUSION_DEFINITIONS,
} from '../orbs/orbFusionRules';
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
import { COMBAT_TRIAL } from '../run/combatTrial';
import { renderDevelopmentSandboxPanel } from '../dev/DevelopmentSandboxPanel';
import { SANDBOX_COMPLETE_EVENT, SANDBOX_SCENARIOS, defaultCombatSandboxSettings, type CombatSandboxSettings } from '../dev/combatSandbox';
import { isBasicOrbCoreId, orbDefinition } from '../orbs/orbFusionRules';

export function createCombatGame(parent: string, config?: RunConfig): Phaser.Game {
  const mount = document.getElementById(parent);
  if (!mount) throw new Error(`Missing combat mount: ${parent}`);
  const hud = document.createElement('header');
  hud.className = 'combat-hud';
  hud.setAttribute('role', 'region');
  hud.setAttribute('aria-label', '전투 상태');
  const viewport = document.createElement('div');
  viewport.className = 'combat-viewport';
  mount.replaceChildren(hud, viewport);
  const scene = new CombatScene();
  if (config) scene.setRunConfig(config);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: viewport,
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
  private workshopMediaCleanup?: () => void;
  private developmentBalance?: DevelopmentBalanceSettings;
  private developmentLoadout?: [OrbCoreId];
  private trialCore: OrbCoreId = 'explosion';
  private sandboxSettings = defaultCombatSandboxSettings();
  private legacyCampaign = developmentBuild() && new URLSearchParams(location.search).has('campaign');

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
    this.workshopMediaCleanup?.();
    this.workshopMediaCleanup = undefined;
    const options = (this.legacyCampaign ? this.progress.unlockedCores : COMBAT_TRIAL.coreTypes)
      .map((id) => `<option value="${id}">${ORB_CORE_DEFINITIONS[id].label}</option>`)
      .join('');
    this.root.innerHTML = `
      <section class="meta-screen">
        <p class="eyebrow">PROJECT RICOCHET</p>
        <h1>${this.legacyCampaign ? '출격 준비' : '리코셰 전투 시험판'}</h1>
        ${this.legacyCampaign ? `<p class="parts">부품 <strong>${this.progress.parts}</strong></p>`
          : '<p>6개 편대 · SENTINEL 격파</p><p>조준해 발사하고, 돌아오는 구슬을 가까이서 회수하세요.<br>근접 회수 뒤 첫 타격은 50% 강해집니다.</p>'}
        <div class="loadout" aria-label="시작 코어 구성">
          ${this.progress.loadout.map((_, index) => `
            <label>${this.legacyCampaign ? '시작 코어' : '시작 구슬 · 3개'}
              <select data-loadout-slot="${index}">${options}</select>
            </label>
          `).join('')}
        </div>
        <button class="primary" data-action="deploy">출격</button>
        ${developmentBuild() ? '<button data-action="sandbox">전투 테스트실</button>' : ''}
        ${this.legacyCampaign ? '<button data-action="workshop">코어 작업장</button><button data-action="development-balance">밸런스 테스트</button>' : ''}
        ${developmentBuild() ? `<button data-action="toggle-campaign">${this.legacyCampaign ? '전투 시험판으로' : '기존 3스테이지 · 개발용'}</button>` : ''}
      </section>
    `;
    this.progress.loadout.forEach((_, index) => {
      const select = this.root.querySelector<HTMLSelectElement>(`[data-loadout-slot="${index}"]`);
      if (select) select.value = this.legacyCampaign ? this.progress.loadout[0] : this.trialCore;
    });
    this.root.querySelector('[data-action="deploy"]')?.addEventListener('click', () => this.deploy());
    this.root.querySelector('[data-action="sandbox"]')?.addEventListener('click', () => this.renderSandbox());
    this.root.querySelector('[data-action="toggle-campaign"]')?.addEventListener('click', () => {
      this.legacyCampaign = !this.legacyCampaign;
      this.renderDeploy();
    });
    this.root.querySelector('[data-action="workshop"]')?.addEventListener('click', () => this.renderWorkshop());
    this.root.querySelector('[data-action="development-balance"]')
      ?.addEventListener('click', () => {
        this.developmentLoadout = this.selectedLoadout();
        this.renderDevelopmentBalance();
      });
  }

  private deploy(): void {
    const loadout = this.selectedLoadout();
    if (this.legacyCampaign) {
      this.progress = setLoadout(this.progress, loadout);
      this.store.save(this.progress);
    } else this.trialCore = loadout[0];
    const config: RunConfig = { ...createRunConfig(
      loadout,
      undefined,
      undefined,
      this.legacyCampaign ? this.progress.unlockedCores : COMBAT_TRIAL.coreTypes,
      this.legacyCampaign ? this.progress.discoveredCores : COMBAT_TRIAL.coreTypes,
      this.legacyCampaign ? this.progress.discoveredFusions : [],
    ), ...(this.legacyCampaign ? {} : { combatTrial: true as const }) };
    this.root.innerHTML = '<main id="game-root" aria-label="Project Ricochet game"></main>';
    this.game = createCombatGame('game-root', config);
    this.game.events.once(RUN_ENDED_EVENT, (result: RunResult) => this.finish(result));
    exposeDevelopmentGame(this.game);
  }

  private selectedLoadout(): [OrbCoreId] {
    const selected = this.root.querySelector<HTMLSelectElement>('[data-loadout-slot]')?.value;
    return [(selected as OrbCoreId | undefined) ?? this.trialCore];
  }

  private renderDevelopmentBalance(): void {
    if (!developmentBuild()) return;
    const settings = loadDevelopmentBalanceSettings(localStorage, Date.now() >>> 0);
    renderDevelopmentBalancePanel(this.root, settings, {
      onStart: (next) => this.deployDevelopment(next),
      onBack: () => this.renderDeploy(),
    });
  }

  private renderSandbox(): void {
    if (!developmentBuild()) return;
    this.game?.destroy(true);
    this.game = undefined;
    renderDevelopmentSandboxPanel(this.root, this.sandboxSettings,
      (settings) => this.deploySandbox(settings), () => this.renderDeploy());
  }

  private deploySandbox(settings: CombatSandboxSettings): void {
    if (!developmentBuild()) return;
    this.game?.destroy(true);
    this.sandboxSettings = { ...settings };
    const core = isBasicOrbCoreId(settings.coreType) ? settings.coreType : 'explosion';
    const config: RunConfig = {
      ...createRunConfig([core], settings.seed, undefined, ORB_CORE_IDS, ORB_CORE_IDS, FUSION_ORB_IDS),
      combatTrial: true, developmentSandbox: { ...settings },
    };
    this.root.innerHTML = '<main id="game-root" class="development-sandbox-game" aria-label="Project Ricochet test room"></main>';
    this.game = createCombatGame('game-root', config);
    this.game.events.once(RUN_ENDED_EVENT, () => this.renderSandbox());
    exposeDevelopmentGame(this.game);
    const toolbar = document.createElement('nav');
    toolbar.className = 'development-toolbar';
    toolbar.setAttribute('aria-label', '테스트실 조작');
    toolbar.innerHTML = `<p>${SANDBOX_SCENARIOS[settings.scenario]} · ${orbDefinition(settings.coreType).label} Lv.${settings.orbLevel} ×${settings.orbCount} · 시드 ${settings.seed}</p>
      <div><button data-sandbox-pause aria-pressed="false">정지</button>
      <label class="development-toggle"><input data-sandbox-invulnerable type="checkbox" ${settings.invulnerable ? 'checked' : ''}>무적</label>
      <label class="development-toggle"><input data-sandbox-hitboxes type="checkbox" ${settings.hitboxes ? 'checked' : ''}>판정 표시</label>
      <button data-sandbox-restart>같은 조건 재시작</button><button data-sandbox-edit>조건 수정</button><button data-sandbox-exit>나가기</button></div>`;
    this.root.querySelector('#game-root')!.append(toolbar);
    const pause = toolbar.querySelector<HTMLButtonElement>('[data-sandbox-pause]')!;
    let paused = false;
    pause.addEventListener('click', () => {
      const scene = this.game?.scene.getScene('combat') as CombatScene | undefined;
      if (!scene?.debugSetPaused) return;
      paused = !paused;
      scene.debugSetPaused(paused);
      pause.textContent = paused ? '계속' : '정지';
      pause.setAttribute('aria-pressed', String(paused));
    });
    for (const [selector, setting, method] of [
      ['[data-sandbox-invulnerable]', 'invulnerable', 'debugSetInvulnerable'],
      ['[data-sandbox-hitboxes]', 'hitboxes', 'debugSetHitboxes'],
    ] as const) {
      const input = toolbar.querySelector<HTMLInputElement>(selector)!;
      input.addEventListener('change', () => {
        this.sandboxSettings[setting] = input.checked;
        (this.game?.scene.getScene('combat') as CombatScene | undefined)?.[method]?.(input.checked);
      });
    }
    toolbar.querySelector('[data-sandbox-restart]')!.addEventListener('click', () => this.deploySandbox(this.sandboxSettings));
    toolbar.querySelector('[data-sandbox-edit]')!.addEventListener('click', () => this.renderSandbox());
    toolbar.querySelector('[data-sandbox-exit]')!.addEventListener('click', () => {
      this.game?.destroy(true);
      this.game = undefined;
      this.renderDeploy();
    });
    this.game.events.once(Phaser.Core.Events.READY, () => {
      this.game?.scene.getScene('combat')?.events.once(SANDBOX_COMPLETE_EVENT, () => {
        pause.textContent = '격파 완료';
        pause.disabled = true;
      });
    });
  }

  private deployDevelopment(settings: DevelopmentBalanceSettings): void {
    const loadout = this.developmentLoadout ?? [...this.progress.loadout] as [OrbCoreId];
    this.developmentBalance = { ...settings };
    this.developmentLoadout = [...loadout];
    saveDevelopmentBalanceSettings(localStorage, settings);
    const config: RunConfig = {
      ...createRunConfig(
        loadout,
        settings.seed,
        undefined,
        this.progress.unlockedCores,
        this.progress.discoveredCores,
        this.progress.discoveredFusions,
      ),
      developmentBalance: { ...settings },
    };
    this.root.innerHTML = '<main id="game-root" aria-label="Project Ricochet game"></main>';
    this.game = createCombatGame('game-root', config);
    this.game.events.once(RUN_ENDED_EVENT, (result: RunResult) => this.finishDevelopment(result));
    exposeDevelopmentGame(this.game);
  }

  private finishDevelopment(result: RunResult): void {
    this.game?.destroy(true);
    this.game = undefined;
    const seconds = Math.floor(result.durationMs / 1000);
    this.root.innerHTML = `
      <section class="meta-screen result">
        <p class="eyebrow">DEVELOPMENT ONLY</p>
        <h1>테스트 런 종료</h1>
        <dl>
          <div><dt>전투 시간</dt><dd>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</dd></div>
          <div><dt>시드</dt><dd>${this.developmentBalance?.seed ?? '-'}</dd></div>
        </dl>
        <button class="primary" data-action="restart-development">같은 설정 재시작</button>
        <button data-action="edit-development">수치 수정</button>
        <button data-action="normal-deploy">일반 출격 화면</button>
      </section>
    `;
    this.root.querySelector('[data-action="restart-development"]')?.addEventListener('click', () => {
      if (this.developmentBalance) this.deployDevelopment(this.developmentBalance);
    });
    this.root.querySelector('[data-action="edit-development"]')
      ?.addEventListener('click', () => this.renderDevelopmentBalance());
    this.root.querySelector('[data-action="normal-deploy"]')
      ?.addEventListener('click', () => this.renderDeploy());
  }

  private finish(result: RunResult): void {
    if (result.combatTrial) {
      this.game?.destroy(true);
      this.game = undefined;
      const seconds = Math.floor(result.durationMs / 1000);
      const defeatReason = {
        contact: '적과 충돌했습니다. 접근하는 적을 피하면서 회수하세요.',
        breach: '적이 방어선을 돌파했습니다. 화면 아래쪽 적부터 처리하세요.',
        bullet: '적 탄환에 격추됐습니다. 발사 예고 뒤 옆으로 이동하세요.',
        boss: '보스 공격에 격추됐습니다. 공격 예고 범위를 먼저 벗어나세요.',
      }[result.defeatCause ?? 'contact'];
      this.root.innerHTML = `
        <section class="meta-screen result">
          <p class="eyebrow">RICOCHET · COMBAT TRIAL</p>
          <h1>${result.success ? 'SENTINEL 격파' : '기체 파괴'}</h1>
          <p>전투 시간 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</p>
          <p>${result.success ? '다른 구슬로 다시 도전해 보세요.' : defeatReason}</p>
          <button class="primary" data-action="retry-trial">같은 구슬로 재도전</button>
          <button data-action="continue">구슬 바꾸기</button>
        </section>`;
      this.root.querySelector('[data-action="retry-trial"]')?.addEventListener('click', () => this.deploy());
      this.root.querySelector('[data-action="continue"]')?.addEventListener('click', () => this.renderDeploy());
      return;
    }
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
    this.workshopMediaCleanup?.();
    const price = META_TUNING.corePrices[this.progress.unlockedCores.length - 1];
    this.root.innerHTML = `
      <section class="meta-screen workshop-screen">
        <header class="workshop-header">
          <p class="eyebrow">CORE WORKSHOP</p>
          <h1>코어 작업장</h1>
          <p class="parts">부품 <strong>${this.progress.parts}</strong></p>
          ${message ? `<p role="status">${message}</p>` : ''}
          <div class="workshop-tabs" role="tablist" aria-label="작업장 목록">
            <button type="button" role="tab" id="workshop-tab-core" data-workshop-tab="core" aria-controls="workshop-panel-core" aria-selected="true" tabindex="0">기본 구슬</button>
            <button type="button" role="tab" id="workshop-tab-fusion" data-workshop-tab="fusion" aria-controls="workshop-panel-fusion" aria-selected="false" tabindex="-1">융합 기록</button>
          </div>
        </header>
        <div class="workshop-layout">
          <div class="workshop-grid" id="workshop-panel-core" role="tabpanel" aria-labelledby="workshop-tab-core" data-workshop-panel="core"></div>
          <div class="workshop-grid" id="workshop-panel-fusion" role="tabpanel" aria-labelledby="workshop-tab-fusion" data-workshop-panel="fusion" hidden></div>
          <aside class="workshop-detail" data-workshop-detail aria-live="polite">
            <p>카드를 선택하세요</p>
          </aside>
        </div>
        <button data-action="back">돌아가기</button>
        <dialog class="workshop-sheet" data-workshop-sheet aria-label="작업장 상세"></dialog>
      </section>
    `;

    const mobile = window.matchMedia('(max-width: 640px)');
    const panels = [...this.root.querySelectorAll<HTMLElement>('[data-workshop-panel]')];
    const detail = this.root.querySelector<HTMLElement>('[data-workshop-detail]')!;
    const sheet = this.root.querySelector<HTMLDialogElement>('[data-workshop-sheet]')!;
    let selectedCard: HTMLButtonElement | null = null;

    const bindPurchase = () => {
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
    };

    const renderDetail = (kind: string, id: string) => {
      let content: string;
      if (kind === 'core') {
        const coreId = id as OrbCoreId;
        const definition = ORB_CORE_DEFINITIONS[coreId];
        const discovered = this.progress.discoveredCores.includes(coreId);
        const unlocked = this.progress.unlockedCores.includes(coreId);
        content = `
          <div class="workshop-detail-content">
            <span class="workshop-orb" style="--orb-color: #${definition.color.toString(16).padStart(6, '0')}" aria-hidden="true"></span>
            <h2>${discovered ? definition.label : '???'}</h2>
            <p>${discovered ? definition.summary : `${definition.roleHint} · 미발견`}</p>
            ${discovered
              ? unlocked
                ? '<p class="workshop-state">해금됨</p>'
                : `<button type="button" class="primary" data-buy-core="${coreId}" ${price === undefined || this.progress.parts < price ? 'disabled' : ''}>${price ?? '-'} 부품으로 해금</button>`
              : '<p class="workshop-state">미발견</p>'}
          </div>
        `;
      } else {
        const fusionId = id as keyof typeof ORB_FUSION_DEFINITIONS;
        const definition = ORB_FUSION_DEFINITIONS[fusionId];
        const discovered = this.progress.discoveredFusions.includes(fusionId);
        const [first, second] = definition.materials;
        content = `
          <div class="workshop-detail-content">
            <span class="workshop-orb fusion" style="--orb-color: #${definition.color.toString(16).padStart(6, '0')}; --orb-accent: #${definition.accent.toString(16).padStart(6, '0')}" aria-hidden="true"></span>
            <h2>${discovered ? definition.label : '???'}</h2>
            <p>${ORB_CORE_DEFINITIONS[first].label} + ${ORB_CORE_DEFINITIONS[second].label}</p>
            <p>${discovered ? definition.summary : `${definition.roleHint} · 미발견`}</p>
          </div>
        `;
      }
      detail.innerHTML = content;
      sheet.innerHTML = `
        <button type="button" class="workshop-sheet-close" data-close-workshop-sheet aria-label="닫기">닫기</button>
        ${content}
      `;
      sheet.querySelector('[data-close-workshop-sheet]')
        ?.addEventListener('click', () => sheet.close());
      bindPurchase();
    };

    const renderGrid = (kind: 'core' | 'fusion') => {
      const grid = panels.find((panel) => panel.dataset.workshopPanel === kind)!;
      for (const panel of panels) {
        panel.hidden = panel !== grid;
        if (panel !== grid) panel.innerHTML = '';
      }
      this.root.querySelectorAll<HTMLButtonElement>('[data-workshop-tab]').forEach((tab) => {
        const selected = tab.dataset.workshopTab === kind;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      grid.innerHTML = kind === 'core'
        ? ORB_CORE_IDS.map((id) => {
            const definition = ORB_CORE_DEFINITIONS[id];
            const discovered = this.progress.discoveredCores.includes(id);
            const unlocked = this.progress.unlockedCores.includes(id);
            return `
              <button type="button" class="workshop-card" data-workshop-card data-workshop-kind="core" data-workshop-id="${id}">
                <span class="workshop-orb" style="--orb-color: #${definition.color.toString(16).padStart(6, '0')}" aria-hidden="true"></span>
                <strong>${discovered ? definition.label : '???'}</strong>
                <span>${discovered ? unlocked ? '해금됨' : `${price ?? '-'} 부품` : '미발견'}</span>
              </button>
            `;
          }).join('')
        : FUSION_ORB_IDS.map((id) => {
            const definition = ORB_FUSION_DEFINITIONS[id];
            const discovered = this.progress.discoveredFusions.includes(id);
            return `
              <button type="button" class="workshop-card" data-workshop-card data-workshop-kind="fusion" data-workshop-id="${id}">
                <span class="workshop-orb fusion" style="--orb-color: #${definition.color.toString(16).padStart(6, '0')}; --orb-accent: #${definition.accent.toString(16).padStart(6, '0')}" aria-hidden="true"></span>
                <strong>${discovered ? definition.label : '???'}</strong>
                <span>${discovered ? '발견됨' : '미발견'}</span>
              </button>
            `;
          }).join('');
      grid.querySelectorAll<HTMLButtonElement>('[data-workshop-card]').forEach((card) => {
        card.addEventListener('click', () => {
          selectedCard = card;
          renderDetail(card.dataset.workshopKind!, card.dataset.workshopId!);
          if (mobile.matches) sheet.showModal();
        });
      });
    };

    sheet.addEventListener('close', () => selectedCard?.focus());
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet) sheet.close();
    });
    const handleMobileChange = ({ matches }: MediaQueryListEvent) => {
      if (!matches && sheet.open) sheet.close();
    };
    mobile.addEventListener('change', handleMobileChange);
    this.workshopMediaCleanup = () => {
      mobile.removeEventListener('change', handleMobileChange);
    };
    const tabs = [...this.root.querySelectorAll<HTMLButtonElement>('[data-workshop-tab]')];
    const activateTab = (tab: HTMLButtonElement, focus = false) => {
      if (sheet.open) sheet.close();
      selectedCard = null;
      detail.innerHTML = '<p>카드를 선택하세요</p>';
      sheet.innerHTML = '';
      renderGrid(tab.dataset.workshopTab as 'core' | 'fusion');
      if (focus) tab.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        activateTab(tab);
      });
      tab.addEventListener('keydown', (event) => {
        let next: number | undefined;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        activateTab(tabs[next]!, true);
      });
    });
    renderGrid('core');
    this.root.querySelector('[data-action="back"]')
      ?.addEventListener('click', () => this.renderDeploy());
  }
}

export function exposeDevelopmentGame(game: Phaser.Game): void {
  if (!(import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV) return;
  const developmentWindow = window as typeof window & { __RICHOCHET_GAME__?: Phaser.Game };
  developmentWindow.__RICHOCHET_GAME__ = game;
}

function developmentBuild(): boolean {
  return (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV;
}
