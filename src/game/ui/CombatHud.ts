import { progressionHudState } from './progressionHud';

/** DOM-only status rail: never occupies world coordinates or captures aiming input. */
export class CombatHud {
  private readonly health: HTMLElement;
  private readonly healthBar: HTMLProgressElement;
  private readonly progression: HTMLElement;
  private readonly xpBar: HTMLProgressElement;
  private readonly boss: HTMLElement;
  private readonly bossLabel: HTMLElement;
  private readonly bossBar: HTMLProgressElement;
  private readonly bossState: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly trialStatus: HTMLElement;
  private readonly controls = window.matchMedia('(pointer: coarse)').matches
    ? '왼손 이동 · 오른손 조준 / 자동 발사'
    : 'WASD 이동 · 마우스 조준 / 자동 발사';

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="combat-status-row">
        <div class="combat-health"><span data-health></span><progress data-health-bar aria-label="체력" max="1"></progress></div>
        <div class="combat-progression"><span data-progression></span><progress data-xp-bar aria-label="경험치" max="1"></progress></div>
      </div>
      <div class="combat-boss" hidden><span data-boss-label></span><progress data-boss-bar aria-label="보스 체력" max="1"></progress><span data-boss-state role="status"></span></div>
      <p class="combat-notice" role="status"></p>
      <p class="combat-trial-status" hidden></p>
    `;
    this.health = root.querySelector('[data-health]')!;
    this.healthBar = root.querySelector('[data-health-bar]')!;
    this.progression = root.querySelector('[data-progression]')!;
    this.xpBar = root.querySelector('[data-xp-bar]')!;
    this.boss = root.querySelector('.combat-boss')!;
    this.bossLabel = root.querySelector('[data-boss-label]')!;
    this.bossBar = root.querySelector('[data-boss-bar]')!;
    this.bossState = root.querySelector('[data-boss-state]')!;
    this.notice = root.querySelector('.combat-notice')!;
    this.trialStatus = root.querySelector('.combat-trial-status')!;
    this.setWarning(false);
  }

  setHealth(current: number, maximum: number): void {
    this.health.textContent = `HP ${current}/${maximum}`;
    this.healthBar.value = maximum > 0 ? current / maximum : 0;
    this.root.dataset.danger = String(this.healthBar.value <= 0.3);
  }

  setTrialStatus(wave: number, total: number, orbs: number, elapsedMs: number, recovered: boolean): void {
    this.trialStatus.hidden = false;
    const seconds = Math.floor(elapsedMs / 1000);
    const text = recovered ? '근접 회수 · 다음 첫 타격 +50%'
      : `편대 ${wave}/${total} · 구슬 ${orbs} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · 원 안에서 회수`;
    if (this.trialStatus.textContent !== text) this.trialStatus.textContent = text;
    this.trialStatus.dataset.recovered = String(recovered);
  }

  setProgression(level: number, xp: number, xpRequired: number | null): void {
    const hud = progressionHudState(level, xp, xpRequired);
    this.progression.textContent = hud.label;
    this.xpBar.value = hud.fillRatio;
  }

  setBoss(label: string, ratio = 0, status = ''): void {
    this.boss.hidden = !label;
    this.notice.hidden = Boolean(label);
    if (this.bossLabel.textContent !== label) this.bossLabel.textContent = label;
    if (this.bossBar.value !== ratio) this.bossBar.value = ratio;
    if (this.bossState.textContent !== status) this.bossState.textContent = status;
    this.boss.dataset.exposed = String(status.includes('코어 노출'));
    this.boss.dataset.defeated = String(status === '격파 완료');
  }

  setWarning(visible: boolean, boss = '', progress = 0): void {
    const text = visible ? `⚠ ${boss} 보스 접근 · 전투 준비` : this.controls;
    if (this.notice.textContent !== text) this.notice.textContent = text;
    this.notice.dataset.warning = String(visible);
    this.notice.style.setProperty('--warning-progress', `${Math.max(0, Math.min(1, progress)) * 100}%`);
  }

  hit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.root.getAnimations().forEach((animation) => animation.cancel());
    this.root.animate([
      { boxShadow: 'inset 0 0 0 2px #ff6d7a', backgroundColor: '#482036' },
      { boxShadow: 'inset 0 0 0 0 transparent', backgroundColor: '#091525' },
    ], { duration: 280 });
  }

  destroy(): void {
    this.root.getAnimations().forEach((animation) => animation.cancel());
    this.root.replaceChildren();
  }
}
