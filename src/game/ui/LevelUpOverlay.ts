import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { BuildState } from '../progression/BuildState';
import type { AbilityId } from '../progression/progressionRules';

const LABELS: Record<AbilityId, string> = {
  firepower: '화력 증폭',
  kinetic: '운동 에너지',
  explosion: '폭발',
  split: '분열',
};

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
      const label = `${index + 1}. ${LABELS[id]}  ${rank} → ${rank + 1}\n${this.nextEffect(id, build)}`;
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
        return `직접 피해 +${next.directDamageBonus()}`;
      case 'kinetic':
        return `충전 속도 ${next.chargedSpeed()}px/s`;
      case 'explosion': {
        const effect = next.explosion()!;
        return `반경 ${effect.radius}px · 피해 ${effect.damage}`;
      }
      case 'split':
        return `임시 구슬 ${next.splitCount()}개`;
    }
  }

}
