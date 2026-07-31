import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import {
  ORB_CORE_DEFINITIONS,
  type OrbCoreId,
} from '../orbs/orbCoreRules';

export class OrbCoreSelection {
  private readonly selected: OrbCoreId[] = [];

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('core selection capacity must be a positive integer');
    }
  }

  add(type: OrbCoreId): boolean {
    if (this.selected.length >= this.capacity) return false;
    this.selected.push(type);
    return true;
  }

  confirm(): readonly OrbCoreId[] | null {
    return this.selected.length === this.capacity ? [...this.selected] : null;
  }

  reset(): void {
    this.selected.length = 0;
  }

  getSelection(): readonly OrbCoreId[] {
    return [...this.selected];
  }
}

const CORE_KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
  Phaser.Input.Keyboard.KeyCodes.FOUR,
  Phaser.Input.Keyboard.KeyCodes.FIVE,
  Phaser.Input.Keyboard.KeyCodes.SIX,
] as const;

export class OrbLoadoutOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private keyBindings: Array<{
    key: Phaser.Input.Keyboard.Key;
    event: string;
    callback: () => void;
  }> = [];
  private selection?: OrbCoreSelection;
  private detailObjects: Phaser.GameObjects.GameObject[] = [];
  private visible = false;
  private consumed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  showStarting(
    availableTypes: readonly OrbCoreId[],
    onConfirm: (types: readonly [OrbCoreId]) => boolean,
  ): void {
    this.show(availableTypes, 1, '출격 코어 선택', (types) => (
      onConfirm(types as readonly [OrbCoreId])
    ));
  }

  showAdditional(
    availableTypes: readonly OrbCoreId[],
    onConfirm: (type: OrbCoreId) => boolean,
  ): void {
    this.show(availableTypes, 1, '추가 코어 선택', (types) => onConfirm(types[0]!));
  }

  hide(): void {
    for (const { key, event, callback } of this.keyBindings) {
      key.off(event, callback);
    }
    for (const object of this.objects) object.destroy();
    for (const object of this.detailObjects) object.destroy();
    this.keyBindings = [];
    this.objects = [];
    this.detailObjects = [];
    this.selection = undefined;
    this.visible = false;
    this.consumed = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getSelection(): readonly OrbCoreId[] {
    return this.selection?.getSelection() ?? [];
  }

  destroy(): void {
    this.hide();
  }

  private show(
    availableTypes: readonly OrbCoreId[],
    capacity: number,
    title: string,
    onConfirm: (types: readonly OrbCoreId[]) => boolean,
  ): void {
    this.hide();
    this.visible = true;
    this.selection = new OrbCoreSelection(capacity);
    this.objects.push(
      this.scene.add.rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x02050d,
        0.94,
      ).setDepth(40).setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, 130, title, {
        color: '#dff7ff',
        fontSize: '28px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
    );

    availableTypes.forEach((type, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 120 : 330;
      const y = 285 + row * 125;
      const choose = () => {
        if (this.consumed || !this.selection) return;
        this.selection.reset();
        if (!this.selection.add(type)) return;
        this.showDetail(type);
      };
      const definition = ORB_CORE_DEFINITIONS[type];
      const color = definition.color;
      const card = this.scene.add.rectangle(x, y, 180, 96, color, 0.28)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', choose);
      const text = this.scene.add.text(
        x,
        y,
        `${index + 1}. ${definition.label}`,
        {
          align: 'center',
          color: '#f4fbff',
          fontSize: '15px',
          lineSpacing: 7,
        },
      ).setOrigin(0.5).setDepth(42);
      this.objects.push(card, text);
      this.bindKey(CORE_KEY_CODES[index]!, 'down', choose);
    });

    const confirm = () => {
      if (this.consumed) return;
      const selected = this.selection?.confirm();
      if (!selected || !onConfirm(selected)) return;
      this.consumed = true;
      this.hide();
    };
    this.objects.push(
      this.scene.add.rectangle(GAME_WIDTH / 2, 575, 220, 54, 0x1d6e88, 0.96)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', confirm),
      this.scene.add.text(GAME_WIDTH / 2, 575, '확정', {
        color: '#ffffff',
        fontSize: '20px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
    );
    this.bindKey(Phaser.Input.Keyboard.KeyCodes.ENTER, 'down', confirm);
  }

  private showDetail(type: OrbCoreId): void {
    for (const object of this.detailObjects) object.destroy();
    this.detailObjects = [
      this.scene.add.text(GAME_WIDTH / 2, 520, ORB_CORE_DEFINITIONS[type].summary, {
        align: 'center',
        color: '#9ec6df',
        fontSize: '16px',
      }).setOrigin(0.5).setDepth(42),
    ];
  }

  private bindKey(code: number, event: string, callback: () => void): void {
    const key = this.scene.input.keyboard?.addKey(code);
    if (!key) return;
    key.on(event, callback);
    this.keyBindings.push({ key, event, callback });
  }
}
