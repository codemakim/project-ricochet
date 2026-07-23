import Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { BossRewardId, BossRewardTier } from '../progression/bossRewardRules';

const SECOND_RELIC_TUNING = GAME_TUNING.relics.secondBoss;
const REWARD_COPY: Record<BossRewardId, { label: string; effect: string }> = {
  'expanded-magazine': { label: '증설 탄창', effect: '영구 구슬 +1 · 최대 6개' },
  'recovery-capacitor': { label: '회수 축전기', effect: '근접 회수 충전 3 → 5' },
  'opening-amplifier': { label: '초동 증폭기', effect: '근접 회수 후 첫 적중 직접 피해 +1' },
  'chain-warhead': { label: '연쇄 탄두', effect: '임시 분열 구슬도 폭발 효과 상속' },
  'auxiliary-orbit': {
    label: '보조 궤도',
    effect: `영구 구슬 한도 +1 · 전체 최대 ${SECOND_RELIC_TUNING.auxiliaryOrbit.orbLimit}개`,
  },
  'recovery-salvo': {
    label: '회수 일제사',
    effect: `근접 직접 회수 재발사 시 좌우 임시 구슬 ${SECOND_RELIC_TUNING.recoverySalvo.temporaryOrbCount}개`,
  },
  'siege-resonance': {
    label: '공성 공명',
    effect: `영구 구슬 직접 적중 ${SECOND_RELIC_TUNING.siegeResonance.hitsRequired}회 후 반경 ${SECOND_RELIC_TUNING.siegeResonance.radius}px · 피해 ${SECOND_RELIC_TUNING.siegeResonance.damage} 충격파`,
  },
  'hyperpressure-core': {
    label: '초고압 탄심',
    effect: `충전 직접 피해 +${SECOND_RELIC_TUNING.hyperpressureCore.chargedDamageBonus}`,
  },
  'inertial-penetration': { label: '관성 관통', effect: '충전 구슬 직접 처치 시 반사 없이 방향·속도 유지' },
  'aftershock-explosion': {
    label: '잔향 폭발',
    effect: `${SECOND_RELIC_TUNING.aftershockExplosion.delayMs}ms 뒤 반경 ${SECOND_RELIC_TUNING.aftershockExplosion.radiusScale * 100}% · 피해 ${SECOND_RELIC_TUNING.aftershockExplosion.damageScale * 100}% 잔향 폭발`,
  },
  'chain-split': {
    label: '연쇄 분열',
    effect: `임시 구슬 첫 직접 적중 시 ±${Math.abs(SECOND_RELIC_TUNING.chainSplit.angles[0])}° 자식 구슬 ${SECOND_RELIC_TUNING.chainSplit.childCount}개`,
  },
};

const CARD_Y = [270, 400, 530] as const;
const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
] as const;

export class BossRewardOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private keyBindings: Array<{ key: Phaser.Input.Keyboard.Key; callback: () => void }> = [];
  private visible = false;
  private consumed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    tier: BossRewardTier,
    choices: readonly BossRewardId[],
    onSelect: (id: BossRewardId) => boolean,
  ): void;
  /** @deprecated Use the tiered overload. */
  show(choices: readonly BossRewardId[], onSelect: (id: BossRewardId) => boolean): void;
  show(
    tierOrChoices: BossRewardTier | readonly BossRewardId[],
    choicesOrSelect: readonly BossRewardId[] | ((id: BossRewardId) => boolean),
    maybeOnSelect?: (id: BossRewardId) => boolean,
  ): void {
    const legacy = Array.isArray(tierOrChoices);
    const tier: BossRewardTier = legacy ? 'first' : tierOrChoices as BossRewardTier;
    const choices = (legacy ? tierOrChoices : choicesOrSelect) as readonly BossRewardId[];
    const onSelect = (legacy ? choicesOrSelect : maybeOnSelect) as (id: BossRewardId) => boolean;
    this.hide();
    this.visible = true;
    this.consumed = false;

    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050d, 0.92)
        .setDepth(40)
        .setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, 132, tier === 'second' ? '상위 유물 보상' : 'BOSS REWARD', {
        color: '#ffd166',
        fontSize: '30px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
      this.scene.add.text(GAME_WIDTH / 2, 172, '유물 하나를 선택하세요', {
        color: '#f7e7b2',
        fontSize: '16px',
      }).setOrigin(0.5).setDepth(42),
    );

    choices.slice(0, 3).forEach((id, index) => {
      const select = () => this.select(id, onSelect);
      const card = this.scene.add.rectangle(GAME_WIDTH / 2, CARD_Y[index]!, 380, 104, 0x2b2340, 0.99)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', select);
      const copy = REWARD_COPY[id];
      const text = this.scene.add.text(
        GAME_WIDTH / 2,
        CARD_Y[index]!,
        `${index + 1}. ${copy.label}\n${copy.effect}`,
        {
          align: 'center',
          color: '#fff4cf',
          fontSize: '18px',
          lineSpacing: 8,
        },
      ).setOrigin(0.5).setDepth(42);
      this.objects.push(card, text);

      const key = this.scene.input.keyboard?.addKey(KEY_CODES[index]!);
      if (key) {
        key.on('down', select);
        this.keyBindings.push({ key, callback: select });
      }
    });
  }

  hide(): void {
    for (const { key, callback } of this.keyBindings) key.off('down', callback);
    for (const object of this.objects) object.destroy();
    this.keyBindings = [];
    this.objects = [];
    this.visible = false;
    this.consumed = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hide();
  }

  private select(id: BossRewardId, onSelect: (id: BossRewardId) => boolean): void {
    if (this.consumed || !this.visible) return;
    if (!onSelect(id)) return;
    this.consumed = true;
    this.hide();
  }
}
