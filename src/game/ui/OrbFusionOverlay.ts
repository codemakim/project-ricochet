import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { OrbSnapshot } from '../orbs/OrbManager';
import { ORB_CORE_DEFINITIONS } from '../orbs/orbCoreRules';
import {
  ORB_FUSION_DEFINITIONS,
  fusionMaterialPairs,
  type FusionOrbId,
  type FusionMaterialPair,
} from '../orbs/orbFusionRules';

const KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
  Phaser.Input.Keyboard.KeyCodes.FOUR,
  Phaser.Input.Keyboard.KeyCodes.FIVE,
  Phaser.Input.Keyboard.KeyCodes.SIX,
] as const;

export class OrbFusionOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rows: Phaser.GameObjects.Rectangle[] = [];
  private keyBindings: Array<{ key: Phaser.Input.Keyboard.Key; callback: () => void }> = [];
  private selected?: FusionMaterialPair;
  private onConfirm?: (firstId: number, secondId: number) => void;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    fusionType: FusionOrbId,
    orbs: readonly OrbSnapshot[],
    onConfirm: (firstId: number, secondId: number) => void,
    onCancel: () => void,
  ): void {
    this.hide();
    const pairs = fusionMaterialPairs(orbs, fusionType);
    if (pairs.length === 0) {
      onCancel();
      return;
    }

    const fusion = ORB_FUSION_DEFINITIONS[fusionType];
    const byId = new Map(orbs.map((orb) => [orb.id, orb]));
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
      this.scene.add.text(GAME_WIDTH / 2, 116, `${fusion.label} 재료 선택`, {
        color: '#dff7ff', fontSize: '28px', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
    );

    pairs.forEach((pair, index) => {
      const first = byId.get(pair.firstId)!;
      const second = byId.get(pair.secondId)!;
      const y = 170 + index * 48;
      const row = this.scene.add.rectangle(GAME_WIDTH / 2, y, 404, 40, fusion.color, 0.22)
        .setDepth(41)
        .setInteractive({ useHandCursor: true });
      const focus = () => this.focus(pair, row);
      row.on('pointerup', focus);
      this.rows.push(row);
      this.objects.push(
        row,
        this.scene.add.text(GAME_WIDTH / 2, y, [
          `슬롯 ${first.id + 1} · ${ORB_CORE_DEFINITIONS[first.coreType as keyof typeof ORB_CORE_DEFINITIONS].label} Lv${first.level}`,
          ` + 슬롯 ${second.id + 1} · ${ORB_CORE_DEFINITIONS[second.coreType as keyof typeof ORB_CORE_DEFINITIONS].label} Lv${second.level}`,
          ` → ${fusion.label} Lv${pair.resultLevel}`,
        ].join(''), { color: '#f4fbff', fontSize: '14px' }).setOrigin(0.5).setDepth(42),
      );
      const keyCode = KEY_CODES[index];
      if (keyCode !== undefined) this.bindKey(keyCode, focus);
    });

    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, 660, 180, 52, 0x1d6e88, 0.98)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.confirm()),
      this.scene.add.text(GAME_WIDTH / 2, 660, '융합', {
        color: '#ffffff', fontSize: '20px', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
    );
    this.bindKey(Phaser.Input.Keyboard.KeyCodes.ENTER, () => this.confirm());
    if (pairs.length === 1) this.focus(pairs[0]!, this.rows[0]!);
  }

  hide(): void {
    for (const { key, callback } of this.keyBindings) key.off('down', callback);
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.rows = [];
    this.keyBindings = [];
    this.selected = undefined;
    this.onConfirm = undefined;
    this.visible = false;
  }

  isVisible(): boolean { return this.visible; }
  destroy(): void { this.hide(); }

  private focus(pair: FusionMaterialPair, row: Phaser.GameObjects.Rectangle): void {
    if (!this.visible) return;
    this.selected = pair;
    for (const candidate of this.rows) candidate.setFillStyle(0x10213d, 0.98);
    row.setFillStyle(0x1d6e88, 0.98);
  }

  private confirm(): void {
    if (!this.visible || !this.selected || !this.onConfirm) return;
    const { firstId, secondId } = this.selected;
    const confirm = this.onConfirm;
    this.hide();
    confirm(firstId, secondId);
  }

  private bindKey(code: number, callback: () => void): void {
    const key = this.scene.input.keyboard?.addKey(code);
    if (!key) return;
    key.on('down', callback);
    this.keyBindings.push({ key, callback });
  }
}
