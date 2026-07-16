import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { BossRewardId } from '../progression/bossRewardRules';

const REWARD_COPY: Record<BossRewardId, { label: string; effect: string }> = {
  'expanded-magazine': { label: '증설 탄창', effect: '영구 구슬 +1 · 최대 6개' },
  'recovery-capacitor': { label: '회수 축전기', effect: '근접 회수 충전 3 → 5' },
  'opening-amplifier': { label: '초동 증폭기', effect: '근접 회수 후 첫 적중 직접 피해 +1' },
  'chain-warhead': { label: '연쇄 탄두', effect: '임시 분열 구슬도 폭발 효과 상속' },
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

  show(choices: readonly BossRewardId[], onSelect: (id: BossRewardId) => boolean): void {
    this.hide();
    this.visible = true;
    this.consumed = false;

    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050d, 0.92)
        .setDepth(40)
        .setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, 132, 'BOSS REWARD', {
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
