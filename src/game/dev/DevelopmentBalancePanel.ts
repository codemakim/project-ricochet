import { GAME_TUNING } from '../config/gameTuning';
import {
  createDefaultDevelopmentBalanceSettings,
  parseDevelopmentBalanceSettings,
  type DevelopmentBalanceSettings,
} from './developmentBalanceSettings';

interface DevelopmentBalancePanelOptions {
  onStart(settings: DevelopmentBalanceSettings): void;
  onBack(): void;
}

const FIELDS = [
  ['normalEnemyHpMultiplier', '일반 적 HP', 0.1, 10, 0.1,
    `기준 기본 ${GAME_TUNING.enemies.hp.basic} / 슈터 ${GAME_TUNING.enemies.hp.shooter} / 분열 ${GAME_TUNING.enemies.hp.splitter} / 잔체 ${GAME_TUNING.enemies.hp.fragment}`],
  ['specialEnemyHpMultiplier', '특수 적 HP', 0.1, 10, 0.1,
    `기준 장갑 ${GAME_TUNING.enemies.hp.armored}`],
  ['descentSpeedMultiplier', '적 하강 속도', 0, 5, 0.1,
    `기준 ${GAME_TUNING.enemies.descentSpeed}px/s`],
  ['reinforcementIntervalMultiplier', '증원 간격', 0.1, 4, 0.1,
    `편대 ${GAME_TUNING.encounter.nextFormationRemainingRatio * 100}% 잔존 / 빈 전장 ${GAME_TUNING.encounter.emptyRespawnMs / 1000}초`],
  ['playerDamageMultiplier', '플레이어 피해', 0.1, 10, 0.1,
    '직접·범위·지속·융합·보스 피해 전체'],
  ['orbSpeedMultiplier', '구슬 속도', 0.25, 4, 0.05,
    '회수 후 발사되는 영구 구슬 전체'],
  ['startingOrbCount', '시작 구슬 수', 1, 6, 1, '선택한 시작 구슬로 1~6개'],
  ['seed', '시드', 0, 0xffff_ffff, 1, '같은 값이면 적 구성과 보상 순서 재현'],
] as const satisfies readonly [keyof DevelopmentBalanceSettings, string, number, number, number, string][];

export function renderDevelopmentBalancePanel(
  root: HTMLElement,
  settings: DevelopmentBalanceSettings,
  options: DevelopmentBalancePanelOptions,
): void {
  root.innerHTML = `
    <section class="meta-screen development-balance-screen">
      <p class="eyebrow">DEVELOPMENT ONLY</p>
      <h1>밸런스 테스트</h1>
      <p class="development-note">배율과 시작 조건을 바꿔 같은 시드로 바로 비교합니다.</p>
      <form data-development-balance-form>
        <div class="development-balance-grid">
          ${FIELDS.map(([name, label, min, max, step, hint]) => `
            <label class="development-field" for="development-${name}">
              <span>${label}</span>
              <input id="development-${name}" name="${name}" type="number"
                min="${min}" max="${max}" step="${step}" value="${settings[name]}" required>
              <small>${hint}</small>
              <small class="field-error" data-error-for="${name}" aria-live="polite"></small>
            </label>
          `).join('')}
        </div>
        <div class="development-actions">
          <button class="primary" type="submit">테스트 시작</button>
          <button type="button" data-action="restore-balance">기본값 복원</button>
          <button type="button" data-action="back">취소</button>
        </div>
      </form>
    </section>
  `;
  const form = root.querySelector<HTMLFormElement>('[data-development-balance-form]')!;
  const start = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const inputs = [...form.querySelectorAll<HTMLInputElement>('input')];
  const validate = (showErrors: boolean) => {
    for (const input of inputs) {
      const error = form.querySelector<HTMLElement>(`[data-error-for="${input.name}"]`)!;
      error.textContent = showErrors && !input.validity.valid ? input.validationMessage : '';
    }
    start.disabled = !form.checkValidity();
  };
  inputs.forEach((input) => input.addEventListener('input', () => validate(true)));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    validate(true);
    if (!form.checkValidity()) return;
    options.onStart(parseDevelopmentBalanceSettings(Object.fromEntries(
      inputs.map((input) => [input.name, Number(input.value)]),
    )));
  });
  root.querySelector('[data-action="restore-balance"]')?.addEventListener('click', () => {
    renderDevelopmentBalancePanel(root, createDefaultDevelopmentBalanceSettings(randomSeed()), options);
  });
  root.querySelector('[data-action="back"]')?.addEventListener('click', options.onBack);
  validate(false);
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
