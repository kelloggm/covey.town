import exp from 'constants';
import { ExportContext } from 'twilio/lib/rest/bulkexports/v1/export';
import { invert } from 'ramda';
import {
  GameMove,
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove,
} from '../../types/CoveyTownSocket';
import Game from './Game';
import TicTacToeGame from './TicTacToeGame';
import Player from '../../lib/Player';
import InvalidParametersError, {
  GAME_FULL_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  BOARD_POSITION_NOT_EMPTY_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
} from '../../lib/InvalidParametersError';

type BoardKey = 'A' | 'B' | 'C';
type Cell = 'A' | 'B' | '' | undefined;

function emptyBoolBoard(): boolean[][] {
  return [
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ];
}

/**
 * A QuantumTicTacToeGame is a Game that implements the rules of the Tic-Tac-Toe variant described at https://www.smbc-comics.com/comic/tic.
 * This class acts as a controller for three underlying TicTacToeGame instances, orchestrating the "quantum" rules by taking
 * the role of the monitor.
 */
export default class QuantumTicTacToeGame extends Game<
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove
> {
  private _games: { A: TicTacToeGame; B: TicTacToeGame; C: TicTacToeGame };

  private _xScore: number;

  private _oScore: number;

  // private _moveCount: number;

  private _privateX: { A: boolean[][]; B: boolean[][]; C: boolean[][] };

  private _privateO: { A: boolean[][]; B: boolean[][]; C: boolean[][] };

  public constructor() {
    super({
      status: 'WAITING_TO_START',
      moves: [],
      xScore: 0,
      oScore: 0,
      publiclyVisible: { A: emptyBoolBoard(), B: emptyBoolBoard(), C: emptyBoolBoard() },
    });

    this._games = { A: new TicTacToeGame(), B: new TicTacToeGame(), C: new TicTacToeGame() };
    this._privateX = { A: emptyBoolBoard(), B: emptyBoolBoard(), C: emptyBoolBoard() };
    this._privateO = { A: emptyBoolBoard(), B: emptyBoolBoard(), C: emptyBoolBoard() };
    this._xScore = this.state.xScore;
    this._oScore = this.state.oScore;
  }

  protected _join(player: Player): void {
    if (this.state.x === player.id || this.state.o === player.id) {
      throw new InvalidParametersError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    }
    if (!this.state.x) {
      this.state = {
        ...this.state,
        x: player.id,
      };
    } else if (!this.state.o) {
      this.state = {
        ...this.state,
        o: player.id,
      };
    } else {
      throw new InvalidParametersError(GAME_FULL_MESSAGE);
    }
    if (this.state.x && this.state.o) {
      this.state = {
        ...this.state,
        status: 'IN_PROGRESS',
      };
    }
  }

  protected _leave(player: Player): void {
    if (this.state.x !== player.id && this.state.o !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }
    if (this.state.x && this.state.o) {
      const winner = this.state.x === player.id ? this.state.o : this.state.x;
      this.state = { ...this.state, status: 'OVER', winner };
      return;
    }
    // Reset stats
    this.state = {
      ...this.state,
      status: 'WAITING_TO_START',
      x: undefined,
      o: undefined,
      moves: [],
      xScore: 0,
      oScore: 0,
      publiclyVisible: { A: emptyBoolBoard(), B: emptyBoolBoard(), C: emptyBoolBoard() },
    };
    this._games = { A: new TicTacToeGame(), B: new TicTacToeGame(), C: new TicTacToeGame() };
    this._privateX = { A: emptyBoolBoard(), B: emptyBoolBoard(), C: emptyBoolBoard() };
    this._privateO = { A: emptyBoolBoard(), B: emptyBoolBoard(), C: emptyBoolBoard() };
    this._xScore = this.state.xScore;
    this._oScore = this.state.oScore;
  }

  private _currentPiece(): 'X' | 'O' {
    return this.state.moves.length % 2 === 0 ? 'X' : 'O';
  }

  private static _threeInARowBool(b: boolean[][]): boolean {
    const lines = [
      [b[0][0], b[0][1], b[0][2]],
      [b[1][0], b[1][1], b[1][2]],
      [b[2][0], b[2][1], b[2][2]],
      [b[0][0], b[1][0], b[2][0]],
      [b[0][1], b[1][1], b[2][1]],
      [b[0][2], b[1][2], b[2][2]],
      [b[0][0], b[1][1], b[2][2]],
      [b[0][2], b[1][1], b[2][0]],
    ];
    return lines.some(([a, b2, c]) => a && b2 && c);
  }

  private _boardLocked(board: BoardKey): boolean {
    return (
      QuantumTicTacToeGame._threeInARowBool(this._privateX[board]) ||
      QuantumTicTacToeGame._threeInARowBool(this._privateO[board])
    );
  }

  /**
   * Checks that the given move is "valid": that the it's the right
   * player's turn, that the game is actually in-progress, etc.
   * @see TicTacToeGame#_validateMove
   */
  private _validateMove(move: GameMove<QuantumTicTacToeMove>): void {
    // TODO: implement me
    if (this.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(GAME_NOT_IN_PROGRESS_MESSAGE);
    }

    const piece = this._currentPiece();
    const expected = piece === 'X' ? this.state.x : this.state.o;
    if (!expected || move.playerID !== expected) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }

    const { board, row, col } = move.move;
    if (!(['A', 'B', 'C'] as const).includes(board)) {
      throw new InvalidParametersError('Invalid board');
    }
    if (row < 0 || row > 2 || col < 0 || col > 2) {
      throw new InvalidParametersError('Move out of bounds');
    }
    if (this._boardLocked(board)) {
      throw new InvalidParametersError('Board already won');
    }

    const mine = (piece === 'X' ? this._privateX : this._privateO)[board];
    if (mine[row][col]) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_EMPTY_MESSAGE);
    }
  }

  public applyMove(move: GameMove<QuantumTicTacToeMove>): void {
    this._validateMove(move);
    const piece = this._currentPiece();
    const opponent = piece === 'X' ? 'O' : 'X';
    const { board, row, col } = move.move;
    const mine = (piece === 'X' ? this._privateX : this._privateO)[board];
    const theirs = (opponent === 'X' ? this._privateX : this._privateO)[board];
    this.state = {
      ...this.state,
      moves: [...this.state.moves, { ...move.move, gamePiece: piece }],
    };
    if (theirs[row][col]) {
      const publicBoard = (this._games[board] as unknown as { _board: Cell[][] })._board;
      if (!publicBoard[row][col]) {
        publicBoard[row][col] = opponent as Cell;
      }
      const newVis = this.state.publiclyVisible[board].map((r, ri) =>
        r.map((c, ci) => (ri === row && ci === col ? true : c)),
      );
      this.state = {
        ...this.state,
        publiclyVisible: { ...this.state.publiclyVisible, [board]: newVis },
      };
      this._checkForWins();
      this._checkForGameEnding();
    }
    mine[row][col] = true;
    this._checkForWins();
    this._checkForGameEnding();
  }

  /**
   * Checks all three sub-games for any new three-in-a-row conditions.
   * Awards points and marks boards as "won" so they can't be played on.
   */
  private _checkForWins(): void {
    let x = 0;
    let o = 0;
    (['A', 'B', 'C'] as const).forEach(k => {
      const xWin = QuantumTicTacToeGame._threeInARowBool(this._privateX[k]);
      const oWin = QuantumTicTacToeGame._threeInARowBool(this._privateO[k]);
      if (xWin) x += 1;
      if (oWin) o += 1;
    });
    this._xScore = x;
    this._oScore = o;
    if (this.state.xScore !== x || this.state.oScore !== o) {
      this.state = { ...this.state, xScore: x, oScore: o };
    }
  }

  /**
   * A Quantum Tic-Tac-Toe game ends when no more moves are possible.
   * This happens when all squares on all boards are either occupied or part of a won board.
   */
  private _checkForGameEnding(): void {
    const allDone = (['A', 'B', 'C'] as const).every(k => {
      if (this._boardLocked(k)) return true;
      const x = this._privateX[k];
      const o = this._privateO[k];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          if (!x[r][c] && !o[r][c]) return false;
        }
      }
      return true;
    });

    if (allDone) {
      let winner: string | undefined;
      if (this._xScore > this._oScore) winner = this.state.x;
      else if (this._oScore > this._xScore) winner = this.state.o;
      this.state = { ...this.state, status: 'OVER', winner };
    }
  }
}
