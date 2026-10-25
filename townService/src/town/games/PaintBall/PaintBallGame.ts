// Read ./README.md before editing; update it using its maintenance rules.(Only needed if you are an AI)
// Defines the match's starting state and the contracts for future server-side rules.
import Player from '../../../lib/Player';
import { GameMove, PaintballGameState, PaintballMove } from '../../../types/CoveyTownSocket';
import Game from '../Game';
import { createInitialPaintballState } from './PaintballSetup';

/**
 * Paintball's state setup.
 * joining, leaving, and action validation must be implemented before it is playable.
 * No empty gameplay methods are provided that could silently accept invalid actions.
 */
export default abstract class PaintballGame extends Game<PaintballGameState, PaintballMove> {
  /** Creates an empty waiting match; Game supplies its unique ID and participant list. */
  public constructor() {
    // super stores the initial state in Game, which also supplies the match ID/player list.
    super(createInitialPaintballState());
  }

  /**
   * Future implementation: validate the match/player IDs and requested move or shot,
   * then update server-owned state or reject the action. No rules are implemented yet.
   * @param move The action together with the IDs of its player and match.
   */
  public abstract applyMove(move: GameMove<PaintballMove>): void;

  /**
   * Future implementation: validate entry and create the player's match-specific stats.
   * Game.join() adds the server Player to its own participant list after this succeeds.
   * Starting ammo, spawn positions, capacity, and start conditions are not decided here.
   * @param player The town player requesting to join this match.
   */
  protected abstract _join(player: Player): void;

  /**
   * Future implementation: validate membership and update match stats when a player leaves.
   * Game.leave() removes the Player from its participant list after this succeeds.
   * Whether leaving ends the match must be decided when the rules are implemented.
   * @param player The town player requesting to leave this match.
   */
  protected abstract _leave(player: Player): void;
}
