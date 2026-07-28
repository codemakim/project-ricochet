import Phaser from 'phaser';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import type { OrbCoreId } from '../orbs/orbCoreRules';
import { ORB_CORE_IDS } from '../orbs/orbCoreRules';

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

const CORE_COPY: Record<OrbCoreId, { label: string; effect: string }> = {
  echo: { label: '반향', effect: '벽 반사 후 다음 직격 강화' },
  corrosion: { label: '부식', effect: '확률로 지속 피해 장판 생성' },
  conduction: { label: '전도', effect: '4회 직격마다 주변 연쇄 피해' },
  inertia: { label: '관성', effect: '직격 후 근접 회수 시 발사 가속' },
};

const CORE_KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
  Phaser.Input.Keyboard.KeyCodes.FOUR,
] as const;

export class OrbLoadoutOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private keyBindings: Array<{
    key: Phaser.Input.Keyboard.Key;
    event: string;
    callback: () => void;
  }> = [];
  private selection?: OrbCoreSelection;
  private statusText?: Phaser.GameObjects.Text;
  private visible = false;
  private consumed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  showStarting(
    onConfirm: (
      types: readonly [OrbCoreId, OrbCoreId, OrbCoreId],
    ) => boolean,
  ): void {
    this.show(3, '출격 코어 3개 선택', (types) => (
      onConfirm(types as readonly [OrbCoreId, OrbCoreId, OrbCoreId])
    ));
  }

  showAdditional(onConfirm: (type: OrbCoreId) => boolean): void {
    this.show(1, '추가 코어 선택', (types) => onConfirm(types[0]!));
  }

  hide(): void {
    for (const { key, event, callback } of this.keyBindings) {
      key.off(event, callback);
    }
    for (const object of this.objects) object.destroy();
    this.keyBindings = [];
    this.objects = [];
    this.selection = undefined;
    this.statusText = undefined;
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

    ORB_CORE_IDS.forEach((type, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 120 : 330;
      const y = 285 + row * 125;
      const choose = () => {
        if (this.consumed || !this.selection?.add(type)) return;
        this.updateStatus(capacity);
      };
      const color = GAME_TUNING.orbCores[type].fill;
      const card = this.scene.add.rectangle(x, y, 180, 96, color, 0.28)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', choose);
      const copy = CORE_COPY[type];
      const text = this.scene.add.text(
        x,
        y,
        `${index + 1}. ${copy.label}\n${copy.effect}`,
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

    this.statusText = this.scene.add.text(GAME_WIDTH / 2, 520, '', {
      color: '#9ec6df',
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(42);
    const confirm = () => {
      if (this.consumed) return;
      const selected = this.selection?.confirm();
      if (!selected || !onConfirm(selected)) return;
      this.consumed = true;
      this.hide();
    };
    const reset = () => {
      if (this.consumed) return;
      this.selection?.reset();
      this.updateStatus(capacity);
    };
    this.objects.push(
      this.statusText,
      this.scene.add.rectangle(GAME_WIDTH / 2, 575, 220, 54, 0x1d6e88, 0.96)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', confirm),
      this.scene.add.text(GAME_WIDTH / 2, 575, '확정', {
        color: '#ffffff',
        fontSize: '20px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(42),
      this.scene.add.rectangle(GAME_WIDTH / 2, 640, 140, 42, 0x27384d, 0.96)
        .setDepth(41)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', reset),
      this.scene.add.text(GAME_WIDTH / 2, 640, '다시 선택', {
        color: '#b9cee0',
        fontSize: '16px',
      }).setOrigin(0.5).setDepth(42),
    );
    this.bindKey(Phaser.Input.Keyboard.KeyCodes.ENTER, 'down', confirm);
    this.bindKey(Phaser.Input.Keyboard.KeyCodes.R, 'down', reset);
    this.updateStatus(capacity);
  }

  private updateStatus(capacity: number): void {
    const labels = this.getSelection().map((type) => CORE_COPY[type].label);
    this.statusText?.setText(
      `선택 ${labels.length}/${capacity}${labels.length ? ` · ${labels.join(' / ')}` : ''}`,
    );
  }

  private bindKey(code: number, event: string, callback: () => void): void {
    const key = this.scene.input.keyboard?.addKey(code);
    if (!key) return;
    key.on(event, callback);
    this.keyBindings.push({ key, event, callback });
  }
}
