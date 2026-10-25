// Read ./README.md before editing; update it using its maintenance rules.
// JSON shares values without importing runtime TypeScript across package boundaries.
// eslint-disable-next-line import/no-relative-packages
import setup from '../../../../../shared/paintball/setup.json';
import {
  PaintballConfig,
  PaintballGameState,
  PaintballPlayerState,
} from '../../../types/CoveyTownSocket';

/** Shared settings from the saved task guide, not implemented validation/timer rules. */
export const paintballDefaults: Readonly<PaintballConfig> = Object.freeze(setup.defaults);

/** Explicit inputs prevent this initializer from inventing starting ammo or spawn rules. */
export type PaintballPlayerSetup = Pick<
  PaintballPlayerState,
  'playerID' | 'userName' | 'position' | 'ammo'
> &
  Pick<Partial<PaintballPlayerState>, 'team' | 'direction'>;

/**
 * Creates lobby stats from trusted server inputs, not from an unvalidated socket payload.
 * Does not join a game, check capacity, assign balanced teams, or choose a spawn/ammo value.
 */
export function createPaintballPlayerState(input: PaintballPlayerSetup): PaintballPlayerState {
  return {
    ...input,
    position: { ...input.position },
    direction: input.direction ?? 'front',
    isReady: false,
    isEliminated: false,
    score: 0,
  };
}

/** Returns an independent empty lobby; does not join players, allocate timers, or broadcast. */
export function createInitialPaintballState(): PaintballGameState {
  return {
    status: 'WAITING_TO_START',
    phase: 'LOBBY',
    playerStates: [],
    teamScores: { RED: 0, BLUE: 0 },
    projectiles: [],
    countdownRemainingSeconds: 0,
    timeRemainingSeconds: paintballDefaults.matchDurationSeconds,
  };
}

/**
 * Builds a fresh, fictional full lobby for tests, not a live game's player roster.
 * Sample IDs, coordinates, and 12 rounds of ammo are illustrative, not gameplay settings.
 */
export function createPaintballExample(name: 'lobby'): PaintballGameState {
  if (name !== 'lobby') {
    throw new Error(`Unknown paintball example: ${name}`);
  }
  const state = createInitialPaintballState();
  state.playerStates = Array.from({ length: paintballDefaults.maxPlayers }, (_, index) =>
    createPaintballPlayerState({
      playerID: `example-player-${index + 1}`,
      userName: `Example Player ${index + 1}`,
      position: { x: 32 + index * 16, y: 64 },
      ammo: 12,
      team: index % 2 === 0 ? 'RED' : 'BLUE',
    }),
  );
  state.hostPlayerID = state.playerStates[0]?.playerID;
  return state;
}
