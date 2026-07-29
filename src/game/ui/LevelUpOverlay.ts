import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { BuildState } from '../progression/BuildState';
import { ABILITY_DEFINITIONS, type AbilityId } from '../progression/progressionRules';
import { formatDisplayNumber } from './displayNumber';

const CARD_Y = [270, 400, 530] as const;
const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
] as const;

export class LevelUpOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private keyBindings: Array<{ key: Phaser.Input.Keyboard.Key; callback: () => void }> = [];
  private visible = false;
  private consumed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    choices: readonly AbilityId[],
    build: BuildState,
    onSelect: (id: AbilityId) => void,
  ): void {
    this.hide();
    this.visible = true;
    this.consumed = false;

    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050d, 0.88)
        .setDepth(30)
        .setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, 154, 'LEVEL UP', {
        color: '#65f6ff',
        fontSize: '30px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(32),
    );

    choices.slice(0, 3).forEach((id, index) => {
      const select = () => this.select(id, onSelect);
      const card = this.scene.add.rectangle(GAME_WIDTH / 2, CARD_Y[index]!, 360, 104, 0x10213d, 0.98)
        .setDepth(31)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', select);
      const rank = build.rank(id);
      const label = `${index + 1}. ${ABILITY_DEFINITIONS[id].label}  ${rank} → ${rank + 1}\n${this.nextEffect(id, build)}`;
      const text = this.scene.add.text(GAME_WIDTH / 2, CARD_Y[index]!, label, {
        align: 'center',
        color: '#dff7ff',
        fontSize: '18px',
        lineSpacing: 8,
      }).setOrigin(0.5).setDepth(32);
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

  private select(id: AbilityId, onSelect: (id: AbilityId) => void): void {
    if (this.consumed || !this.visible) return;
    this.consumed = true;
    onSelect(id);
  }

  private nextEffect(id: AbilityId, build: BuildState): string {
    const next = new BuildState(build.getRanks());
    next.upgrade(id);
    switch (id) {
      case 'firepower':
        return `직접 피해 +${formatDisplayNumber(next.directDamageBonus())}`;
      case 'kinetic':
        return `충전 속도 ${formatDisplayNumber(next.chargedSpeed(), 0)}px/s`;
      case 'explosion': {
        const effect = next.explosion()!;
        return `발동 ${formatDisplayNumber(effect.chance * 100)}% · 반경 ${formatDisplayNumber(effect.radius)}px · 피해 ${formatDisplayNumber(effect.damage)}`;
      }
      case 'split': {
        const effect = next.split()!;
        return `발동 ${formatDisplayNumber(effect.chance * 100)}% · 임시 구슬 ${effect.count}개`;
      }
      case 'additional-core':
        return `영구 구슬 상한 ${next.orbLimit(3)}개`;
      case 'core-expansion':
        return `구슬 반경 ${formatDisplayNumber(next.orbRadius())}px`;
      case 'recovery-field':
        return `근접 회수 반경 ${formatDisplayNumber(next.recoveryRadius())}px`;
      case 'mobility-motor':
        return `이동 속도 ${formatDisplayNumber(next.playerSpeed(), 0)}px/s`;
      case 'armor-reinforcement':
        return `최대 체력 ${next.maximumHealth()} · 즉시 1 회복`;
      case 'near-amplification':
        return `150px 이내 직접 피해 +${next.rank(id) * 15}%`;
      case 'precision-hit':
        return `첫 벽 충돌 전 직접 피해 +${next.rank(id) * 20}%`;
      case 'kinetic-conversion':
        return `기준 속도 초과 10%당 직접 피해 +${next.rank(id) * 6}% · 최대 +36%`;
      case 'wall-acceleration':
        return `벽 충돌 중첩당 속도 +${next.rank(id) * 4}% · 최대 5중첩`;
      case 'reload-overcharge':
        return `근접 회수 첫타 피해 +${next.rank(id) * 20}%`;
      case 'consecutive-impact':
        return `연속 직격 최대 ${next.rank(id)}중첩 · 중첩당 +10%`;
      case 'kill-overclock':
        return `직접 처치 후 피해·속도 +${next.rank(id) * 8}%`;
      case 'collision-acceleration':
        return `직격 후 속도 +${next.rank(id) * 8}%`;
      case 'tracking-magnet':
        return `첫 직격 후 흡수 반경 +${next.trackingRadiusBonus(true)}px`;
      case 'high-speed-impact': {
        const effect = next.highSpeedImpact()!;
        return `고속 ${effect.hitsRequired}타 · 반경 ${formatDisplayNumber(effect.radius)}px · 피해 ${formatDisplayNumber(effect.damage)}`;
      }
      case 'horizontal-cutter':
      case 'vertical-cutter': {
        const effect = id === 'horizontal-cutter'
          ? next.horizontalCutter()!
          : next.verticalCutter()!;
        return `발동 ${formatDisplayNumber(effect.chance * 100)}% · 두께 ${formatDisplayNumber(effect.thickness)}px · 피해 ${formatDisplayNumber(effect.damage)}`;
      }
      case 'destruction-reaction': {
        const effect = next.destructionReaction()!;
        return `처치 발동 ${formatDisplayNumber(effect.chance * 100)}% · 반경 ${formatDisplayNumber(effect.radius)}px`;
      }
      case 'micro-missile':
        return `직격 ${next.microMissile()!.hitsRequired}회마다 피해 ${formatDisplayNumber(next.microMissile()!.damage)}`;
      case 'recovery-shockwave': {
        const effect = next.recoveryShockwave()!;
        return `근접 회수 ${effect.recoveriesRequired}회 · 반경 ${formatDisplayNumber(effect.radius)}px · 피해 ${formatDisplayNumber(effect.damage)}`;
      }
      case 'proc-optimization':
        return `확률형 기본 발동률 +${next.rank(id) * 4}%p`;
      case 'effect-output':
        return `보조 효과 피해 +${next.rank(id) * 15}%`;
      case 'area-expansion':
        return `원형 효과 반경 +${next.rank(id) * 10}%`;
      case 'duration-module':
        return `가스·시간제 효과 지속 +${next.rank(id) * 15}%`;
      case 'focusing-lens':
        return `레이저 두께 +${next.rank(id) * 20}%`;
      case 'fragment-expansion':
        return `분열 임시 구슬 +${next.rank(id)}개`;
      case 'fragment-output':
        return `임시 구슬 피해 +${next.rank(id) * 15}%`;
      case 'fragment-stabilization':
        return `임시 구슬 수명 +${formatDisplayNumber(next.rank(id) * 0.35)}초`;
      case 'conduction-expansion':
        return `전도 추가 대상 +${next.rank(id)}개`;
      default:
        return '';
    }
  }

}
