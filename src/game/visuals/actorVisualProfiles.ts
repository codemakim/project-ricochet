import { GAME_TUNING } from '../config/gameTuning';

export type ActorRole =
  | 'player'
  | 'enemy-basic' | 'enemy-armored' | 'enemy-shooter'
  | 'enemy-splitter' | 'enemy-fragment-left' | 'enemy-fragment-right'
  | 'sentinel-body' | 'sentinel-left-weakpoint' | 'sentinel-right-weakpoint' | 'sentinel-core'
  | 'hive-core' | 'hive-left-shooter' | 'hive-right-shooter'
  | 'hive-left-reflector' | 'hive-right-reflector'
  | 'siege-body' | 'siege-left-weakpoint' | 'siege-right-weakpoint' | 'siege-core';

export type ActorState =
  | 'idle' | 'move' | 'launch' | 'recover' | 'hurt' | 'destroyed' | 'defeated'
  | 'charge' | 'fire' | 'brace' | 'fracture' | 'split'
  | 'attack' | 'broken' | 'exposed' | 'enraged';

export interface ActorAnimationState {
  frames: readonly number[];
  frameRate: number;
  repeat: number;
}

export interface ActorSkinProfile {
  role: ActorRole;
  skinId: string;
  textureKey: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  states: Readonly<Partial<Record<ActorState, ActorAnimationState>>>;
}

const PLAYER_STATES = ['idle', 'move', 'launch', 'recover', 'hurt', 'defeated'] as const;
const BASIC_STATES = ['idle', 'hurt', 'destroyed'] as const;
const ARMORED_STATES = ['idle', 'brace', 'hurt', 'destroyed'] as const;
const SHOOTER_STATES = ['idle', 'charge', 'fire', 'hurt', 'destroyed'] as const;
const SPLITTER_STATES = ['idle', 'fracture', 'split', 'destroyed'] as const;
const BOSS_PART_STATES = ['idle', 'attack', 'hurt', 'broken'] as const;
const BOSS_CORE_STATES = ['idle', 'exposed', 'enraged', 'defeated'] as const;
const HIVE_SHOOTER_STATES = ['idle', 'charge', 'fire', 'hurt', 'broken'] as const;

export const REQUIRED_ACTOR_STATES = {
  player: PLAYER_STATES,
  'enemy-basic': BASIC_STATES,
  'enemy-armored': ARMORED_STATES,
  'enemy-shooter': SHOOTER_STATES,
  'enemy-splitter': SPLITTER_STATES,
  'enemy-fragment-left': BASIC_STATES,
  'enemy-fragment-right': BASIC_STATES,
  'sentinel-body': BOSS_PART_STATES,
  'sentinel-left-weakpoint': BOSS_PART_STATES,
  'sentinel-right-weakpoint': BOSS_PART_STATES,
  'sentinel-core': BOSS_CORE_STATES,
  'hive-core': BOSS_CORE_STATES,
  'hive-left-shooter': HIVE_SHOOTER_STATES,
  'hive-right-shooter': HIVE_SHOOTER_STATES,
  'hive-left-reflector': BOSS_PART_STATES,
  'hive-right-reflector': BOSS_PART_STATES,
  'siege-body': BOSS_PART_STATES,
  'siege-left-weakpoint': BOSS_PART_STATES,
  'siege-right-weakpoint': BOSS_PART_STATES,
  'siege-core': BOSS_CORE_STATES,
} as const satisfies Record<ActorRole, readonly ActorState[]>;

interface ActorDimensions {
  width: number;
  height: number;
}

const ROLE_DIMENSIONS: Record<ActorRole, ActorDimensions> = {
  player: GAME_TUNING.player.visual,
  'enemy-basic': {
    width: GAME_TUNING.encounter.grid.cellWidth,
    height: GAME_TUNING.encounter.grid.cellHeight,
  },
  'enemy-armored': {
    width: GAME_TUNING.encounter.grid.cellWidth,
    height: GAME_TUNING.encounter.grid.cellHeight,
  },
  'enemy-shooter': {
    width: GAME_TUNING.encounter.grid.cellWidth,
    height: GAME_TUNING.encounter.grid.cellHeight,
  },
  'enemy-splitter': {
    width: GAME_TUNING.encounter.grid.cellWidth * 2,
    height: GAME_TUNING.encounter.grid.cellHeight,
  },
  'enemy-fragment-left': {
    width: GAME_TUNING.encounter.grid.cellWidth,
    height: GAME_TUNING.encounter.grid.cellHeight,
  },
  'enemy-fragment-right': {
    width: GAME_TUNING.encounter.grid.cellWidth,
    height: GAME_TUNING.encounter.grid.cellHeight,
  },
  'sentinel-body': GAME_TUNING.boss.body,
  'sentinel-left-weakpoint': GAME_TUNING.boss.weakpoint.visual,
  'sentinel-right-weakpoint': GAME_TUNING.boss.weakpoint.visual,
  'sentinel-core': {
    width: GAME_TUNING.boss.core.visualSize,
    height: GAME_TUNING.boss.core.visualSize,
  },
  'hive-core': {
    width: GAME_TUNING.hiveBoss.core.visualSize,
    height: GAME_TUNING.hiveBoss.core.visualSize,
  },
  'hive-left-shooter': GAME_TUNING.hiveBoss.shooter,
  'hive-right-shooter': GAME_TUNING.hiveBoss.shooter,
  'hive-left-reflector': GAME_TUNING.hiveBoss.reflector,
  'hive-right-reflector': GAME_TUNING.hiveBoss.reflector,
  'siege-body': GAME_TUNING.boss.body,
  'siege-left-weakpoint': GAME_TUNING.boss.weakpoint.visual,
  'siege-right-weakpoint': GAME_TUNING.boss.weakpoint.visual,
  'siege-core': {
    width: GAME_TUNING.boss.core.visualSize,
    height: GAME_TUNING.boss.core.visualSize,
  },
};

function statesFor(role: ActorRole): ActorSkinProfile['states'] {
  return Object.fromEntries(REQUIRED_ACTOR_STATES[role].map((state) => [
    state,
    { frames: [0], frameRate: 1, repeat: state === 'idle' || state === 'move' ? -1 : 0 },
  ]));
}

export const ACTOR_SKIN_PROFILES: readonly ActorSkinProfile[] = (
  Object.keys(REQUIRED_ACTOR_STATES) as ActorRole[]
).map((role) => {
  const { width, height } = ROLE_DIMENSIONS[role];
  return {
    role,
    skinId: 'default',
    textureKey: `actor-${role}-default`,
    url: `/assets/combat/actors/${role}/default.png`,
    frameWidth: width,
    frameHeight: height,
    displayWidth: width,
    displayHeight: height,
    states: statesFor(role),
  };
});

export function actorAnimationKey(role: ActorRole, skinId: string, state: ActorState): string {
  return `actor:${role}:${skinId}:${state}`;
}

export function actorSkinProfile(role: ActorRole, skinId = 'default'): ActorSkinProfile {
  const profile = ACTOR_SKIN_PROFILES.find((candidate) => (
    candidate.role === role && candidate.skinId === skinId
  ));
  if (!profile) throw new RangeError(`unknown ${role} skin: ${skinId}`);
  return profile;
}
