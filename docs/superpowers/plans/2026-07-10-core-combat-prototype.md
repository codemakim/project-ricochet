# Core Combat Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-playable vertical combat prototype that proves paddle movement, bottom-safe ball bouncing, paddle charging, descending enemies, enemy shots, breach damage, health, defeat, and restart.

**Architecture:** Keep deterministic combat rules in pure TypeScript modules and let one Phaser scene adapt those rules to Arcade Physics. Use generated geometric textures so this milestone has no asset pipeline. Keep presentation disposable; later plans will add run progression, abilities, bosses, persistence, and polish without changing the core rule modules.

**Tech Stack:** Node.js 24+, npm 11+, Phaser 3.90.0, TypeScript 5.9.3, Vite 8.1.4, Vitest 4.1.10, Playwright 1.61.1

## Global Constraints

- Logical playfield is fixed at 450x800 and scales to fit a portrait browser viewport.
- Mobile control is relative horizontal drag; desktop also supports mouse drag and `A/D` or arrow keys.
- Ball survives wall, ceiling, and floor collisions.
- Paddle contact grants 3 charges; a center hit grants 4.
- Charged hits deal 1.5x damage until charges are exhausted.
- Paddle starts with 10 health; normal enemy bullets deal 1; a basic enemy breach deals 2.
- A breached enemy is destroyed immediately.
- Core combat rules stay independent of Phaser and receive unit tests.
- Use generated geometric textures only; final art, audio, haptics, progression, abilities, bosses, and saving are outside this plan.
- Use npm for this repository. Do not add React, a state library, or a general-purpose physics dependency.

## Milestone Boundaries

This is implementation plan 1 of 4 for the approved first-playable spec:

1. Core combat prototype: this document.
2. Twelve-minute run director, experience, choices, abilities, modules, and relic evolution.
3. Six enemies, two mid-bosses, one final boss, drops, threat level, and local persistence.
4. Mobile UX, effects, sound, accessibility, performance tuning, and full acceptance testing.

Each milestone must remain directly playable. Do not begin milestone 2 until this prototype has been played and its core controls accepted.

---

### Task 1: Bootstrap the Phaser application

**Files:**
- Create: `package.json`
- Create: `package-lock.json` via `npm install`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/game/constants.ts`
- Create: `src/main.ts`
- Create: `src/game/constants.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: none
- Produces: `GAME_WIDTH`, `GAME_HEIGHT`, `PADDLE_Y`, `FLOOR_Y`, and a browser entry point that later tasks use

- [ ] **Step 1: Create the package and tool configuration**

`package.json`:

```json
{
  "name": "project-ricochet",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "phaser": "3.90.0"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "typescript": "5.9.3",
    "vite": "8.1.4",
    "vitest": "4.1.10"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts", "playwright.config.ts", "e2e"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
```

`.gitignore`:

```gitignore
node_modules/
dist/
test-results/
playwright-report/
*.tsbuildinfo
.DS_Store
.worktrees/
.superpowers/
```

- [ ] **Step 2: Install the locked dependencies**

Run: `npm install`

Expected: exit 0 and a new `package-lock.json` using the exact versions in `package.json`.

- [ ] **Step 3: Write the failing constants test**

`src/game/constants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, PADDLE_Y } from './constants';

describe('logical playfield', () => {
  it('keeps combat inside the approved portrait dimensions', () => {
    expect({ width: GAME_WIDTH, height: GAME_HEIGHT }).toEqual({ width: 450, height: 800 });
    expect(PADDLE_Y).toBe(720);
    expect(FLOOR_Y).toBe(798);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- src/game/constants.test.ts`

Expected: FAIL because `src/game/constants.ts` does not exist.

- [ ] **Step 5: Add the application shell and constants**

`src/game/constants.ts`:

```ts
export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;
export const PADDLE_Y = 720;
export const FLOOR_Y = 798;
```

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Project Ricochet</title>
  </head>
  <body>
    <main id="game-root" aria-label="Project Ricochet game"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/styles.css`:

```css
:root {
  color-scheme: dark;
  background: #050816;
  font-family: system-ui, sans-serif;
}

* { box-sizing: border-box; }

html, body, #game-root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#game-root {
  display: grid;
  place-items: center;
  touch-action: none;
}

canvas {
  max-width: 100%;
  max-height: 100%;
}
```

`src/main.ts`:

```ts
import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050816',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { create() { this.add.text(225, 400, 'PROJECT RICOCHET', { color: '#dff7ff' }).setOrigin(0.5); } },
});
```

- [ ] **Step 6: Verify the shell**

Run: `npm test -- src/game/constants.test.ts && npm run build`

Expected: 1 test passes; TypeScript and Vite exit 0; `dist/index.html` exists.

- [ ] **Step 7: Commit the bootstrap**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src
git commit -m "chore: bootstrap Phaser prototype"
```

---

### Task 2: Implement deterministic ball rules

**Files:**
- Create: `src/game/physics/ballRules.ts`
- Create: `src/game/physics/ballRules.test.ts`

**Interfaces:**
- Consumes: no Phaser types
- Produces: `paddleBounce(offset, speed)`, `grantCharges(offset)`, `consumeCharge(charges)`, and `capSpeed(velocity)`

- [ ] **Step 1: Write failing ball-rule tests**

`src/game/physics/ballRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { capSpeed, consumeCharge, grantCharges, paddleBounce } from './ballRules';

describe('ball rules', () => {
  it('aims a center paddle hit upward', () => {
    expect(paddleBounce(0, 400)).toEqual({ x: 0, y: -400 });
  });

  it('uses paddle offset to aim without becoming horizontal', () => {
    const velocity = paddleBounce(1, 400);
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeLessThanOrEqual(-100);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(400, 5);
  });

  it('grants one extra charge for a center hit', () => {
    expect(grantCharges(0)).toBe(4);
    expect(grantCharges(0.5)).toBe(3);
  });

  it('consumes one charge and applies charged damage', () => {
    expect(consumeCharge(3)).toEqual({ remaining: 2, damageMultiplier: 1.5 });
    expect(consumeCharge(0)).toEqual({ remaining: 0, damageMultiplier: 1 });
  });

  it('caps excessive speed at 820 pixels per second', () => {
    const velocity = capSpeed({ x: 900, y: -900 });
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(820, 5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/game/physics/ballRules.test.ts`

Expected: FAIL because `ballRules.ts` does not exist.

- [ ] **Step 3: Implement the minimal ball rules**

`src/game/physics/ballRules.ts`:

```ts
export interface Vector {
  x: number;
  y: number;
}

const MAX_SPEED = 820;
const MIN_VERTICAL_RATIO = 0.25;

export function paddleBounce(offset: number, speed: number): Vector {
  const clamped = Math.max(-1, Math.min(1, offset));
  const x = speed * 0.9 * clamped;
  const minimumY = speed * MIN_VERTICAL_RATIO;
  const y = -Math.max(minimumY, Math.sqrt(Math.max(0, speed ** 2 - x ** 2)));
  const magnitude = Math.hypot(x, y);
  return { x: (x / magnitude) * speed, y: (y / magnitude) * speed };
}

export function grantCharges(offset: number): number {
  return Math.abs(offset) <= 0.2 ? 4 : 3;
}

export function consumeCharge(charges: number): { remaining: number; damageMultiplier: number } {
  return charges > 0
    ? { remaining: charges - 1, damageMultiplier: 1.5 }
    : { remaining: 0, damageMultiplier: 1 };
}

export function capSpeed(velocity: Vector): Vector {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= MAX_SPEED) return velocity;
  const scale = MAX_SPEED / speed;
  return { x: velocity.x * scale, y: velocity.y * scale };
}
```

- [ ] **Step 4: Verify ball rules**

Run: `npm test -- src/game/physics/ballRules.test.ts`

Expected: 5 tests pass.

- [ ] **Step 5: Commit ball rules**

```bash
git add src/game/physics
git commit -m "feat: add charged ball rules"
```

---

### Task 3: Implement health, shield, and breach rules

**Files:**
- Create: `src/game/combat/health.ts`
- Create: `src/game/combat/health.test.ts`

**Interfaces:**
- Consumes: enemy kind strings from later scene adapters
- Produces: `createHealth()`, `applyDamage(state, amount)`, and `breachDamage(kind)`

- [ ] **Step 1: Write failing health tests**

`src/game/combat/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyDamage, breachDamage, createHealth } from './health';

describe('paddle health', () => {
  it('starts at ten health with no shield', () => {
    expect(createHealth()).toEqual({ current: 10, maximum: 10, shield: 0, defeated: false });
  });

  it('spends shield before health', () => {
    expect(applyDamage({ current: 10, maximum: 10, shield: 2, defeated: false }, 3))
      .toEqual({ current: 9, maximum: 10, shield: 0, defeated: false });
  });

  it('marks zero health as defeated', () => {
    expect(applyDamage(createHealth(), 10).defeated).toBe(true);
  });

  it('makes a breach hurt more than a normal bullet', () => {
    expect(breachDamage('basic')).toBe(2);
    expect(breachDamage('armored')).toBe(4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/game/combat/health.test.ts`

Expected: FAIL because `health.ts` does not exist.

- [ ] **Step 3: Implement health rules**

`src/game/combat/health.ts`:

```ts
export type EnemyKind = 'basic' | 'armored';

export interface HealthState {
  current: number;
  maximum: number;
  shield: number;
  defeated: boolean;
}

export function createHealth(): HealthState {
  return { current: 10, maximum: 10, shield: 0, defeated: false };
}

export function applyDamage(state: HealthState, amount: number): HealthState {
  const absorbed = Math.min(state.shield, amount);
  const shield = state.shield - absorbed;
  const current = Math.max(0, state.current - (amount - absorbed));
  return { ...state, shield, current, defeated: current === 0 };
}

export function breachDamage(kind: EnemyKind): number {
  return kind === 'armored' ? 4 : 2;
}
```

- [ ] **Step 4: Verify combat rules**

Run: `npm test -- src/game/combat/health.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit health rules**

```bash
git add src/game/combat
git commit -m "feat: add paddle damage rules"
```

---

### Task 4: Add relative drag and keyboard input

**Files:**
- Create: `src/game/input/horizontalInput.ts`
- Create: `src/game/input/horizontalInput.test.ts`

**Interfaces:**
- Consumes: pointer deltas and keyboard direction from `CombatScene`
- Produces: `moveByDelta(currentX, deltaX, objectWidth)` and `moveByDirection(currentX, direction, deltaMs, objectWidth)`

- [ ] **Step 1: Write failing input tests**

`src/game/input/horizontalInput.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { moveByDelta, moveByDirection } from './horizontalInput';

describe('horizontal input', () => {
  it('applies relative drag and clamps to the playfield', () => {
    expect(moveByDelta(225, 50, 96)).toBe(275);
    expect(moveByDelta(440, 50, 96)).toBe(402);
    expect(moveByDelta(10, -50, 96)).toBe(48);
  });

  it('moves keyboard input at 420 pixels per second', () => {
    expect(moveByDirection(225, 1, 100, 96)).toBe(267);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/game/input/horizontalInput.test.ts`

Expected: FAIL because `horizontalInput.ts` does not exist.

- [ ] **Step 3: Implement relative movement**

`src/game/input/horizontalInput.ts`:

```ts
import { GAME_WIDTH } from '../constants';

const KEYBOARD_SPEED = 420;

function clampX(x: number, objectWidth: number): number {
  const half = objectWidth / 2;
  return Math.max(half, Math.min(GAME_WIDTH - half, x));
}

export function moveByDelta(currentX: number, deltaX: number, objectWidth: number): number {
  return clampX(currentX + deltaX, objectWidth);
}

export function moveByDirection(
  currentX: number,
  direction: -1 | 0 | 1,
  deltaMs: number,
  objectWidth: number,
): number {
  return clampX(currentX + direction * KEYBOARD_SPEED * (deltaMs / 1000), objectWidth);
}
```

- [ ] **Step 4: Verify input rules**

Run: `npm test -- src/game/input/horizontalInput.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit input rules**

```bash
git add src/game/input
git commit -m "feat: add horizontal paddle input"
```

---

### Task 5: Integrate a playable combat scene

**Files:**
- Create: `src/game/scenes/CombatScene.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `paddleBounce`, `grantCharges`, `consumeCharge`, `capSpeed`, `moveByDelta`, `moveByDirection`, `createHealth`, `applyDamage`, and `breachDamage`
- Produces: Phaser scene key `combat`; a playable loop with one descending enemy archetype, enemy bullets, health, defeat, and restart

- [ ] **Step 1: Replace the temporary entry point with a missing combat scene import**

`src/main.ts`:

```ts
import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { CombatScene } from './game/scenes/CombatScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050816',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [CombatScene],
});
```

- [ ] **Step 2: Run the build to verify it fails**

Run: `npm run build`

Expected: FAIL because `src/game/scenes/CombatScene.ts` does not exist.

- [ ] **Step 3: Implement the complete combat scene**

`src/game/scenes/CombatScene.ts`:

```ts
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
    this.physics.add.overlap(this.paddle, this.bullets, (_paddle, bullet) => this.hitByBullet(bullet));

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
```

- [ ] **Step 4: Run all unit tests and the production build**

Run: `npm test && npm run build`

Expected: 12 tests pass; TypeScript and Vite exit 0.

- [ ] **Step 5: Perform the first manual combat check**

Run: `npm run dev`

Verify in a browser:

1. Dragging moves the paddle relatively and does not teleport it to the finger.
2. The ball bounces from the floor and remains in play.
3. Paddle contact turns the ball cyan.
4. Charged hits kill the 2-HP enemy faster.
5. Enemies reaching the lower line disappear and remove 2 HP.
6. Enemy bullets remove 1 HP and respect the 500ms invulnerability window.
7. At 0 HP the scene pauses and the restart control creates a fresh run.

Expected: all seven observations hold with no browser console errors.

- [ ] **Step 6: Commit the playable scene**

```bash
git add src/main.ts src/game/scenes/CombatScene.ts
git commit -m "feat: add core ricochet combat"
```

---

### Task 6: Add mobile browser smoke coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/combat.spec.ts`

**Interfaces:**
- Consumes: Vite server at `http://127.0.0.1:4173` and `#game-root canvas`
- Produces: repeatable desktop and mobile-browser launch, sizing, and drag smoke checks

- [ ] **Step 1: Write the failing browser smoke test**

`e2e/combat.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('loads a portrait canvas and accepts a horizontal drag', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(box!.width);

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.97);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height * 0.97, { steps: 5 });
  await page.mouse.up();
  await expect(canvas).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify the missing configuration failure**

Run: `npm run test:e2e`

Expected: FAIL because Playwright has no configured web server or installed Chromium browser.

- [ ] **Step 3: Add Playwright configuration**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
```

- [ ] **Step 4: Install the test browser and run the smoke test**

Run: `npx playwright install chromium && npm run test:e2e`

Expected: 2 tests pass, one desktop and one mobile.

- [ ] **Step 5: Run the complete milestone verification**

Run: `npm test && npm run build && npm run test:e2e && git diff --check`

Expected: 12 unit tests pass, production build exits 0, 2 browser tests pass, and `git diff --check` prints nothing.

- [ ] **Step 6: Commit browser coverage**

```bash
git add playwright.config.ts e2e
git commit -m "test: cover desktop and mobile launch"
```

## Milestone Acceptance

Before starting the run-progression plan, test on one real phone and one desktop browser. Accept this milestone only when:

- Relative drag feels controllable with one hand.
- The finger does not hide the paddle.
- The player notices the difference between floor bounce and paddle charge.
- Paddle offset provides useful aim control.
- Enemy bullets and breach damage have distinct, understandable causes.
- Defeat and restart work without reloading the page.
- A five-minute session produces no stuck ball, escaped object, console error, or visible input lag.

If control feel fails, adjust paddle sensitivity, ball speed, minimum vertical angle, and charge feedback before adding progression systems.
