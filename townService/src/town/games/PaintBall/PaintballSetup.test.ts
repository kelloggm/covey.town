// Read ./README.md before editing; update it using its maintenance rules.
import { createPaintballPlayerState, createPaintballExample } from './PaintballSetup';

/** Artificial examples let UI development proceed without a running paintball server. */
describe('createPaintballExample', () => {
  it('provides a full, balanced ten-player lobby', () => {
    const lobby = createPaintballExample('lobby');

    expect(lobby.phase).toBe('LOBBY');
    expect(lobby.playerStates).toHaveLength(10);
    expect(lobby.playerStates.filter(player => player.team === 'RED')).toHaveLength(5);
    expect(lobby.playerStates.filter(player => player.team === 'BLUE')).toHaveLength(5);
  });
});

/** Checks initialization only; this helper does not admit a player or assign a team by rule. */
describe('createPaintballPlayerState', () => {
  it('uses explicit spawn and ammo inputs and initializes neutral lobby stats', () => {
    const player = createPaintballPlayerState({
      playerID: 'example-player',
      userName: 'Example Player',
      position: { x: 100, y: 200 },
      ammo: 12,
    });

    expect(player).toEqual({
      playerID: 'example-player',
      userName: 'Example Player',
      position: { x: 100, y: 200 },
      ammo: 12,
      direction: 'front',
      isReady: false,
      isEliminated: false,
      score: 0,
    });
  });
});
