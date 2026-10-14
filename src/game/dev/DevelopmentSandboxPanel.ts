import { ORB_CORE_IDS } from '../orbs/orbCoreRules';
import { COMBAT_TRIAL } from '../run/combatTrial';
import { FUSION_ORB_IDS, orbDefinition, orbMaximumLevel, type OrbTypeId } from '../orbs/orbFusionRules';
import {
  SANDBOX_ENEMIES, SANDBOX_SCENARIOS, parseCombatSandboxSettings,
  type CombatSandboxSettings,
} from './combatSandbox';

export function renderDevelopmentSandboxPanel(
  root: HTMLElement,
  settings: CombatSandboxSettings,
  onStart: (settings: CombatSandboxSettings) => void,
  onBack: () => void,
): void {
  root.innerHTML = `<section class="meta-screen development-balance-screen">
    <p class="eyebrow">DEVELOPMENT ONLY</p><h1>전투 테스트실</h1>
    <p class="development-note">시험판 규칙으로 선택한 상황만 실행합니다. 자동 증원·성장 선택 없이 비교하며 저장·해금에 영향이 없습니다.</p>
    <form data-sandbox-form>
      <div class="development-balance-grid">
        <label class="development-field">상황<select name="scenario">${Object.entries(SANDBOX_SCENARIOS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
        <label class="development-field">단일 적 종류<select name="enemyKind">${Object.entries(SANDBOX_ENEMIES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
        <label class="development-field">구슬 종류<select name="coreType">${[...ORB_CORE_IDS, ...FUSION_ORB_IDS].map((id) => `<option value="${id}">${orbDefinition(id).label}</option>`).join('')}</select></label>
        <label class="development-field">구슬 개수<input name="orbCount" type="number" min="1" max="${COMBAT_TRIAL.maximumOrbs}" step="1" required></label>
        <label class="development-field">구슬 레벨<input name="orbLevel" type="number" min="1" step="1" required></label>
        <label class="development-field">적·보스 HP 배율<input name="hpMultiplier" type="number" min="0.1" max="100" step="0.1" required></label>
        <label class="development-field">시드<input name="seed" type="number" min="0" max="4294967295" step="1" required></label>
        <div class="development-field">
          <label class="development-toggle"><input name="invulnerable" type="checkbox">무적</label>
          <label class="development-toggle"><input name="hitboxes" type="checkbox">판정 표시</label>
        </div>
      </div>
      <p class="field-error" data-sandbox-error role="status"></p>
      <div class="development-actions"><button class="primary" type="submit">테스트 시작</button><button type="button" data-sandbox-back>취소</button></div>
    </form></section>`;
  const form = root.querySelector<HTMLFormElement>('[data-sandbox-form]')!;
  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = String(value);
  }
  const core = form.elements.namedItem('coreType') as HTMLSelectElement;
  const level = form.elements.namedItem('orbLevel') as HTMLInputElement;
  const enemy = form.elements.namedItem('enemyKind') as HTMLSelectElement;
  const scenario = form.elements.namedItem('scenario') as HTMLSelectElement;
  const start = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const validate = () => {
    level.max = String(orbMaximumLevel(core.value as OrbTypeId));
    enemy.disabled = scenario.value !== 'single';
    start.disabled = !form.checkValidity();
  };
  core.addEventListener('change', () => {
    level.value = String(Math.min(Number(level.value), orbMaximumLevel(core.value as OrbTypeId)));
    validate();
  });
  form.addEventListener('input', validate);
  form.addEventListener('change', validate);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const values: Record<string, unknown> = {};
      for (const field of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')) {
        values[field.name] = field instanceof HTMLInputElement
          ? field.type === 'checkbox' ? field.checked : Number(field.value)
          : field.value;
      }
      onStart(parseCombatSandboxSettings(values));
    } catch (error) {
      form.querySelector('[data-sandbox-error]')!.textContent = (error as Error).message;
    }
  });
  root.querySelector('[data-sandbox-back]')!.addEventListener('click', onBack);
  validate();
}
