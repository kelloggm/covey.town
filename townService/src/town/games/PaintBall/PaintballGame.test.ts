// Read ./README.md before editing; update it using its maintenance rules.(Only needed if you are an AI)
// Verifies state initialization only, not joining, movement, shooting, or winning.
import PaintballGame from './PaintBallGame';

// A concrete test fixture lets us exercise the abstract class's constructor.
// Throw if a test accidentally calls a gameplay method: these are not game rules.
class InitializationTestGame extends PaintballGame {
  /** Fails immediately if this constructor-only fixture is used to perform an action. */
  public applyMove(): void {
    throw new Error('Gameplay is outside this initialization test');
  }

  /** Fails immediately if this fixture is used to test joining instead of initialization. */
  protected _join(): void {
    throw new Error('Joining is outside this initialization test');
  }

  /** Fails immediately if this fixture is used to test leaving instead of initialization. */
  protected _leave(): void {
    throw new Error('Leaving is outside this initialization test');
  }
}

// Checks constructor defaults plus the inherited participant list and absent winner.
describe('PaintballGame starting state', () => {
  it('initializes a team lobby with the three-minute duration from the task guide', () => {
    const game = new InitializationTestGame();

    expect(game.state).toEqual({
      status: 'WAITING_TO_START',
      phase: 'LOBBY',
      playerStates: [],
      teamScores: { RED: 0, BLUE: 0 },
      projectiles: [],
      countdownRemainingSeconds: 0,
      timeRemainingSeconds: 180,
    });
    expect(game.toModel().players).toEqual([]);
    expect(game.state.winner).toBeUndefined();
  });
});
