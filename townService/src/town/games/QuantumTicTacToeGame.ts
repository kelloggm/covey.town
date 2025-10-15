import InvalidParametersError, {
  BOARD_POSITION_NOT_EMPTY_MESSAGE,
  BOARD_POSITION_NOT_VALID_MESSAGE,
  GAME_FULL_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  INVALID_MOVE_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
} from '../../lib/InvalidParametersError';
import {
  GameMove,
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove,
  TicTacToeMove,
} from '../../types/CoveyTownSocket';
import Game from './Game';
import TicTacToeGame from './TicTacToeGame';
import Player from '../../lib/Player';

type BoardID = 'A' | 'B' | 'C';
type PlayerPiece = 'X' | 'O';

const BOARD_IDS: BoardID[] = ['A', 'B', 'C'];

const emptyGrid = (): boolean[][] => [
  [false, false, false],
  [false, false, false],
  [false, false, false],
];

const cloneGrid = (grid: boolean[][]): boolean[][] => grid.map(row => [...row]);

const createEmptyVisibility = (): Record<BoardID, boolean[][]> => ({
  A: emptyGrid(),
  B: emptyGrid(),
  C: emptyGrid(),
});

const cloneVisibility = (
  visibility: Record<BoardID, boolean[][]>,
): Record<BoardID, boolean[][]> => ({
  A: cloneGrid(visibility.A),
  B: cloneGrid(visibility.B),
  C: cloneGrid(visibility.C),
});

const createEmptyPrivateBoards = (): Record<PlayerPiece, Record<BoardID, boolean[][]>> => ({
  X: {
    A: emptyGrid(),
    B: emptyGrid(),
    C: emptyGrid(),
  },
  O: {
    A: emptyGrid(),
    B: emptyGrid(),
    C: emptyGrid(),
  },
});

const createSubGames = (): { A: TicTacToeGame; B: TicTacToeGame; C: TicTacToeGame } => ({
  A: new TicTacToeGame(),
  B: new TicTacToeGame(),
  C: new TicTacToeGame(),
});

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

  private _moveCount: number;

  private _privateBoards: Record<PlayerPiece, Record<BoardID, boolean[][]>>;

  private _boardWinners: Partial<Record<BoardID, PlayerPiece>>;

  public constructor() {
    super({
      moves: [],
      status: 'WAITING_TO_START',
      xScore: 0,
      oScore: 0,
      publiclyVisible: createEmptyVisibility(),
    });
    this._games = createSubGames();
    this._xScore = 0;
    this._oScore = 0;
    this._moveCount = 0;
    this._privateBoards = createEmptyPrivateBoards();
    this._boardWinners = {};
  }

  private _resetGameState(): void {
    this._games = createSubGames();
    this._privateBoards = createEmptyPrivateBoards();
    this._boardWinners = {};
    this._xScore = 0;
    this._oScore = 0;
    this._moveCount = 0;
    this._result = undefined;
    this.state = {
      moves: [],
      status: 'WAITING_TO_START',
      xScore: 0,
      oScore: 0,
      publiclyVisible: createEmptyVisibility(),
    };
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
      BOARD_IDS.forEach(board => {
        this._games[board].join(player);
      });
      return;
    }
    if (!this.state.o) {
      this.state = {
        ...this.state,
        o: player.id,
        status: 'IN_PROGRESS',
        winner: undefined,
      };
      BOARD_IDS.forEach(board => {
        this._games[board].join(player);
      });
      this._moveCount = this.state.moves.length;
      this._result = undefined;
      return;
    }
    throw new InvalidParametersError(GAME_FULL_MESSAGE);
  }

  protected _leave(player: Player): void {
    const isX = this.state.x === player.id;
    const isO = this.state.o === player.id;
    if (!isX && !isO) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    BOARD_IDS.forEach(board => {
      try {
        this._games[board].leave(player);
      } catch (err) {
        /* no-op: board already reset */
      }
    });

    if (this.state.x && this.state.o) {
      const winnerID = isX ? this.state.o : this.state.x;
      this.state = {
        ...this.state,
        status: 'OVER',
        winner: winnerID,
        x: isX ? undefined : this.state.x,
        o: isO ? undefined : this.state.o,
      };
      return;
    }

    this._resetGameState();
  }

  /**
   * Checks that the given move is "valid": that the it's the right
   * player's turn, that the game is actually in-progress, etc.
   * @see TicTacToeGame#_validateMove
   */
  private _validateMove(move: GameMove<QuantumTicTacToeMove>): {
    piece: PlayerPiece;
    board: BoardID;
    row: 0 | 1 | 2;
    col: 0 | 1 | 2;
  } {
    if (this.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(GAME_NOT_IN_PROGRESS_MESSAGE);
    }
    let piece: PlayerPiece;
    if (move.playerID === this.state.x) {
      piece = 'X';
    } else if (move.playerID === this.state.o) {
      piece = 'O';
    } else {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }
    if (
      (piece === 'X' && this._moveCount % 2 === 1) ||
      (piece === 'O' && this._moveCount % 2 === 0)
    ) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }
    const { board, row, col } = move.move;
    if (!BOARD_IDS.includes(board)) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }
    if (row < 0 || row > 2 || col < 0 || col > 2) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }
    const boardID = board;
    const rowIndex = row as 0 | 1 | 2;
    const colIndex = col as 0 | 1 | 2;
    if (this._boardWinners[boardID]) {
      throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
    }
    if (this._privateBoards[piece][boardID][rowIndex][colIndex]) {
      const isPubliclyVisible = this.state.publiclyVisible[boardID][rowIndex][colIndex];
      const message = isPubliclyVisible ? BOARD_POSITION_NOT_EMPTY_MESSAGE : INVALID_MOVE_MESSAGE;
      throw new InvalidParametersError(message);
    }
    return { piece, board: boardID, row: rowIndex, col: colIndex };
  }

  private _appendMoveToSubGame(board: BoardID, move: TicTacToeMove): void {
    const boardState = this._games[board].state;
    const updatedMoves = [...boardState.moves, move];
    (boardState as unknown as { moves: typeof updatedMoves }).moves = updatedMoves;
    boardState.status = 'IN_PROGRESS';
    boardState.x = this.state.x;
    boardState.o = this.state.o;
  }

  private _markBoardAsWon(board: BoardID, winnerID: string | undefined): void {
    const boardState = this._games[board].state;
    boardState.status = 'OVER';
    boardState.winner = winnerID;
  }

  public applyMove(move: GameMove<QuantumTicTacToeMove>): void {
    const { piece, board, row, col } = this._validateMove(move);
    const boardGame = this._games[board];
    const existingOccupant = boardGame.state.moves.find(
      eachMove => eachMove.row === row && eachMove.col === col,
    );

    let newVisibility = this.state.publiclyVisible;
    if (existingOccupant) {
      if (existingOccupant.gamePiece === piece) {
        throw new InvalidParametersError(BOARD_POSITION_NOT_EMPTY_MESSAGE);
      }
      if (!this.state.publiclyVisible[board][row][col]) {
        newVisibility = cloneVisibility(this.state.publiclyVisible);
        newVisibility[board][row][col] = true;
      }
    } else {
      this._appendMoveToSubGame(board, { gamePiece: piece, row, col });
    }

    this._privateBoards[piece][board][row][col] = true;

    const newMove: QuantumTicTacToeMove = {
      board,
      row,
      col,
      gamePiece: piece,
    };
    const updatedMoves = [...this.state.moves, newMove];
    this._moveCount = updatedMoves.length;
    this.state = {
      ...this.state,
      moves: updatedMoves,
      publiclyVisible: newVisibility,
    };

    this._checkForWins();
    this._checkForGameEnding();
  }

  /**
   * Checks all three sub-games for any new three-in-a-row conditions.
   * Awards points and marks boards as "won" so they can't be played on.
   */
  private _checkForWins(): void {
    let scoreChanged = false;
    for (const board of BOARD_IDS) {
      if (!this._boardWinners[board]) {
        const boardState = this._games[board].state;
        const xOccupancy = emptyGrid();
        const oOccupancy = emptyGrid();
        boardState.moves.forEach(move => {
          if (move.gamePiece === 'X') {
            xOccupancy[move.row][move.col] = true;
          } else {
            oOccupancy[move.row][move.col] = true;
          }
        });
        if (this._hasThreeInARow(xOccupancy)) {
          this._boardWinners[board] = 'X';
          this._xScore += 1;
          scoreChanged = true;
          this._markBoardAsWon(board, this.state.x);
        } else if (this._hasThreeInARow(oOccupancy)) {
          this._boardWinners[board] = 'O';
          this._oScore += 1;
          scoreChanged = true;
          this._markBoardAsWon(board, this.state.o);
        }
      }
    }
    if (scoreChanged) {
      this.state = {
        ...this.state,
        xScore: this._xScore,
        oScore: this._oScore,
      };
    }
  }

  private _boardHasAvailableMove(board: BoardID): boolean {
    if (this._boardWinners[board]) {
      return false;
    }
    const xBoard = this._privateBoards.X[board];
    const oBoard = this._privateBoards.O[board];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if (!xBoard[row][col] || !oBoard[row][col]) {
          return true;
        }
      }
    }
    return false;
  }

  private _markBoardAsTied(board: BoardID): void {
    const boardState = this._games[board].state;
    boardState.status = 'OVER';
    boardState.winner = undefined;
  }

  /**
   * A Quantum Tic-Tac-Toe game ends when no more moves are possible.
   * This happens when all squares on all boards are either occupied or part of a won board.
   */
  private _checkForGameEnding(): void {
    if (this.state.status === 'OVER') {
      return;
    }
    let hasAvailableMove = false;
    for (const board of BOARD_IDS) {
      if (this._boardHasAvailableMove(board)) {
        hasAvailableMove = true;
      } else if (!this._boardWinners[board]) {
        this._markBoardAsTied(board);
      }
    }
    if (hasAvailableMove) {
      return;
    }
    const { x, o } = this.state;
    let winner: string | undefined;
    if (this._xScore > this._oScore) {
      winner = x;
    } else if (this._oScore > this._xScore) {
      winner = o;
    }
    this.state = {
      ...this.state,
      status: 'OVER',
      winner,
    };
    const scores: { [player: string]: number } = {};
    if (x) {
      scores[x] = this._xScore;
    }
    if (o) {
      scores[o] = this._oScore;
    }
    if (Object.keys(scores).length > 0) {
      this._result = {
        gameID: this.id,
        scores,
      };
    }
  }

  private _hasThreeInARow(board: boolean[][]): boolean {
    for (let i = 0; i < 3; i += 1) {
      if (board[i][0] && board[i][1] && board[i][2]) {
        return true;
      }
      if (board[0][i] && board[1][i] && board[2][i]) {
        return true;
      }
    }
    if (board[0][0] && board[1][1] && board[2][2]) {
      return true;
    }
    if (board[0][2] && board[1][1] && board[2][0]) {
      return true;
    }
    return false;
  }
}
