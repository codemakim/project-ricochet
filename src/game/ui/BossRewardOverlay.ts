import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import {
  type BossRewardChoice,
  type BossRewardId,
} from '../progression/bossRewardRules';
import { ABILITY_DEFINITIONS } from '../progression/progressionRules';

const REWARD_COPY: Record<
  Extract<BossRewardChoice, { kind: 'relic' }>['id'],
  { label: string; effect: string }
> = {
  'auxiliary-link': { label: '보조체 연결', effect: '임시 구슬이 낮은 확률로 발동 효과 사용' },
  'cross-cut': { label: '교차 절단', effect: '절단선 발동 시 반대 방향 절단선 추가' },
  'gas-ignition': { label: '가스 점화', effect: '폭발이 부식 가스의 남은 피해를 즉시 점화' },
  'recursive-split': { label: '재귀 분열', effect: '임시 구슬이 한 번 추가 분열 가능' },
  'inertia-retention': { label: '관성 보존', effect: '관성 속도 보너스가 두 번째 직접 타격까지 유지' },
  'complete-cycle': { label: '완전 순환', effect: '과충전 첫 타격 처치 시 즉시 귀환' },
  'direct-link': { label: '직격 연동', effect: '재장전 과충전 일부를 보조 피해에도 적용' },
  'superconducting-circuit': { label: '초전도 회로', effect: '전도 대상·피해 증가' },
  'resonance-rupture': { label: '공명 파열', effect: '최대 공명 직접 타격에 확정 충격파' },
};

const CARD_Y = [270, 400, 530] as const;
const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
] as const;

function copyFor(choice: BossRewardChoice): { label: string; effect: string } {
  if (choice.kind === 'relic') return REWARD_COPY[choice.id];
  return {
    label: `${ABILITY_DEFINITIONS[choice.id].label} +1등급`,
    effect: ABILITY_DEFINITIONS[choice.id].summary,
  };
}

export class BossRewardOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private keyBindings: Array<{ key: Phaser.Input.Keyboard.Key; callback: () => void }> = [];
  private visible = false;
  private consumed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    choices: readonly BossRewardChoice[],
    onSelect: (choice: BossRewardChoice) => boolean,
  ): void {
    this.hide();
    this.visible = true;
    this.consumed = false;
    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050d, 0.92)
        .setDepth(40)
        .setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, 132, 'BOSS REWARD', {
        color: '#ffd166', fontSize: '30px', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
      this.scene.add.text(GAME_WIDTH / 2, 172, '강화 하나를 선택하세요', {
        color: '#f7e7b2', fontSize: '16px',
      }).setOrigin(0.5).setDepth(42),
    );

    choices.slice(0, 3).forEach((choice, index) => {
      const select = () => this.select(choice, onSelect);
      const card = this.scene.add.rectangle(GAME_WIDTH / 2, CARD_Y[index]!, 380, 104, 0x2b2340, 0.99)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', select);
      const copy = copyFor(choice);
      const text = this.scene.add.text(
        GAME_WIDTH / 2,
        CARD_Y[index]!,
        `${index + 1}. ${copy.label}\n${copy.effect}`,
        { align: 'center', color: '#fff4cf', fontSize: '18px', lineSpacing: 8 },
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

  private select(
    choice: BossRewardChoice,
    onSelect: (choice: BossRewardChoice) => boolean,
  ): void {
    if (this.consumed || !this.visible || !onSelect(choice)) return;
    this.consumed = true;
    this.hide();
  }
}

export type { BossRewardId };
