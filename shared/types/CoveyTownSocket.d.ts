// For paintball changes, read townService/src/town/games/PaintBall/README.md
// (path from the repository root) and follow its README maintenance rules.
export type TownJoinResponse = {
  /** Unique ID that represents this player * */
  userID: string;
  /** Secret token that this player should use to authenticate
   * in future requests to this service * */
  sessionToken: string;
  /** Secret token that this player should use to authenticate
   * in future requests to the video service * */
  providerVideoToken: string;
  /** List of players currently in this town * */
  currentPlayers: Player[];
  /** Friendly name of this town * */
  friendlyName: string;
  /** Is this a private town? * */
  isPubliclyListed: boolean;
  /** Current state of interactables in this town */
  interactables: TypedInteractable[];
}

export type InteractableType = 'ConversationArea' | 'ViewingArea' | 'TicTacToeArea' | 'ConnectFourArea';
export interface Interactable {
  type: InteractableType;
  id: InteractableID;
  occupants: PlayerID[];
}

export type TownSettingsUpdate = {
  friendlyName?: string;
  isPubliclyListed?: boolean;
}

export type Direction = 'front' | 'back' | 'left' | 'right';

export type PlayerID = string;
export interface Player {
  id: PlayerID;
  userName: string;
  location: PlayerLocation;
};

export type XY = { x: number, y: number };

export interface PlayerLocation {
  /* The CENTER x coordinate of this player's location */
  x: number;
  /* The CENTER y coordinate of this player's location */
  y: number;
  /** @enum {string} */
  rotation: Direction;
  moving: boolean;
  interactableID?: string;
};
export type ChatMessage = {
  author: string;
  sid: string;
  body: string;
  dateCreated: Date;
  interactableID?: string;
};

export interface ConversationArea extends Interactable {
  topic?: string;
};
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface ViewingArea extends Interactable {
  video?: string;
  isPlaying: boolean;
  elapsedTimeSec: number;
}

export type GameStatus = 'IN_PROGRESS' | 'WAITING_TO_START' | 'OVER' | 'WAITING_FOR_PLAYERS';
/**
 * Base type for the state of a game
 */
export interface GameState {
  status: GameStatus;
} 

/**
 * Type for the state of a game that can be won
 */
export interface WinnableGameState extends GameState {
  winner?: PlayerID;
}
/**
 * Base type for a move in a game. Implementers should also extend MoveType
 * @see MoveType
 */
export interface GameMove<MoveType> {
  playerID: PlayerID;
  gameID: GameInstanceID;
  move: MoveType;
}

/** Shared team labels for the first contract draft; review these names with the team. */
export type PaintballTeam = 'RED' | 'BLUE';

/** Paintball-specific lifecycle stages; keep the existing cross-game GameStatus unchanged. */
export type PaintballPhase = 'LOBBY' | 'COUNTDOWN' | 'ACTIVE' | 'RESULTS';

/** Settings from the saved task guide; units are explicit and rules still need implementation. */
export interface PaintballConfig {
  /** Maximum active participants, not the maximum number of town observers. */
  maxPlayers: number;
  /** Active-play duration; excludes any pre-match countdown. */
  matchDurationSeconds: number;
  /** Delay between elimination and respawning, in milliseconds. */
  respawnDelayMs: number;
  /** Protection duration following a respawn, in milliseconds. */
  spawnProtectionMs: number;
  /** Minimum accepted interval between shots from one player, in milliseconds. */
  minShotIntervalMs: number;
}

/** Describes one player's match stats; this type does not initialize or validate values. */
export interface PaintballPlayerState {
  /** Links these match stats to the existing town player's unique ID. */
  playerID: PlayerID;
  /** Snapshot of the display name; refresh from the authoritative town Player as appropriate. */
  userName: string;
  /** Server-assigned team; absent while an entrant is awaiting assignment. */
  team?: PaintballTeam;
  /** Whether this participant has declared readiness in the lobby. */
  isReady: boolean;
  /** Facing direction in the current four-direction input draft; not free-angle aiming. */
  direction: Direction;
  /** Stores the player's arena coordinates; spawn and movement rules are still undecided. */
  position: XY;
  /** Stores remaining ammunition; starting ammo and reload behavior are not implemented. */
  ammo: number;
  /** Stores the server-calculated score; the scoring rules are not implemented. */
  score: number;
  /** Records elimination state; hit detection and respawn rules are not implemented. */
  isEliminated: boolean;
  /** Server Unix epoch milliseconds for respawn; absent if no respawn is pending. */
  respawnAtMs?: number;
  /** Server Unix epoch milliseconds when spawn protection ends; absent when unprotected. */
  protectedUntilMs?: number;
  /** Last accepted shot's server Unix epoch milliseconds; absent before the first shot. */
  lastShotAtMs?: number;
}

/** Server-owned projectile snapshot for later collision logic and client rendering. */
export interface PaintballProjectile {
  /** Unique projectile identifier within the match. */
  id: string;
  /** Participant who fired it; clients must not choose an authoritative shooter. */
  shooterID: PlayerID;
  /** Team at firing time, used by future friendly-fire and rendering rules. */
  team: PaintballTeam;
  /** Arena coordinates; coordinate scale and collision geometry remain a team decision. */
  position: XY;
  /** Arena-coordinate units per second, not a per-frame displacement. */
  velocity: XY;
}

/** Describes the whole match and inherits its status and optional winner. */
export interface PaintballGameState extends WinnableGameState {
  /** Detailed paintball stage; update alongside the inherited cross-game status. */
  phase: PaintballPhase;
  /** Current host's participant ID; absent in an empty lobby. */
  hostPlayerID?: PlayerID;
  /** Server-calculated team totals, not values accepted from a client's input. */
  teamScores: Record<PaintballTeam, number>;
  /** Remaining pre-match countdown; zero outside a running countdown. */
  countdownRemainingSeconds: number;
  /** Active projectiles; declaring the array does not implement firing or collision. */
  projectiles: PaintballProjectile[];
  /** Winning team in results; absent for a tie or an unfinished match. */
  winningTeam?: PaintballTeam;
  /** Holds match-specific player stats, separate from Game's server Player list. */
  playerStates: PaintballPlayerState[];
  /** Stores remaining match time in seconds; declaring this field does not run a timer. */
  timeRemainingSeconds: number;
}

/**
 * Describes a requested move or shot using the existing four-direction town type.
 * A future server implementation must validate it and determine any hits or scores.
 * This declaration alone does not add paintball actions to the socket command union.
 */
export type PaintballMove =
  | { type: 'move'; direction: Direction }
  | { type: 'shoot'; direction: Direction };

/** Lobby readiness request; the server derives the actor from the authenticated socket. */
export interface PaintballReadyCommand {
  type: 'PaintballReady';
  gameID: GameInstanceID;
  isReady: boolean;
}

/** Requested team preference, not an authoritative assignment or permission to unbalance teams. */
export interface PaintballTeamCommand {
  type: 'PaintballTeam';
  gameID: GameInstanceID;
  team: PaintballTeam;
}

/**
 * Draft command contract for the future paintball area/controller.
 * Not yet part of InteractableCommand: existing game handlers assume board-game moves.
 * Integrate with proper narrowing and runtime validation before sending over TownController.
 */
export type PaintballCommand = JoinGameCommand | LeaveGameCommand | StartGameCommand
  | GameMoveCommand<PaintballMove> | PaintballReadyCommand | PaintballTeamCommand;

/** Success payload follows the existing join-ID / no-payload command pattern. */
export type PaintballCommandReturnType<T extends PaintballCommand> =
  T extends JoinGameCommand ? { gameID: GameInstanceID } : undefined;

/** Named, artificial UI/backend fixtures; never a live server state or an actual match. */
export type PaintballExampleName = 'lobby' | 'countdown' | 'active' | 'respawning' | 'tiedResults';

export type TicTacToeGridPosition = 0 | 1 | 2;

/**
 * Type for a move in TicTacToe
 */
export interface TicTacToeMove {
  gamePiece: 'X' | 'O';
  row: TicTacToeGridPosition;
  col: TicTacToeGridPosition;
}

/**
 * Type for the state of a TicTacToe game
 * The state of the game is represented as a list of moves, and the playerIDs of the players (x and o)
 * The first player to join the game is x, the second is o
 */
export interface TicTacToeGameState extends WinnableGameState {
  moves: ReadonlyArray<TicTacToeMove>;
  x?: PlayerID;
  o?: PlayerID;
}

/**
 * Type for the state of a ConnectFour game.
 * The state of the game is represented as a list of moves, and the playerIDs of the players (red and yellow)
 */
export interface ConnectFourGameState extends WinnableGameState {
  // The moves in this game
  moves: ReadonlyArray<ConnectFourMove>;
  // The playerID of the red player, if any
  red?: PlayerID;
  // The playerID of the yellow player, if any
  yellow?: PlayerID;
  // Whether the red player is ready to start the game
  redReady?: boolean;
  // Whether the yellow player is ready to start the game
  yellowReady?: boolean;
  // The color of the player who will make the first move
  firstPlayer: ConnectFourColor;
}

/**
 * Type for a move in ConnectFour
 * Columns are numbered 0-6, with 0 being the leftmost column
 * Rows are numbered 0-5, with 0 being the top row
 */
export interface ConnectFourMove {
  gamePiece: ConnectFourColor;
  col: ConnectFourColIndex;
  row: ConnectFourRowIndex;
}

/**
 * Row indices in ConnectFour start at the top of the board and go down
 */
export type ConnectFourRowIndex = 0 | 1 | 2 | 3 | 4 | 5;
/**
 * Column indices in ConnectFour start at the left of the board and go right
 */
export type ConnectFourColIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ConnectFourColor = 'Red' | 'Yellow';

export type InteractableID = string;
export type GameInstanceID = string;

/**
 * Type for the result of a game
 */
export interface GameResult {
  gameID: GameInstanceID;
  scores: { [playerName: string]: number };
}

/**
 * Base type for an *instance* of a game. An instance of a game
 * consists of the present state of the game (which can change over time),
 * the players in the game, and the result of the game
 * @see GameState
 */
export interface GameInstance<T extends GameState> {
  state: T;
  id: GameInstanceID;
  players: PlayerID[];
  result?: GameResult;
}

/**
 * Base type for an area that can host a game
 * @see GameInstance
 */
export interface GameArea<T extends GameState> extends Interactable {
  game: GameInstance<T> | undefined;
  history: GameResult[];
}

export type CommandID = string;

/**
 * Base type for a command that can be sent to an interactable.
 * This type is used only by the client/server interface, which decorates
 * an @see InteractableCommand with a commandID and interactableID
 */
interface InteractableCommandBase {
  /**
   * A unique ID for this command. This ID is used to match a command against a response
   */
  commandID: CommandID;
  /**
   * The ID of the interactable that this command is being sent to
   */
  interactableID: InteractableID;
  /**
   * The type of this command
   */
  type: string;
}

export type InteractableCommand =  ViewingAreaUpdateCommand | JoinGameCommand | GameMoveCommand<TicTacToeMove> | GameMoveCommand<ConnectFourMove> | StartGameCommand | LeaveGameCommand;
export interface ViewingAreaUpdateCommand  {
  type: 'ViewingAreaUpdate';
  update: ViewingArea;
}
export interface JoinGameCommand {
  type: 'JoinGame';
}
export interface LeaveGameCommand {
  type: 'LeaveGame';
  gameID: GameInstanceID;
}
export interface StartGameCommand {
  type: 'StartGame';
  gameID: GameInstanceID;
}
export interface GameMoveCommand<MoveType> {
  type: 'GameMove';
  gameID: GameInstanceID;
  move: MoveType;
}
export type InteractableCommandReturnType<CommandType extends InteractableCommand> = 
  CommandType extends JoinGameCommand ? { gameID: string}:
  CommandType extends ViewingAreaUpdateCommand ? undefined :
  CommandType extends GameMoveCommand<TicTacToeMove> ? undefined :
  CommandType extends LeaveGameCommand ? undefined :
  never;

export type InteractableCommandResponse<MessageType> = {
  commandID: CommandID;
  interactableID: InteractableID;
  error?: string;
  payload?: InteractableCommandResponseMap[MessageType];
}

export interface ServerToClientEvents {
  playerMoved: (movedPlayer: Player) => void;
  playerDisconnect: (disconnectedPlayer: Player) => void;
  playerJoined: (newPlayer: Player) => void;
  initialize: (initialData: TownJoinResponse) => void;
  townSettingsUpdated: (update: TownSettingsUpdate) => void;
  townClosing: () => void;
  chatMessage: (message: ChatMessage) => void;
  interactableUpdate: (interactable: Interactable) => void;
  commandResponse: (response: InteractableCommandResponse) => void;
}

export interface ClientToServerEvents {
  chatMessage: (message: ChatMessage) => void;
  playerMovement: (movementData: PlayerLocation) => void;
  interactableUpdate: (update: Interactable) => void;
  interactableCommand: (command: InteractableCommand & InteractableCommandBase) => void;
}