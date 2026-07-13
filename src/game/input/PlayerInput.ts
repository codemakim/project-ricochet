import Phaser from 'phaser';
import { normalize, type Vector } from '../math/vector';
import { pointerRole, stickVector, type PointerRole } from './pointerRoles';

const STICK_RADIUS = 48;

type MovementKey = 'up' | 'down' | 'left' | 'right';

interface ActiveStick {
  pointerId: number;
  origin: Vector;
}

export class PlayerInput {
  private readonly keys: Record<MovementKey, Phaser.Input.Keyboard.Key>;
  private readonly graphics: Record<PointerRole, Phaser.GameObjects.Graphics>;
  private readonly activeSticks: Partial<Record<PointerRole, ActiveStick>> = {};
  private touchMovement: Vector = { x: 0, y: 0 };
  private currentAimCandidate: Vector = { x: 0, y: 0 };
  private currentAimActivated = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getPlayerPosition: () => Vector,
  ) {
    scene.input.addPointer(4);
    this.keys = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<MovementKey, Phaser.Input.Keyboard.Key>;
    this.graphics = {
      move: scene.add.graphics().setDepth(30),
      aim: scene.add.graphics().setDepth(30),
    };

    scene.input.on('pointerdown', this.handlePointerDown);
    scene.input.on('pointermove', this.handlePointerMove);
    scene.input.on('pointerup', this.handlePointerUp);
    scene.input.on('pointerupoutside', this.handlePointerUp);
  }

  get movement(): Vector {
    const keyboard = {
      x: Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      y: Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    };
    const combined = {
      x: keyboard.x + this.touchMovement.x,
      y: keyboard.y + this.touchMovement.y,
    };

    return Math.hypot(combined.x, combined.y) > 1 ? normalize(combined) : combined;
  }

  get aimCandidate(): Vector {
    return this.currentAimCandidate;
  }

  get aimActivated(): boolean {
    return this.currentAimActivated;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.scene.input.off('pointerupoutside', this.handlePointerUp);
    Object.values(this.keys).forEach((key) => this.scene.input.keyboard!.removeKey(key, true, true));
    this.graphics.move.destroy();
    this.graphics.aim.destroy();
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.isMouse(pointer)) return;

    const role = pointerRole(pointer.x);
    if (this.activeSticks[role]) return;

    const origin = { x: pointer.x, y: pointer.y };
    this.activeSticks[role] = { pointerId: pointer.id, origin };
    if (role === 'move') {
      this.touchMovement = { x: 0, y: 0 };
    } else {
      this.currentAimActivated = false;
    }
    this.drawStick(role, origin, origin);
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.isMouse(pointer)) {
      const player = this.getPlayerPosition();
      this.currentAimCandidate = {
        x: pointer.worldX - player.x,
        y: pointer.worldY - player.y,
      };
      this.currentAimActivated = Math.hypot(this.currentAimCandidate.x, this.currentAimCandidate.y) > 0;
      return;
    }

    const role = this.roleForPointer(pointer.id);
    if (!role) return;

    const active = this.activeSticks[role]!;
    const current = { x: pointer.x, y: pointer.y };
    const value = stickVector(active.origin, current, STICK_RADIUS);
    if (role === 'move') {
      this.touchMovement = value;
    } else {
      this.currentAimCandidate = value;
      this.currentAimActivated = Math.hypot(value.x, value.y) > 0;
    }
    this.drawStick(role, active.origin, current);
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.isMouse(pointer)) return;

    const role = this.roleForPointer(pointer.id);
    if (!role) return;

    delete this.activeSticks[role];
    this.graphics[role].clear();
    if (role === 'move') {
      this.touchMovement = { x: 0, y: 0 };
    } else {
      this.currentAimActivated = false;
    }
  };

  private roleForPointer(pointerId: number): PointerRole | undefined {
    if (this.activeSticks.move?.pointerId === pointerId) return 'move';
    if (this.activeSticks.aim?.pointerId === pointerId) return 'aim';
    return undefined;
  }

  private isMouse(pointer: Phaser.Input.Pointer): boolean {
    return pointer === this.scene.input.mousePointer;
  }

  private drawStick(role: PointerRole, origin: Vector, current: Vector): void {
    const value = stickVector(origin, current, STICK_RADIUS);
    const knob = {
      x: origin.x + value.x * STICK_RADIUS,
      y: origin.y + value.y * STICK_RADIUS,
    };
    this.graphics[role]
      .clear()
      .lineStyle(3, 0x65f6ff, 0.45)
      .strokeCircle(origin.x, origin.y, STICK_RADIUS)
      .fillStyle(0x65f6ff, 0.55)
      .fillCircle(knob.x, knob.y, 18);
  }
}
