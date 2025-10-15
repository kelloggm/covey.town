import InvalidParametersError, {
  BOARD_POSITION_NOT_EMPTY_MESSAGE,
  BOARD_POSITION_NOT_VALID_MESSAGE,
  GAME_FULL_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  INVALID_MOVE_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
} from '../../lib/InvalidParametersError';
import { createPlayerForTesting } from '../../TestUtils';
import Player from '../../lib/Player';
import { GameMove, QuantumTicTacToeMove } from '../../types/CoveyTownSocket';
import QuantumTicTacToeGame from './QuantumTicTacToeGame';

type BoardID = 'A' | 'B' | 'C';
type Position = { board: BoardID; row: 0 | 1 | 2; col: 0 | 1 | 2 };

const BOARD_IDS: BoardID[] = ['A', 'B', 'C'];

type PlayerPiece = 'X' | 'O';

describe('QuantumTicTacToeGame', () => {
  let game: QuantumTicTacToeGame;
  let player1: Player;
  let player2: Player;
  let spectator: Player;

  const createMove = (
    player: Player,
    position: { board: BoardID; row: number; col: number },
  ): GameMove<QuantumTicTacToeMove> => {
    let whosePiece: 'X' | 'O' = 'X';
    if (game.state.o === player.id) {
      whosePiece = 'O';
    } else if (game.state.x === player.id) {
      whosePiece = 'X';
    }
    return {
      playerID: player.id,
      gameID: game.id,
      move: {
        board: position.board,
        row: position.row as 0 | 1 | 2,
        col: position.col as 0 | 1 | 2,
        gamePiece: whosePiece,
      },
    };
  };

  const makeMove = (player: Player, board: BoardID, row: 0 | 1 | 2, col: 0 | 1 | 2) => {
    const move: GameMove<QuantumTicTacToeMove> = createMove(player, { board, row, col });
    game.applyMove(move);
  };

  const expectMoveToThrow = (
    player: Player,
    position: { board: BoardID; row: number; col: number },
    expectedMessage: string,
  ) => {
    const action = () => game.applyMove(createMove(player, position));
    expect(action).toThrowError(InvalidParametersError);
    expect(action).toThrowError(expectedMessage);
  };

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    player1 = createPlayerForTesting();
    player2 = createPlayerForTesting();
    spectator = createPlayerForTesting();
  });

  const joinBothPlayers = () => {
    game.join(player1);
    game.join(player2);
  };

  describe('_join', () => {
    it('should add the first player as X and keep the game waiting', () => {
      game.join(player1);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBeUndefined();
      expect(game.state.status).toBe('WAITING_TO_START');
    });

    it('should add the second player as O and start the game', () => {
      joinBothPlayers();
      expect(game.state.o).toBe(player2.id);
      expect(game.state.status).toBe('IN_PROGRESS');
    });

    it('should reject additional players once the game is full', () => {
      joinBothPlayers();
      expect(() => game.join(spectator)).toThrowError(GAME_FULL_MESSAGE);
    });
  });

  describe('_leave', () => {
    it('should declare the remaining player the winner when one leaves mid-game', () => {
      joinBothPlayers();
      game.leave(player1);
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(player2.id);
    });

    it('should reset the game when the only player leaves before it starts', () => {
      game.join(player1);
      game.leave(player1);
      expect(game.state.status).toBe('WAITING_TO_START');
      expect(game.state.moves).toHaveLength(0);
      expect(game.state.xScore).toBe(0);
      expect(game.state.oScore).toBe(0);
    });
  });

  describe('applyMove', () => {
    const getBoardStatus = (board: BoardID) =>
      (
        game as unknown as {
          _games: Record<BoardID, { state: { status: string; winner?: string } }>;
        }
      )._games[board].state;

    const getBoardMoves = (board: BoardID) =>
      (
        game as unknown as {
          _games: Record<
            BoardID,
            { state: { moves: { gamePiece: 'X' | 'O'; row: number; col: number }[] } }
          >;
        }
      )._games[board].state.moves;

    const getInternals = () =>
      game as unknown as {
        _games: Record<
          BoardID,
          {
            state: {
              moves: { gamePiece: PlayerPiece; row: number; col: number }[];
              status: string;
              winner?: string;
              x?: string;
              o?: string;
            };
          }
        >;
        _boardWinners: Partial<Record<BoardID, PlayerPiece>>;
        _xScore: number;
        _oScore: number;
        _moveCount: number;
        _privateBoards: Record<PlayerPiece, Record<BoardID, boolean[][]>>;
        _checkForGameEnding: () => void;
      } & { _result?: { gameID: string; scores: Record<string, number> } };

    const resetPrivateBoards = () => {
      const internals = getInternals();
      (['X', 'O'] as PlayerPiece[]).forEach(piece => {
        BOARD_IDS.forEach(board => {
          for (let row = 0; row < 3; row += 1) {
            for (let col = 0; col < 3; col += 1) {
              internals._privateBoards[piece][board][row][col] = false;
            }
          }
        });
      });
    };

    const initializeBoardsFromPlacements = (
      placements: { board: BoardID; row: 0 | 1 | 2; col: 0 | 1 | 2; piece: PlayerPiece }[],
    ) => {
      const internals = getInternals();

      resetPrivateBoards();
      BOARD_IDS.forEach(board => {
        delete internals._boardWinners[board];
        const boardState = getBoardStatus(board);
        boardState.status = 'IN_PROGRESS';
        boardState.winner = undefined;
        (
          boardState as unknown as {
            moves: { gamePiece: PlayerPiece; row: number; col: number }[];
          }
        ).moves = [];
      });

      const boardMoves: Record<
        BoardID,
        { gamePiece: PlayerPiece; row: 0 | 1 | 2; col: 0 | 1 | 2 }[]
      > = {
        A: [],
        B: [],
        C: [],
      };

      placements.forEach(move => {
        boardMoves[move.board].push({
          gamePiece: move.piece,
          row: move.row,
          col: move.col,
        });
        internals._privateBoards[move.piece][move.board][move.row][move.col] = true;
      });

      const quantumMoves = placements.map(move => ({
        board: move.board,
        row: move.row,
        col: move.col,
        gamePiece: move.piece,
      }));
      (game.state as unknown as { moves: typeof quantumMoves }).moves = quantumMoves;
      internals._moveCount = quantumMoves.length;

      const hasThreeInARow = (grid: boolean[][]): boolean => {
        for (let i = 0; i < 3; i += 1) {
          if (grid[i][0] && grid[i][1] && grid[i][2]) {
            return true;
          }
          if (grid[0][i] && grid[1][i] && grid[2][i]) {
            return true;
          }
        }
        if (grid[0][0] && grid[1][1] && grid[2][2]) {
          return true;
        }
        if (grid[0][2] && grid[1][1] && grid[2][0]) {
          return true;
        }
        return false;
      };

      const determineWinnerForBoard = (
        moves: { gamePiece: PlayerPiece; row: number; col: number }[],
      ): PlayerPiece | undefined => {
        const xGrid = [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ];
        const oGrid = [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ];
        moves.forEach(move => {
          if (move.gamePiece === 'X') {
            xGrid[move.row][move.col] = true;
          } else {
            oGrid[move.row][move.col] = true;
          }
        });
        if (hasThreeInARow(xGrid)) {
          return 'X';
        }
        if (hasThreeInARow(oGrid)) {
          return 'O';
        }
        return undefined;
      };

      BOARD_IDS.forEach(board => {
        const boardState = getBoardStatus(board);
        const moves = boardMoves[board];
        (
          boardState as unknown as {
            moves: { gamePiece: PlayerPiece; row: number; col: number }[];
          }
        ).moves = moves;
        const winnerPiece = determineWinnerForBoard(moves);
        if (winnerPiece) {
          internals._boardWinners[board] = winnerPiece;
          boardState.status = 'OVER';
          boardState.winner = winnerPiece === 'X' ? game.state.x : game.state.o;
        } else {
          delete internals._boardWinners[board];
          if (moves.length === 9) {
            boardState.status = 'OVER';
            boardState.winner = undefined;
          } else {
            boardState.status = 'IN_PROGRESS';
            boardState.winner = undefined;
          }
        }
      });

      const xWins = BOARD_IDS.filter(board => internals._boardWinners[board] === 'X').length;
      const oWins = BOARD_IDS.filter(board => internals._boardWinners[board] === 'O').length;
      internals._xScore = xWins;
      internals._oScore = oWins;
      game.state.xScore = xWins;
      game.state.oScore = oWins;
      game.state.status = 'IN_PROGRESS';
      game.state.winner = undefined;
      (
        game as unknown as { _result?: { gameID: string; scores: Record<string, number> } }
      )._result = undefined;
    };

    const setUpEndGameScenario = (
      placements: { board: BoardID; row: 0 | 1 | 2; col: 0 | 1 | 2; piece: PlayerPiece }[],
      fullyContestedBoards: BoardID[] = [],
    ) => {
      initializeBoardsFromPlacements(placements);
      const internals = getInternals();
      fullyContestedBoards.forEach(board => {
        if (internals._boardWinners[board]) {
          return;
        }
        for (let row = 0; row < 3; row += 1) {
          for (let col = 0; col < 3; col += 1) {
            internals._privateBoards.X[board][row][col] = true;
            internals._privateBoards.O[board][row][col] = true;
            game.state.publiclyVisible[board][row][col] = true;
          }
        }
      });
      internals._checkForGameEnding();
    };

    describe('validation', () => {
      it('should not allow moves before the game starts', () => {
        game.join(player1);
        expectMoveToThrow(player1, { board: 'A', row: 0, col: 0 }, GAME_NOT_IN_PROGRESS_MESSAGE);
      });

      it('should not allow non-players to move', () => {
        joinBothPlayers();
        expectMoveToThrow(spectator, { board: 'A', row: 0, col: 0 }, PLAYER_NOT_IN_GAME_MESSAGE);
      });

      it("should enforce players' turns", () => {
        joinBothPlayers();
        makeMove(player1, 'A', 0, 0);
        expectMoveToThrow(player1, { board: 'B', row: 1, col: 1 }, MOVE_NOT_YOUR_TURN_MESSAGE);
      });

      it('should reject moves outside the board bounds', () => {
        joinBothPlayers();
        expect(() =>
          game.applyMove(createMove(player1, { board: 'A', row: 3, col: 0 })),
        ).toThrowError(BOARD_POSITION_NOT_VALID_MESSAGE);
        expect(() =>
          game.applyMove(createMove(player1, { board: 'A', row: 0, col: -1 })),
        ).toThrowError(BOARD_POSITION_NOT_VALID_MESSAGE);
      });

      it('should throw an error if a player tries to play on their own piece', () => {
        joinBothPlayers();
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
        expectMoveToThrow(player1, { board: 'A', row: 0, col: 0 }, INVALID_MOVE_MESSAGE);
      });

      it('should reject moves to a board that does not exist', () => {
        joinBothPlayers();
        const invalidMove: GameMove<QuantumTicTacToeMove> = {
          playerID: player1.id,
          gameID: game.id,
          move: {
            board: 'D' as unknown as BoardID,
            row: 0 as const,
            col: 0 as const,
            gamePiece: 'X',
          },
        };
        expect(() => game.applyMove(invalidMove)).toThrowError(BOARD_POSITION_NOT_VALID_MESSAGE);
      });

      it('should reject moves with non-integer coordinates', () => {
        joinBothPlayers();
        expect(() =>
          game.applyMove(createMove(player1, { board: 'A', row: 1.5, col: 0 })),
        ).toThrowError(BOARD_POSITION_NOT_VALID_MESSAGE);
      });
    });

    describe('scoring and game end', () => {
      const playSequence = (sequence: Position[]) => {
        sequence.forEach((move, idx) => {
          const currentPlayer = idx % 2 === 0 ? player1 : player2;
          makeMove(currentPlayer, move.board, move.row, move.col);
        });
      };

      beforeEach(() => {
        joinBothPlayers();
      });

      it('should award X a point when completing a row, even with collisions', () => {
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'A', 0, 0);
        makeMove(player1, 'A', 0, 2);
        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(0);
        const boardA = getBoardStatus('A');
        expect(boardA.status).toBe('OVER');
        expect(boardA.winner).toBe(player1.id);
      });

      it('should award O a point when completing a row', () => {
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'A', 1, 0);
        makeMove(player2, 'B', 0, 1);
        makeMove(player1, 'C', 1, 1);
        makeMove(player2, 'B', 0, 2);
        expect(game.state.xScore).toBe(0);
        expect(game.state.oScore).toBe(1);
        const boardB = getBoardStatus('B');
        expect(boardB.status).toBe('OVER');
        expect(boardB.winner).toBe(player2.id);
      });

      it('should not allow moves on a board that has been won', () => {
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'B', 0, 1);
        makeMove(player1, 'A', 0, 2);
        expectMoveToThrow(player2, { board: 'A', row: 1, col: 1 }, INVALID_MOVE_MESSAGE);
      });

      it('should keep the game in progress while any unwon board has open squares', () => {
        makeMove(player1, 'A', 0, 0);
        makeMove(player2, 'C', 0, 0);
        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'C', 1, 1);
        makeMove(player1, 'A', 0, 2);

        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();

        makeMove(player2, 'B', 0, 0);
        makeMove(player1, 'C', 2, 0);
        makeMove(player2, 'B', 1, 1);
        makeMove(player1, 'C', 2, 1);
        makeMove(player2, 'B', 2, 2);

        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(1);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();

        expect(() => makeMove(player1, 'C', 0, 2)).not.toThrow();
        expect(game.state.status).toBe('IN_PROGRESS');
      });

      it('should end the game when all boards are full or won (X wins)', () => {
        setUpEndGameScenario([
          { board: 'A', row: 0, col: 0, piece: 'X' },
          { board: 'B', row: 0, col: 0, piece: 'O' },
          { board: 'A', row: 0, col: 1, piece: 'X' },
          { board: 'B', row: 1, col: 0, piece: 'O' },
          { board: 'A', row: 0, col: 2, piece: 'X' },
          { board: 'B', row: 2, col: 0, piece: 'O' },
          { board: 'C', row: 0, col: 0, piece: 'X' },
          { board: 'C', row: 1, col: 0, piece: 'O' },
          { board: 'C', row: 0, col: 1, piece: 'X' },
          { board: 'C', row: 1, col: 1, piece: 'O' },
          { board: 'C', row: 0, col: 2, piece: 'X' },
        ]);

        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player1.id);
        expect(game.state.xScore).toBe(2);
        expect(game.state.oScore).toBe(1);

        const { result } = game.toModel();
        expect(result).toBeDefined();
        expect(result?.scores[player1.id]).toBe(2);
        expect(result?.scores[player2.id]).toBe(1);
      });

      it('should end the game when all boards are full or won (O wins)', () => {
        setUpEndGameScenario([
          { board: 'A', row: 0, col: 0, piece: 'X' },
          { board: 'B', row: 0, col: 0, piece: 'O' },
          { board: 'A', row: 0, col: 1, piece: 'X' },
          { board: 'B', row: 1, col: 0, piece: 'O' },
          { board: 'A', row: 0, col: 2, piece: 'X' },
          { board: 'B', row: 2, col: 0, piece: 'O' },
          { board: 'C', row: 0, col: 1, piece: 'X' },
          { board: 'C', row: 0, col: 0, piece: 'O' },
          { board: 'C', row: 1, col: 1, piece: 'X' },
          { board: 'C', row: 1, col: 0, piece: 'O' },
          { board: 'C', row: 2, col: 2, piece: 'X' },
          { board: 'C', row: 2, col: 0, piece: 'O' },
        ]);

        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player2.id);
        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(2);

        const { result } = game.toModel();
        expect(result).toBeDefined();
        expect(result?.scores[player1.id]).toBe(1);
        expect(result?.scores[player2.id]).toBe(2);
      });

      it('should remain in progress when a tied board still has hidden squares', () => {
        setUpEndGameScenario([
          { board: 'A', row: 0, col: 0, piece: 'X' },
          { board: 'B', row: 0, col: 0, piece: 'O' },
          { board: 'A', row: 0, col: 1, piece: 'X' },
          { board: 'B', row: 1, col: 0, piece: 'O' },
          { board: 'A', row: 0, col: 2, piece: 'X' },
          { board: 'B', row: 2, col: 0, piece: 'O' },
          { board: 'C', row: 0, col: 0, piece: 'X' },
          { board: 'C', row: 0, col: 1, piece: 'O' },
          { board: 'C', row: 0, col: 2, piece: 'X' },
          { board: 'C', row: 1, col: 0, piece: 'O' },
          { board: 'C', row: 1, col: 1, piece: 'X' },
          { board: 'C', row: 2, col: 0, piece: 'O' },
          { board: 'C', row: 1, col: 2, piece: 'X' },
          { board: 'C', row: 2, col: 2, piece: 'O' },
          { board: 'C', row: 2, col: 1, piece: 'X' },
        ]);
        expect(game.state.status).toBe('IN_PROGRESS');
        expect(game.state.winner).toBeUndefined();
        expect(() => makeMove(player2, 'C', 0, 0)).not.toThrow();
        expect(game.state.publiclyVisible.C[0][0]).toBe(true);
      });

      it('should declare a tie if scores are equal at the end', () => {
        setUpEndGameScenario(
          [
            { board: 'A', row: 0, col: 0, piece: 'X' },
            { board: 'B', row: 0, col: 0, piece: 'O' },
            { board: 'A', row: 0, col: 1, piece: 'X' },
            { board: 'B', row: 1, col: 0, piece: 'O' },
            { board: 'A', row: 0, col: 2, piece: 'X' },
            { board: 'B', row: 2, col: 0, piece: 'O' },
            { board: 'C', row: 0, col: 0, piece: 'X' },
            { board: 'C', row: 0, col: 1, piece: 'O' },
            { board: 'C', row: 0, col: 2, piece: 'X' },
            { board: 'C', row: 1, col: 0, piece: 'O' },
            { board: 'C', row: 1, col: 1, piece: 'X' },
            { board: 'C', row: 2, col: 0, piece: 'O' },
            { board: 'C', row: 1, col: 2, piece: 'X' },
            { board: 'C', row: 2, col: 2, piece: 'O' },
            { board: 'C', row: 2, col: 1, piece: 'X' },
          ],
          ['C'],
        );

        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBeUndefined();
        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(1);

        const { result } = game.toModel();
        expect(result).toBeDefined();
        expect(result?.scores[player1.id]).toBe(1);
        expect(result?.scores[player2.id]).toBe(1);
        expect(() => makeMove(player1, 'C', 0, 0)).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
      });

      it('should allow collisions on a tied board even after it is full', () => {
        const tieBoardSequence: Position[] = [
          { board: 'A', row: 0, col: 0 },
          { board: 'A', row: 0, col: 1 },
          { board: 'A', row: 0, col: 2 },
          { board: 'A', row: 1, col: 1 },
          { board: 'A', row: 1, col: 0 },
          { board: 'A', row: 1, col: 2 },
          { board: 'A', row: 2, col: 1 },
          { board: 'A', row: 2, col: 0 },
          { board: 'A', row: 2, col: 2 },
        ];
        tieBoardSequence.forEach((move, idx) => {
          const currentPlayer = idx % 2 === 0 ? player1 : player2;
          makeMove(currentPlayer, move.board, move.row, move.col);
        });

        expect(getBoardMoves('A')).toHaveLength(9);
        expect(game.state.xScore).toBe(0);
        expect(game.state.oScore).toBe(0);
        expect(game.state.publiclyVisible.A[0][0]).toBe(false);

        expect(() => makeMove(player2, 'A', 0, 0)).not.toThrow();
        expect(game.state.publiclyVisible.A[0][0]).toBe(true);
        expect(getBoardMoves('A')).toHaveLength(9);
      });

      it('should preserve the recorded result after the game ends', () => {
        const sequence: Position[] = [
          { board: 'A', row: 0, col: 0 },
          { board: 'B', row: 0, col: 0 },
          { board: 'A', row: 0, col: 1 },
          { board: 'B', row: 0, col: 1 },
          { board: 'A', row: 0, col: 2 },
          { board: 'C', row: 1, col: 1 },
          { board: 'C', row: 0, col: 0 },
          { board: 'C', row: 2, col: 2 },
          { board: 'C', row: 1, col: 0 },
          { board: 'B', row: 1, col: 1 },
          { board: 'C', row: 2, col: 0 },
          { board: 'B', row: 0, col: 2 },
        ];
        playSequence(sequence);

        const firstModel = game.toModel();
        const secondModel = game.toModel();
        expect(secondModel.result).toBe(firstModel.result);
        expect(secondModel.result?.scores).toEqual({
          [player1.id]: 2,
          [player2.id]: 1,
        });
      });
    });

    describe('visibility and collisions', () => {
      beforeEach(() => {
        joinBothPlayers();
      });

      it('should keep a square hidden until a collision occurs and reveal it afterwards', () => {
        makeMove(player1, 'A', 0, 0);
        expect(game.state.publiclyVisible.A[0][0]).toBe(false);
        makeMove(player2, 'A', 0, 0);
        expect(game.state.publiclyVisible.A[0][0]).toBe(true);
        makeMove(player1, 'B', 1, 1);
        expectMoveToThrow(
          player2,
          { board: 'A', row: 0, col: 0 },
          BOARD_POSITION_NOT_EMPTY_MESSAGE,
        );
      });

      it('should not duplicate the underlying subgame move when a collision occurs', () => {
        makeMove(player1, 'A', 0, 0);
        const movesAfterFirstPlacement = getBoardMoves('A');
        expect(movesAfterFirstPlacement).toHaveLength(1);
        expect(movesAfterFirstPlacement[0]).toMatchObject({ gamePiece: 'X', row: 0, col: 0 });

        makeMove(player2, 'A', 0, 0);
        const movesAfterCollision = getBoardMoves('A');
        expect(movesAfterCollision).toHaveLength(1);
        expect(movesAfterCollision[0]).toMatchObject({ gamePiece: 'X', row: 0, col: 0 });
      });
    });

    describe('a full game from start to finish', () => {
      beforeEach(() => {
        joinBothPlayers();
      });

      it('should correctly handle a full game, including collisions, scoring, and a final winner', () => {
        makeMove(player1, 'C', 0, 0);
        expect(game.state.publiclyVisible.C[0][0]).toBe(false);
        makeMove(player2, 'C', 0, 0);
        expect(game.state.publiclyVisible.C[0][0]).toBe(true);

        makeMove(player1, 'A', 0, 0);
        expect(game.state.publiclyVisible.A[0][0]).toBe(false);
        makeMove(player2, 'B', 0, 0);
        expect(game.state.publiclyVisible.B[0][0]).toBe(false);

        makeMove(player1, 'A', 0, 1);
        makeMove(player2, 'B', 0, 1);
        makeMove(player1, 'A', 0, 2);
        makeMove(player2, 'B', 0, 2);

        makeMove(player1, 'C', 1, 0);
        expect(game.state.publiclyVisible.C[1][0]).toBe(false);
        makeMove(player2, 'C', 1, 0);
        expect(game.state.publiclyVisible.C[1][0]).toBe(true);
        makeMove(player1, 'C', 2, 0);

        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player1.id);
        expect(game.state.xScore).toBeGreaterThan(game.state.oScore);
        const boardA = getBoardStatus('A');
        const boardB = getBoardStatus('B');
        const boardC = getBoardStatus('C');
        expect(boardA.status).toBe('OVER');
        expect(boardB.status).toBe('OVER');
        expect(boardC.status).toBe('OVER');
        const { result } = game.toModel();
        expect(result).toBeDefined();
        if (result) {
          expect(Object.values(result.scores)).toEqual(
            expect.arrayContaining([game.state.xScore, game.state.oScore]),
          );
        }
      });
    });
  });
});
