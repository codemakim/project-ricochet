import Phaser from 'phaser';
import { applyDamage, breachDamage, createHealth, type HealthState } from '../combat/health';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, PADDLE_Y } from '../constants';
import { moveByDelta, moveByDirection } from '../input/horizontalInput';
import { capSpeed, consumeCharge, grantCharges, paddleBounce } from '../physics/ballRules';

const PADDLE_WIDTH = 96;
const BALL_SPEED = 400;
const ENEMY_BREACH_Y = 680;

type Enemy = Phaser.Physics.Arcade.Sprite & { hp: number };
type Ball = Phaser.Physics.Arcade.Sprite & { charges: number };

export class CombatScene extends Phaser.Scene {
  private paddle!: Phaser.Physics.Arcade.Sprite;
  private ball!: Ball;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private health: HealthState = createHealth();
  private healthText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private previousPointerX?: number;
  private invulnerableUntil = 0;
  private defeated = false;

  constructor() {
    super('combat');
  }

  create(): void {
    this.health = createHealth();
    this.previousPointerX = undefined;
    this.invulnerableUntil = 0;
    this.defeated = false;
    this.createTextures();
    this.physics.world.setBounds(0, 0, GAME_WIDTH, FLOOR_Y);

    this.paddle = this.physics.add.staticSprite(GAME_WIDTH / 2, PADDLE_Y, 'paddle');
    this.ball = this.physics.add.sprite(GAME_WIDTH / 2, PADDLE_Y - 32, 'ball') as Ball;
    this.ball.charges = 0;
    this.ball.setCircle(8).setBounce(1, 1).setCollideWorldBounds(true).setVelocity(170, -362);

    this.enemies = this.physics.add.group({ allowGravity: false, immovable: true });
    this.bullets = this.physics.add.group({ allowGravity: false });

    this.physics.add.collider(this.ball, this.paddle, () => this.hitPaddle());
    this.physics.add.collider(this.ball, this.enemies, (_ball, enemy) => this.hitEnemy(enemy as Enemy));
    this.physics.add.overlap(this.paddle, this.bullets, (_paddle, bullet) => this.hitByBullet(bullet as Phaser.GameObjects.GameObject));

    this.healthText = this.add.text(16, 16, '', { color: '#dff7ff', fontSize: '20px' }).setDepth(10);
    this.updateHealthText();
    this.add.text(GAME_WIDTH - 16, 16, 'DRAG / A D', { color: '#6f8aa8', fontSize: '14px' }).setOrigin(1, 0);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({ left: 'A', right: 'D' }) as Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
    this.bindPointerInput();

    this.spawnEnemy();
    this.time.addEvent({ delay: 1400, loop: true, callback: () => this.spawnEnemy() });
    this.time.addEvent({ delay: 1600, loop: true, callback: () => this.fireEnemyBullet() });
  }

  update(_time: number, delta: number): void {
    if (this.defeated) return;

    const left = this.cursors.left.isDown || this.keys.left.isDown;
    const right = this.cursors.right.isDown || this.keys.right.isDown;
    const direction: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    this.setPaddleX(moveByDirection(this.paddle.x, direction, delta, PADDLE_WIDTH));

    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    const capped = capSpeed({ x: body.velocity.x, y: body.velocity.y });
    body.setVelocity(capped.x, capped.y);

    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (enemy.active && enemy.y >= ENEMY_BREACH_Y) {
        enemy.destroy();
        this.damagePaddle(breachDamage('basic'));
      }
    });

    this.bullets.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (bullet.active && bullet.y > GAME_HEIGHT + 16) bullet.destroy();
    });
  }

  private bindPointerInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.previousPointerX = pointer.x;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.previousPointerX === undefined) return;
      const delta = pointer.x - this.previousPointerX;
      this.previousPointerX = pointer.x;
      this.setPaddleX(moveByDelta(this.paddle.x, delta, PADDLE_WIDTH));
    });
    this.input.on('pointerup', () => { this.previousPointerX = undefined; });
  }

  private setPaddleX(x: number): void {
    this.paddle.setX(x).refreshBody();
  }

  private hitPaddle(): void {
    const offset = (this.ball.x - this.paddle.x) / (PADDLE_WIDTH / 2);
    const velocity = paddleBounce(offset, BALL_SPEED);
    this.ball.setVelocity(velocity.x, velocity.y);
    this.ball.charges = grantCharges(offset);
    this.ball.setTint(0x65f6ff);
  }

  private hitEnemy(enemy: Enemy): void {
    const result = consumeCharge(this.ball.charges);
    this.ball.charges = result.remaining;
    enemy.hp -= result.damageMultiplier;
    if (this.ball.charges === 0) this.ball.clearTint();
    if (enemy.hp <= 0) enemy.destroy();
  }

  private hitByBullet(gameObject: Phaser.GameObjects.GameObject): void {
    gameObject.destroy();
    if (this.time.now < this.invulnerableUntil) return;
    this.invulnerableUntil = this.time.now + 500;
    this.damagePaddle(1);
  }

  private damagePaddle(amount: number): void {
    this.health = applyDamage(this.health, amount);
    this.updateHealthText();
    this.cameras.main.flash(80, 170, 35, 60);
    if (this.health.defeated) this.showDefeat();
  }

  private spawnEnemy(): void {
    if (this.defeated) return;
    const x = Phaser.Math.Between(36, GAME_WIDTH - 36);
    const enemy = this.enemies.create(x, 70, 'enemy') as Enemy;
    enemy.hp = 3;
    enemy.setVelocityY(34);
  }

  private fireEnemyBullet(): void {
    if (this.defeated) return;
    const living = this.enemies.getChildren().filter((child) => (child as Enemy).active) as Enemy[];
    const shooter = Phaser.Utils.Array.GetRandom(living);
    if (!shooter) return;
    const bullet = this.bullets.create(shooter.x, shooter.y + 20, 'enemyBullet') as Phaser.Physics.Arcade.Sprite;
    this.physics.moveToObject(bullet, this.paddle, 180);
  }

  private updateHealthText(): void {
    this.healthText.setText(`HP ${this.health.current}/${this.health.maximum}`);
  }

  private showDefeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    this.physics.pause();
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 330, 160, 0x091225, 0.94).setDepth(20);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'SYSTEM DOWN', { color: '#ff7085', fontSize: '28px' })
      .setOrigin(0.5).setDepth(21);
    const restart = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, '다시 시작', { color: '#dff7ff', fontSize: '20px' })
      .setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });
    restart.on('pointerup', () => this.scene.restart());
    panel.setInteractive();
  }

  private createTextures(): void {
    if (this.textures.exists('paddle')) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x4ddcff).fillRoundedRect(0, 0, PADDLE_WIDTH, 18, 7).generateTexture('paddle', PADDLE_WIDTH, 18);
    graphics.clear().fillStyle(0xffffff).fillCircle(8, 8, 8).generateTexture('ball', 16, 16);
    graphics.clear().fillStyle(0xff6b7a).fillRect(0, 0, 52, 30).generateTexture('enemy', 52, 30);
    graphics.clear().fillStyle(0xffd166).fillCircle(5, 5, 5).generateTexture('enemyBullet', 10, 10);
    graphics.destroy();
  }
}
