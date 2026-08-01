import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { OrbSnapshot } from '../orbs/OrbManager';
import { ORB_CORE_DEFINITIONS } from '../orbs/orbCoreRules';
import {
  ORB_FUSION_DEFINITIONS,
  orbDefinition,
} from '../orbs/orbFusionRules';
import { BuildState } from '../progression/BuildState';
import { ABILITY_DEFINITIONS, type AbilityId } from '../progression/progressionRules';
import type { RunRewardChoice } from '../progression/runRewardRules';
import { formatDisplayNumber } from './displayNumber';

const CARD_Y = [210, 310, 410] as const;
const DETAIL_Y = 545;
const CONFIRM_Y = 625;
const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
] as const;

export class LevelUpOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private detailObjects: Phaser.GameObjects.GameObject[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private keyBindings: Array<{ key: Phaser.Input.Keyboard.Key; callback: () => void }> = [];
  private selected?: RunRewardChoice;
  private onSelect?: (choice: RunRewardChoice) => void;
  private visible = false;
  private consumed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    choices: readonly RunRewardChoice[],
    build: BuildState,
    orbs: readonly OrbSnapshot[],
    onSelect: (choice: RunRewardChoice) => void,
  ): void {
    this.hide();
    this.visible = true;
    this.consumed = false;
    this.onSelect = onSelect;

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

    choices.slice(0, 3).forEach((choice, index) => {
      const card = this.scene.add.rectangle(GAME_WIDTH / 2, CARD_Y[index]!, 360, 76, 0x10213d, 0.98)
        .setDepth(31)
        .setInteractive({ useHandCursor: true });
      const focus = () => this.focus(choice, card, build, orbs);
      card.on('pointerup', focus);
      this.cards.push(card);
      const label = `${index + 1}. ${this.cardLabel(choice, build)}`;
      const text = this.scene.add.text(GAME_WIDTH / 2, CARD_Y[index]!, label, {
        align: 'center',
        color: '#dff7ff',
        fontSize: '18px',
        lineSpacing: 8,
      }).setOrigin(0.5).setDepth(32);
      this.objects.push(card, text);

      const key = this.scene.input.keyboard?.addKey(KEY_CODES[index]!);
      if (key) {
        key.on('down', focus);
        this.keyBindings.push({ key, callback: focus });
      }
    });

    const enter = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    if (enter) {
      const confirm = () => this.confirm();
      enter.on('down', confirm);
      this.keyBindings.push({ key: enter, callback: confirm });
    }
  }

  hide(): void {
    for (const { key, callback } of this.keyBindings) key.off('down', callback);
    for (const object of this.objects) object.destroy();
    for (const object of this.detailObjects) object.destroy();
    this.keyBindings = [];
    this.objects = [];
    this.detailObjects = [];
    this.cards = [];
    this.selected = undefined;
    this.onSelect = undefined;
    this.visible = false;
    this.consumed = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hide();
  }

  private focus(
    choice: RunRewardChoice,
    card: Phaser.GameObjects.Rectangle,
    build: BuildState,
    orbs: readonly OrbSnapshot[],
  ): void {
    if (this.consumed || !this.visible) return;
    this.selected = choice;
    for (const candidate of this.cards) candidate.setFillStyle(0x10213d, 0.98);
    card.setFillStyle(0x1d6e88, 0.98);
    for (const object of this.detailObjects) object.destroy();
    this.detailObjects = [
      this.scene.add.rectangle(GAME_WIDTH / 2, DETAIL_Y, 380, 112, 0x09182c, 0.98)
        .setDepth(31),
      this.scene.add.text(GAME_WIDTH / 2, DETAIL_Y, this.choiceDetail(choice, build, orbs), {
        align: 'center',
        color: '#dff7ff',
        fontSize: '17px',
        wordWrap: { width: 340 },
      }).setOrigin(0.5).setDepth(32),
      this.scene.add.rectangle(GAME_WIDTH / 2, CONFIRM_Y, 180, 52, 0x1d6e88, 0.98)
        .setDepth(31)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.confirm()),
      this.scene.add.text(GAME_WIDTH / 2, CONFIRM_Y, '획득', {
        color: '#ffffff',
        fontSize: '20px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(32),
    ];
  }

  private confirm(): void {
    if (this.consumed || !this.visible || !this.selected || !this.onSelect) return;
    this.consumed = true;
    this.onSelect({ ...this.selected });
  }

  private cardLabel(choice: RunRewardChoice, build: BuildState): string {
    if (choice.kind === 'ability') {
      const rank = build.rank(choice.id);
      return `${ABILITY_DEFINITIONS[choice.id].label}  ${rank} → ${rank + 1}`;
    }
    if (choice.kind === 'orb-fusion') {
      return `${ORB_FUSION_DEFINITIONS[choice.fusionType].label} 융합`;
    }
    const label = orbDefinition(choice.coreType).label;
    return choice.kind === 'orb-add' ? `${label} Lv1` : `${label} 강화`;
  }

  private choiceDetail(
    choice: RunRewardChoice,
    build: BuildState,
    orbs: readonly OrbSnapshot[],
  ): string {
    if (choice.kind === 'ability') return this.nextEffect(choice.id, build);
    if (choice.kind === 'orb-fusion') {
      const definition = ORB_FUSION_DEFINITIONS[choice.fusionType];
      const [first, second] = definition.materials;
      return `${ORB_CORE_DEFINITIONS[first].label} + ${ORB_CORE_DEFINITIONS[second].label} · ${definition.summary}`;
    }
    const definition = orbDefinition(choice.coreType);
    if (choice.kind === 'orb-add') return definition.summary;
    const levels = orbs
      .filter(({ coreType, level }) => (
        coreType === choice.coreType && level < definition.maximumLevel
      ))
      .map(({ level }) => level);
    const nextLevel = levels.length > 0 ? Math.min(...levels) + 1 : 2;
    return `${definition.levelEffects[nextLevel - 1]} · 강화할 구슬 선택`;
  }

  private nextEffect(id: AbilityId, build: BuildState): string {
    const next = new BuildState(build.getRanks());
    next.upgrade(id);
    switch (id) {
      case 'firepower':
        return `직접 피해 ${next.rank(id) * 12}% 증가`;
      case 'kinetic':
        return `구슬 속도 ${next.rank(id) * 7}% 증가`;
      case 'explosion':
        return '직격 시 20% 확률로 충격 폭발';
      case 'split':
        return `직격 시 25% 확률로 임시 구슬 ${next.split()!.count}개 생성`;
      case 'core-expansion':
        return `구슬 크기 ${next.rank(id) * 8}% 증가`;
      case 'recovery-field':
        return '근접 회수 범위 증가';
      case 'mobility-motor':
        return `이동 속도 ${next.rank(id) * 8}% 증가`;
      case 'armor-reinforcement':
        return `최대 체력 ${next.maximumHealth()} · 즉시 1 회복`;
      case 'near-amplification':
        return `가까운 적 직접 피해 ${next.rank(id) * 15}% 증가`;
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
        return '첫 직격 후 잠시 회수 범위 증가';
      case 'high-speed-impact':
        return `고속 직격 ${next.highSpeedImpact()!.hitsRequired}회마다 충격파`;
      case 'horizontal-cutter':
        return '직격 시 15% 확률로 수평 레이저';
      case 'vertical-cutter':
        return '직격 시 15% 확률로 수직 레이저';
      case 'destruction-reaction':
        return '직접 처치 시 25% 확률로 폭발';
      case 'micro-missile':
        return `직격 ${next.microMissile()!.hitsRequired}회마다 유도탄 발사`;
      case 'recovery-shockwave':
        return `근접 회수 ${next.recoveryShockwave()!.recoveriesRequired}회마다 충격파`;
      case 'proc-optimization':
        return `확률형 기본 발동률 +${next.rank(id) * 4}%p`;
      case 'effect-output':
        return `보조 효과 피해 +${next.rank(id) * 15}%`;
      case 'area-expansion':
        return `원형 효과 반경 +${next.rank(id) * 10}%`;
      case 'duration-module':
        return `가스·시간제 효과 지속 +${next.rank(id) * 15}%`;
      case 'focusing-lens':
        return `레이저 두께 ${next.rank(id) * 20}% 증가`;
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
