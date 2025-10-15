import _ from 'lodash';
import {
  GameArea,
  GameStatus,
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove,
  TicTacToeGridPosition,
} from '../../types/CoveyTownSocket';
import PlayerController from '../PlayerController';
import GameAreaController, {
  GameEventTypes,
  NO_GAME_IN_PROGRESS_ERROR,
  PLAYER_NOT_IN_GAME_ERROR,
} from './GameAreaController';

export type TicTacToeCell = 'X' | 'O' | undefined;
export type QuantumTicTacToeEvents = GameEventTypes & {
  boardChanged: (board: {
    A: TicTacToeCell[][];
    B: TicTacToeCell[][];
    C: TicTacToeCell[][];
  }) => void;
  turnChanged: (isOurTurn: boolean) => void;
};

/**
 * This class is responsible for managing the state of the Quantum Tic Tac Toe game, and for sending commands to the server
 */
export default class QuantumTicTacToeAreaController extends GameAreaController<
  QuantumTicTacToeGameState,
  QuantumTicTacToeEvents
> {
  protected _boards: { A: TicTacToeCell[][]; B: TicTacToeCell[][]; C: TicTacToeCell[][] } = {
    A: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
    B: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
    C: [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ],
  };

  get boards(): { A: TicTacToeCell[][]; B: TicTacToeCell[][]; C: TicTacToeCell[][] } {
    return this._boards;
  }

  get x(): PlayerController | undefined {
    const x = this._model.game?.state.x;
    if (x) {
      return this.occupants.find(eachOccupant => eachOccupant.id === x);
    }
    return undefined;
  }

  get o(): PlayerController | undefined {
    const o = this._model.game?.state.o;
    if (o) {
      return this.occupants.find(eachOccupant => eachOccupant.id === o);
    }
    return undefined;
  }

  get xScore(): number {
    return this._model.game?.state.xScore || 0;
  }

  get oScore(): number {
    return this._model.game?.state.oScore || 0;
  }

  get moveCount(): number {
    return this._model.game?.state.moves.length || 0;
  }

  get winner(): PlayerController | undefined {
    const winner = this._model.game?.state.winner;
    if (winner) {
      return this.occupants.find(eachOccupant => eachOccupant.id === winner);
    }
    return undefined;
  }

  get whoseTurn(): PlayerController | undefined {
    if (this.status !== 'IN_PROGRESS') {
      return undefined;
    }
    if (this.moveCount % 2 === 0) {
      return this.x;
    }
    return this.o;
  }

  get isOurTurn(): boolean {
    return this.whoseTurn?.id === this._townController.ourPlayer.id;
  }

  get isPlayer(): boolean {
    return this._model.game?.players.includes(this._townController.ourPlayer.id) || false;
  }

  get gamePiece(): 'X' | 'O' {
    if (this.x?.id === this._townController.ourPlayer.id) {
      return 'X';
    } else if (this.o?.id === this._townController.ourPlayer.id) {
      return 'O';
    }
    throw new Error(PLAYER_NOT_IN_GAME_ERROR);
  }

  get status(): GameStatus {
    return this._model.game?.state.status || 'WAITING_TO_START';
  }

  public isActive(): boolean {
    return this.status !== 'OVER' && this.status !== 'WAITING_TO_START';
  }

  protected _updateFrom(newModel: GameArea<QuantumTicTacToeGameState>): void {
    const previousBoards = _.cloneDeep(this._boards);
    const wasOurTurn = this.isOurTurn;

    super._updateFrom(newModel);

    const createEmptyBoard = (): TicTacToeCell[][] => [
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
      [undefined, undefined, undefined],
    ];

    const updatedBoards: { A: TicTacToeCell[][]; B: TicTacToeCell[][]; C: TicTacToeCell[][] } = {
      A: createEmptyBoard(),
      B: createEmptyBoard(),
      C: createEmptyBoard(),
    };

    const state = newModel.game?.state;
    if (state) {
      const visibility = state.publiclyVisible ?? {
        A: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
        B: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
        C: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
      };
      type CellInfo = { firstPiece?: 'X' | 'O'; hasOurMove: boolean };
      const cellInfo = new Map<string, CellInfo>();
      const boardKeys: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
      const positions: TicTacToeGridPosition[] = [0, 1, 2];
      let ourPiece: 'X' | 'O' | undefined;
      if (this.isPlayer) {
        try {
          ourPiece = this.gamePiece;
        } catch {
          ourPiece = undefined;
        }
      }

      // Track the earliest move for each square and whether we played there.
      for (const move of state.moves) {
        const key = `${move.board}-${move.row}-${move.col}`;
        const info = cellInfo.get(key) ?? { firstPiece: undefined, hasOurMove: false };
        if (!info.firstPiece) {
          info.firstPiece = move.gamePiece;
        }
        if (ourPiece && move.gamePiece === ourPiece) {
          info.hasOurMove = true;
        }
        cellInfo.set(key, info);
      }

      for (const board of boardKeys) {
        for (const row of positions) {
          for (const col of positions) {
            const key = `${board}-${row}-${col}`;
            const info = cellInfo.get(key);
            const isVisible = visibility[board][row][col];
            let cellValue: TicTacToeCell = undefined;
            if (isVisible && info?.firstPiece) {
              cellValue = info.firstPiece;
            } else if (info?.hasOurMove && ourPiece) {
              cellValue = ourPiece;
            }
            updatedBoards[board][row][col] = cellValue;
          }
        }
      }
    }

    this._boards = updatedBoards;

    const statusInProgress = newModel.game?.state.status === 'IN_PROGRESS';
    if (statusInProgress && !_.isEqual(previousBoards, this._boards)) {
      this.emit('boardChanged', this._boards);
    }

    const isOurTurnNow = this.isOurTurn;
    if (statusInProgress && wasOurTurn !== isOurTurnNow) {
      this.emit('turnChanged', isOurTurnNow);
    }
  }

  public async makeMove(
    board: 'A' | 'B' | 'C',
    row: TicTacToeGridPosition,
    col: TicTacToeGridPosition,
  ) {
    const instanceID = this._instanceID;
    if (!instanceID || this.status !== 'IN_PROGRESS') {
      throw new Error(NO_GAME_IN_PROGRESS_ERROR);
    }
    const move: QuantumTicTacToeMove = {
      gamePiece: this.gamePiece,
      board,
      row,
      col,
    };
    await this._townController.sendInteractableCommand(this.id, {
      type: 'GameMove',
      gameID: instanceID,
      move,
    });
  }
}
