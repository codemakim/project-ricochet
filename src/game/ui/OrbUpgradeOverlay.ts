import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { OrbSnapshot } from '../orbs/OrbManager';
import { orbDefinition, type OrbTypeId } from '../orbs/orbFusionRules';

const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
  Phaser.Input.Keyboard.KeyCodes.FOUR,
  Phaser.Input.Keyboard.KeyCodes.FIVE,
  Phaser.Input.Keyboard.KeyCodes.SIX,
] as const;

export class OrbUpgradeOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private detailObjects: Phaser.GameObjects.GameObject[] = [];
  private rows: Phaser.GameObjects.Rectangle[] = [];
  private keyBindings: Array<{ key: Phaser.Input.Keyboard.Key; callback: () => void }> = [];
  private selectedId?: number;
  private onConfirm?: (orbId: number) => void;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    coreType: OrbTypeId,
    orbs: readonly OrbSnapshot[],
    onConfirm: (orbId: number) => void,
    onCancel: () => void,
  ): void {
    this.hide();
    const definition = orbDefinition(coreType);
    const candidates = orbs.filter(({ coreType: type, level }) => (
      type === coreType && level < definition.maximumLevel
    ));
    if (candidates.length === 0) {
      onCancel();
      return;
    }

    this.visible = true;
    this.onConfirm = onConfirm;
    this.objects.push(
      this.scene.add.rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x02050d,
        0.92,
      ).setDepth(40).setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, 120, `${definition.label} 강화`, {
        color: '#dff7ff',
        fontSize: '28px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
    );

    candidates.forEach((orb, index) => {
      const y = 205 + index * 62;
      const row = this.scene.add.rectangle(GAME_WIDTH / 2, y, 360, 50, definition.color, 0.25)
        .setDepth(41)
        .setInteractive({ useHandCursor: true });
      const focus = () => this.focus(orb, row);
      row.on('pointerup', focus);
      this.rows.push(row);
      this.objects.push(
        row,
        this.scene.add.text(
          GAME_WIDTH / 2,
          y,
          `슬롯 ${orb.id + 1} · ${definition.label} Lv${orb.level}`,
          { color: '#f4fbff', fontSize: '16px' },
        ).setOrigin(0.5).setDepth(42),
      );
      this.bindKey(KEY_CODES[index]!, focus);
    });

    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, 640, 180, 52, 0x1d6e88, 0.98)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.confirm()),
      this.scene.add.text(GAME_WIDTH / 2, 640, '강화', {
        color: '#ffffff',
        fontSize: '20px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
    );
    this.bindKey(Phaser.Input.Keyboard.KeyCodes.ENTER, () => this.confirm());
    if (candidates.length === 1) this.focus(candidates[0]!, this.rows[0]!);
  }

  hide(): void {
    for (const { key, callback } of this.keyBindings) key.off('down', callback);
    for (const object of [...this.objects, ...this.detailObjects]) object.destroy();
    this.objects = [];
    this.detailObjects = [];
    this.rows = [];
    this.keyBindings = [];
    this.selectedId = undefined;
    this.onConfirm = undefined;
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hide();
  }

  private focus(orb: OrbSnapshot, row: Phaser.GameObjects.Rectangle): void {
    if (!this.visible) return;
    this.selectedId = orb.id;
    for (const candidate of this.rows) candidate.setFillStyle(0x10213d, 0.98);
    row.setFillStyle(orbDefinition(orb.coreType).color, 0.55);
    for (const object of this.detailObjects) object.destroy();
    this.detailObjects = [this.scene.add.text(
      GAME_WIDTH / 2,
      580,
      orbDefinition(orb.coreType).levelEffects[orb.level]!,
      { align: 'center', color: '#9ec6df', fontSize: '16px' },
    ).setOrigin(0.5).setDepth(42)];
  }

  private confirm(): void {
    if (!this.visible || this.selectedId === undefined || !this.onConfirm) return;
    const id = this.selectedId;
    const confirm = this.onConfirm;
    this.hide();
    confirm(id);
  }

  private bindKey(code: number, callback: () => void): void {
    const key = this.scene.input.keyboard?.addKey(code);
    if (!key) return;
    key.on('down', callback);
    this.keyBindings.push({ key, callback });
  }
}
