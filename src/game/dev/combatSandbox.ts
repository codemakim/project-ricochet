import { GAME_TUNING } from '../config/gameTuning';
import { createAuthoredFormation } from '../encounters/formationRules';
import { ENEMY_CATALOG } from '../encounters/stageDefinitions';
import type { EnemySpec } from '../enemies/enemyRules';
import { ORB_CORE_IDS } from '../orbs/orbCoreRules';
import { FUSION_ORB_IDS, orbMaximumLevel, type OrbTypeId } from '../orbs/orbFusionRules';
import { COMBAT_TRIAL, TRIAL_FORMATIONS, TRIAL_STAGE } from '../run/combatTrial';

export const SANDBOX_SCENARIOS = { single: '적 1체', dense: '밀집 편대', sentinel: 'SENTINEL' } as const;
export const SANDBOX_ENEMIES = { basic: '기본 적', armored: '장갑 적', shooter: '사수', splitter: '분열 적' } as const;
export const SANDBOX_COMPLETE_EVENT = 'ricochet:sandbox-complete';

export interface CombatSandboxSettings {
  scenario: keyof typeof SANDBOX_SCENARIOS;
  enemyKind: keyof typeof SANDBOX_ENEMIES;
  coreType: OrbTypeId;
  orbCount: number;
  orbLevel: number;
  hpMultiplier: number;
  seed: number;
  invulnerable: boolean;
  hitboxes: boolean;
}

export function defaultCombatSandboxSettings(): CombatSandboxSettings {
  return {
    scenario: 'single', enemyKind: 'basic', coreType: 'explosion',
    orbCount: COMBAT_TRIAL.startingOrbCount, orbLevel: 1, hpMultiplier: 1,
    seed: 42, invulnerable: true, hitboxes: false,
  };
}

export function parseCombatSandboxSettings(value: unknown): CombatSandboxSettings {
  if (!value || typeof value !== 'object') throw new RangeError('sandbox settings must be an object');
  const data = value as Record<string, unknown>;
  if (typeof data.scenario !== 'string' || !Object.hasOwn(SANDBOX_SCENARIOS, data.scenario)) throw new RangeError('unknown sandbox scenario');
  if (typeof data.enemyKind !== 'string' || !Object.hasOwn(SANDBOX_ENEMIES, data.enemyKind)) throw new RangeError('unknown sandbox enemy');
  if (![...ORB_CORE_IDS, ...FUSION_ORB_IDS].includes(data.coreType as OrbTypeId)) {
    throw new RangeError('unknown sandbox core');
  }
  const coreType = data.coreType as OrbTypeId;
  for (const [key, min, max, integer] of [
    ['orbCount', 1, COMBAT_TRIAL.maximumOrbs, true],
    ['orbLevel', 1, orbMaximumLevel(coreType), true],
    ['hpMultiplier', 0.1, 100, false],
    ['seed', 0, 0xffff_ffff, true],
  ] as const) {
    const current = data[key];
    if (typeof current !== 'number' || !Number.isFinite(current) || current < min || current > max
      || (integer && !Number.isInteger(current))) throw new RangeError(`invalid sandbox ${key}`);
  }
  if (typeof data.invulnerable !== 'boolean' || typeof data.hitboxes !== 'boolean') {
    throw new RangeError('sandbox switches must be boolean');
  }
  return {
    scenario: data.scenario as CombatSandboxSettings['scenario'],
    enemyKind: data.enemyKind as CombatSandboxSettings['enemyKind'], coreType,
    orbCount: data.orbCount as number, orbLevel: data.orbLevel as number,
    hpMultiplier: data.hpMultiplier as number, seed: data.seed as number,
    invulnerable: data.invulnerable, hitboxes: data.hitboxes,
  };
}

export function sandboxEnemies(settings: CombatSandboxSettings): EnemySpec[] {
  if (settings.scenario === 'sentinel') return [];
  if (settings.scenario === 'dense') {
    const formation = TRIAL_FORMATIONS[4]!;
    return createAuthoredFormation(TRIAL_STAGE, TRIAL_STAGE.paragraphs[4]!, formation.id, TRIAL_FORMATIONS)
      .enemies.map((enemy) => ({
        ...enemy, y: enemy.y + formation.rows * GAME_TUNING.encounter.grid.cellHeight + 150,
        hp: enemy.hp * settings.hpMultiplier, speed: 0,
      }));
  }
  const { width, height } = ENEMY_CATALOG.find(({ kind }) => kind === settings.enemyKind)!;
  const elite = width * height >= 4;
  return [{
    kind: settings.enemyKind, formationId: 'sandbox-single',
    x: GAME_TUNING.world.width / 2, y: 220, column: 2, row: 0, width, height, speed: 0,
    hp: GAME_TUNING.enemies.hp[settings.enemyKind] * settings.hpMultiplier
      * (elite ? TRIAL_STAGE.powerBand.eliteHpMultiplier : TRIAL_STAGE.powerBand.normalHpMultiplier),
  }];
}
