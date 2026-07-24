import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

export class RunCompleteOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private enterKey?: Phaser.Input.Keyboard.Key;
  private enterCallback?: () => void;
  private restartCallback?: () => void;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(onRestart: () => void): void {
    this.hide();
    this.visible = true;
    this.restartCallback = onRestart;
    const restart = () => this.restart();

    this.objects.push(
      this.scene.add.rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x02050d,
        0.94,
      ).setDepth(50).setInteractive(),
      this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42, 'RUN COMPLETE', {
        color: '#65f6ff',
        fontSize: '30px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(51),
      this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 42, 'RESTART', {
        color: '#dff7ff',
        fontSize: '20px',
      }).setOrigin(0.5).setDepth(51)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', restart),
    );
    this.enterKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.enterCallback = restart;
    this.enterKey?.on('down', restart);
  }

  hide(): void {
    if (this.enterCallback) this.enterKey?.off('down', this.enterCallback);
    for (const object of this.objects) object.destroy();
    this.enterKey = undefined;
    this.enterCallback = undefined;
    this.objects = [];
    this.restartCallback = undefined;
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hide();
  }

  private restart(): void {
    const callback = this.restartCallback;
    if (!this.visible || !callback) return;
    this.hide();
    callback();
  }
}
