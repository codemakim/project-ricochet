import type { BossKind } from '../config/gameTuning';
import type { Vector } from '../math/vector';

export type BossTargetId = string;

export interface BossDirectHitEvent {
  bossKind: BossKind;
  targetId: BossTargetId;
  source: 'permanent' | 'temporary';
  sourceOrbId: number;
  position: Vector;
  charged: boolean;
  direction: Vector;
}

export interface BossProjectileSnapshot {
  kind: string;
  position: Vector;
  velocity: Vector;
}

export interface BossEncounterSnapshot {
  kind: BossKind;
  active: boolean;
  phase: string | null;
  position: Vector | null;
  parts: Record<string, number> | null;
  bullets: number;
  warnings: number;
  warningKinds?: string[];
  projectiles: BossProjectileSnapshot[];
}

export interface BossEncounter {
  update(): void;
  getSnapshot(): BossEncounterSnapshot;
  getBulletCount(): number;
  applyAreaDamage(
    center: Vector,
    radius: number,
    damage: number,
    excludedTargetId?: BossTargetId,
  ): BossTargetId[];
  applyDirectDamage(targetId: BossTargetId, damage: number): boolean;
  clearHostileActions(): void;
  destroy(): void;
}
