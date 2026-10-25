# Paintball setup: a practical guide for the team

Updated: October 25, 2026.

**Start here if you want to use the paintball code without reading the full development history.** Read [README.md](./README.md) before changing it; that file contains the handoff and maintenance rules. This guide explains the same setup in simpler language.

## 1. What can we use right now?

We have the **building blocks for storing paintball information**, not a playable paintball game.

| Available now | Not built yet |
| --- | --- |
| Shared names/types for players, teams, matches, and actions | A working paintball screen or arena |
| One shared list of capacity/timing settings | Running countdowns, match timers, or automatic respawns |
| A function that creates an empty match | Real joining, readiness, team-balancing, and host rules |
| A function that creates a player's starting stats | Movement, firing, collision, and score calculation |
| A fictional full lobby for backend tests | Paintball commands connected to the socket handlers |
| Three focused automated tests | A complete playable multiplayer match |

**You do not need a running website or test server to use the backend helpers in a test.** Opening the deployed town will not show a new paintball game just because these files exist.

## 2. Where are the files?

Paths below start at the repository root: the main `covey.town` folder. They do not depend on Ethan's Windows username or personal folder location.

| File | What to use it for |
| --- | --- |
| `shared/types/CoveyTownSocket.d.ts` | Look up the field names and types everyone should use. |
| `shared/paintball/setup.json` | Look up or change the agreed capacity/timing values in one place. |
| `townService/src/town/games/PaintBall/PaintballSetup.ts` | Import backend settings and the initialization/example functions. |
| `townService/src/town/games/PaintBall/PaintBallGame.ts` | Implement future game rules using the existing base-game structure. |
| `townService/src/town/games/PaintBall/PaintballSetup.test.ts` | See how player initialization and the example lobby are tested. |
| `townService/src/town/games/PaintBall/PaintballGame.test.ts` | See how the game's starting state is tested. |
| `townService/src/town/games/PaintBall/README.md` | Check current progress, limitations, and documentation-update rules. |
| `townService/src/town/games/PaintBall/TEAM_GUIDE.md` | This practical guide. |

Keep the capitalization when importing: the implementation filename is **`PaintBallGame.ts`**, but the exported class name is **`PaintballGame`**. Case differences can break imports on the Linux server even when Windows accepts them.

## 3. The three ideas to understand

- **Type:** a description of what information an object must contain. `PaintballPlayerState` describes a player's match stats. A type does not create a player or check an incoming request at runtime.
- **State:** the actual current information, such as a player score of zero or a match phase of `LOBBY`.
- **Helper/factory:** a function that creates an object with the right starting fields. It saves us from writing slightly different starting objects in multiple files.

For example, declaring an `ammo` field gives us somewhere to store ammunition. It does **not** stop a player from firing without ammo. The game-rule code must do that later.

## 4. Backend quick start: use all the existing helpers

The following example belongs in a backend file **inside the same `PaintBall` folder**. The imports are relative to that exact location. Do not paste backend imports into a React component.

```ts
// Read ./README.md before editing paintball code.
import {
  paintballDefaults,
  createInitialPaintballState,
  createPaintballPlayerState,
  createPaintballExample,
} from './PaintballSetup';
import type { PaintballReadyCommand } from '../../../types/CoveyTownSocket';

// A fresh empty match. This does not start a clock or join anyone.
const emptyMatch = createInitialPaintballState();

// A player's starting stats. These are explicit SAMPLE inputs, not approved spawn/ammo rules.
const samplePlayer = createPaintballPlayerState({
  playerID: 'example-player',
  userName: 'Example Player',
  position: { x: 100, y: 200 },
  ammo: 12,
  team: 'RED',
});

// A fictional full lobby, useful for backend tests.
const sampleLobby = createPaintballExample('lobby');

// A typed request object only. Nothing sends or handles this request yet.
const sampleReadyRequest: PaintballReadyCommand = {
  type: 'PaintballReady',
  gameID: 'example-match',
  isReady: true,
};

// Inspect the values while developing. Remove unnecessary logs from final code.
console.log(emptyMatch.phase);
console.log(samplePlayer.score);
console.log(sampleLobby.playerStates.length);
console.log(paintballDefaults.matchDurationSeconds);
console.log(sampleReadyRequest.type);
```

### What each export does

**`paintballDefaults`**

Read shared settings, such as `paintballDefaults.maxPlayers`. Do not copy the same numbers into several unrelated files. Do not assign a new value to this read-only export; edit the JSON source and update the documentation/tests when a setting changes.

**`createInitialPaintballState()`**

Returns an empty lobby with waiting status, zero team scores, zero countdown, empty player/projectile arrays, and 180 seconds of active-match time. Each call creates new arrays/score objects. It does not create a game ID, run timers, admit players, or broadcast updates. The base `Game` class supplies the match ID when an actual game object is constructed.

**`createPaintballPlayerState(input)`**

Requires `playerID`, `userName`, `position`, and `ammo`. `team` and `direction` are optional. It initializes `score` to zero, `isReady` and `isEliminated` to false, and `direction` to `front` unless supplied. It also copies the supplied position object.

The caller must choose valid spawn/ammo inputs using the future server rules. This helper does not validate a raw socket request, check capacity, balance teams, or add the player to a match. Creating the object is not the same as joining.

**`createPaintballExample('lobby')`**

Returns a fresh fictional lobby: ten players, five per team, and the first player marked as host. Its IDs, names, coordinates, and 12 rounds of ammo are sample data. Never use this helper to populate a real live match.

**Only `'lobby'` works right now.** The shared `PaintballExampleName` type reserves other names for future work, but `createPaintballExample('active')` and the other unfinished names are not supported.

## 5. Which data fields should each person read?

### Player information: `PaintballPlayerState`

| Field | Meaning |
| --- | --- |
| `playerID` | The existing town player's ID. |
| `userName` | Their display-name snapshot. |
| `team` | `RED`, `BLUE`, or absent before assignment. |
| `isReady` | Whether they have declared lobby readiness. |
| `direction` | `front`, `back`, `left`, or `right`; not free-angle mouse aiming. |
| `position` | Arena `x` and `y` coordinates. The coordinate scale/spawns still need agreement. |
| `ammo` | Ammunition remaining. There is no approved starting-ammo default in this setup. |
| `score` | Individual score; future server rules calculate it. |
| `isEliminated` | Whether they are currently eliminated. |
| `respawnAtMs` | Optional server timestamp for when they should respawn. |
| `protectedUntilMs` | Optional server timestamp for when spawn protection ends. |
| `lastShotAtMs` | Optional server timestamp of their last accepted shot. |

A `?` in a TypeScript interface means the field may be absent. Handle that case instead of assuming every player already has a team or a respawn timestamp.

The `...AtMs` / `...UntilMs` fields are **Unix epoch timestamps in milliseconds**, not a number of seconds left. A display showing time left will need to derive that from an appropriate current/server-time reference. Do not compare client clock values blindly when implementing authoritative server rules.

### Match information: `PaintballGameState`

| Field | Meaning |
| --- | --- |
| `phase` | Detailed paintball stage: lobby, countdown, active play, or results. |
| `status` | The broader status expected by Covey.Town's existing game system. |
| `playerStates` | Match-specific player stats, not the base class's server `Player` objects. |
| `hostPlayerID` | Optional current host ID; absent in an empty lobby. |
| `teamScores` | Team totals: access them as `state.teamScores.RED` / `.BLUE`. |
| `timeRemainingSeconds` | Active-play time remaining; the field does not run a clock. |
| `countdownRemainingSeconds` | Pre-match countdown remaining; initially zero. |
| `projectiles` | Snapshots of active paintballs; initially empty. |
| `winningTeam` | Optional winning team in results; absent for a tie or unfinished match. |
| `winner` | Inherited optional individual player ID; do not put a team name here. |

When phase-changing code is built, keep `phase` and `status` consistent:

| Paintball phase | Existing status |
| --- | --- |
| `LOBBY` | `WAITING_TO_START` |
| `COUNTDOWN` | `WAITING_TO_START` |
| `ACTIVE` | `IN_PROGRESS` |
| `RESULTS` | `OVER` |

This table describes the intended mapping. Transition methods are not implemented yet.

### Paintball information: `PaintballProjectile`

Contains `id`, `shooterID`, `team`, `position`, and `velocity`. Velocity is expressed in arena-coordinate units **per second**, not per frame. The type supplies a data shape for future rendering and collisions; it does not move a projectile or detect a hit.

## 6. How does frontend code use the types?

Frontend and backend already have their own `src/types/CoveyTownSocket.d.ts` wrappers, which expose the shared declarations.

For example, from a frontend file located directly in **`frontend/src/classes/interactable/`**, this is the type-import path:

```ts
import type {
  PaintballGameState,
  PaintballPlayerState,
  PaintballCommand,
} from '../../types/CoveyTownSocket';
```

The path changes if your component is in another folder. Let VS Code resolve the import from its actual location.

**Do not import the backend `PaintballSetup.ts` into frontend code.** It is not a browser API or a server endpoint. There is not yet a frontend helper for the fictional lobby. A frontend developer can use the shared types to build a clearly labelled local fixture, and the shared JSON can supply settings, but a frontend fixture/import wrapper still needs to be implemented.

## 7. Requests: describe an action, not a guaranteed result

`PaintballCommand` is a draft contract: an agreement about how a request should look.

| Request shape | What it asks for |
| --- | --- |
| `JoinGame` | Join the game. |
| `LeaveGame` + `gameID` | Leave that match. |
| `StartGame` + `gameID` | Request a match start. |
| `GameMove` + `gameID` + `move` | Request movement or firing. |
| `PaintballReady` + `gameID` + `isReady` | Change lobby readiness. |
| `PaintballTeam` + `gameID` + `team` | Request a team preference. |

`PaintballMove` currently describes either `{ type: 'move', direction: ... }` or `{ type: 'shoot', direction: ... }`. The ready-request example in section 4 is an actual typed object, but it does not send a message.

**These paintball-specific requests are not wired into the existing socket command system.** The future controller/area implementation must add safe type narrowing and runtime validation. Existing board-game handlers assume different move fields, so do not simply add paintball to a union and assume the networking works.

`PaintballCommandReturnType` describes a successful join response containing a `gameID`; other successful commands have no payload. It does not implement responses or errors. The eventual handler must reject invalid actions with useful feedback and broadcast accepted state updates.

The server must decide who is acting from the authenticated connection and calculate accepted ammo, hits, scores, and team assignments. A client request must not be trusted to claim a successful hit or its own score.

## 8. Why can't we use `new PaintballGame()` yet?

`PaintballGame` is an **abstract class**: it provides starting state and declares required methods without pretending that their rules are finished.

| Method | Future responsibility |
| --- | --- |
| `_join(player)` | Validate joining and initialize match-specific player stats. |
| `_leave(player)` | Validate leaving and update the match appropriately. |
| `applyMove(move)` | Validate and apply a requested move or shot. |

The base `Game` already manages its own participant list: `join()` calls `_join()` before adding the server player, and `leave()` calls `_leave()` before removing them. Do not add duplicate base-list management inside those methods. Keep the separate match-stat list consistent.

Do not remove `abstract` just to silence an error. First implement and test the missing methods. The concrete subclass inside `PaintballGame.test.ts` exists only to test initialization; its gameplay methods deliberately throw and must not be reused as the actual game.

## 9. How to run the tests in VS Code

1. Open the project and save your files.
2. Select **Terminal → New Terminal**.
3. From the repository root, move into the backend:

```bash
cd townService
```

4. Run just the paintball tests:

```bash
npm test -- --runInBand --runTestsByPath src/town/games/PaintBall/PaintballSetup.test.ts src/town/games/PaintBall/PaintballGame.test.ts
```

These commands assume the project dependencies are already installed. If `npm` or Jest is missing, follow the project's setup instructions; do not install random latest packages to work around it. If your terminal is already in `townService`, skip the `cd` command.

### What do the tests prove?

- `PaintballGame.test.ts`: checks the initial lobby phase/status, empty lists, zero scores/countdown, 180-second time, empty inherited player list, and absent individual winner.
- `PaintballSetup.test.ts`: checks the fictional lobby's ten-player team split, and the explicit player's starting fields/defaults.

`it(...)` names a test. `expect(...)` selects a result. `toBe(...)` checks a value, `toHaveLength(...)` checks an array's size, and `toEqual(...)` compares an object's contents.

A green result means those specific assertions passed. It does not prove the entire game or all possible inputs work. No browser is launched by these tests.

### How to inspect the example lobby

Inside the existing example-lobby test, immediately after it creates `lobby`, temporarily add:

```ts
console.log(JSON.stringify(lobby, null, 2));
```

Save and rerun the focused command. The terminal prints the example data. Remove the log afterward so regular tests stay readable.

### What to do for your next behavior

Write one test describing the next requirement, run it and confirm it fails for the intended reason, implement that one behavior, then rerun. For example, a future countdown test should verify both the correct lobby-to-countdown transition and rejection from an invalid phase. Do not assume those methods already exist.

### Lint and broader checks

Run from `townService`:

```bash
# Check style in the setup/helper files without installing packages.
npx --no-install eslint src/town/games/PaintBall/PaintballSetup.ts src/town/games/PaintBall/PaintballSetup.test.ts

# Check backend types without writing compiled output.
npx --no-install tsc --noEmit -p .

# Run every backend test, not just paintball.
npm test -- --runInBand
```

The last recorded broader checks encountered existing `TwilioVideo.ts` and `TestUtils.ts` type errors. The README records the details. Do not delete unrelated tests or loosen TypeScript's strictness to hide them.

## 10. Who builds on this next?

These responsibilities summarize the saved sprint plan; review changes with the team rather than silently reassigning work.

| Teammate | How this setup supports their work |
| --- | --- |
| Ethan | Review the shared contract, build the phase-transition prototype, and supply the remaining examples/message documentation for Task 2.1. |
| Matthew | Use the player/match/command types when building actual lobby rules and collision experiments. Initialization helpers do not replace admission or balancing rules. |
| Dante | Use the contract while integrating connections and town entry/exit. Actual paintball socket handlers and registration still need work. |
| Bryan | Use the shared types to shape the lobby/arena interface. Do not import server helpers into React; frontend fixtures and live update wiring remain to be added. |

## 11. Before sharing or changing this setup

- Agree before renaming a shared field or changing what it means.
- Keep settings in the shared JSON instead of duplicating magic numbers.
- Treat sample ammo, positions, names, and IDs as fictional data.
- Keep working code separate from proposed behavior in comments and documentation.
- Update both this guide and the README if an import, helper, setting, command, or supported example changes.
- Add tests for new behavior; keep existing tests meaningful.
- Save source changes before running tests or deploying. Local edits do not automatically update the test server or a teammate's checkout.

## Quick glossary

| Word | Plain-language meaning |
| --- | --- |
| Frontend | Browser-side interface and rendering code. |
| Backend | Server-side state and rule code. |
| Shared contract | The names and data shapes both sides agree to use. |
| Fixture | Fictional, clearly labelled test/example data. |
| Factory | A function that returns a newly initialized object. |
| Phase | One stage of a match, such as lobby or results. |
| Abstract | A class with required methods that are not implemented yet. |
| Authoritative server | The server makes the final rule decisions, rather than trusting client claims. |

## Verification note

This guide documents the inspected local source as of October 25, 2026. The test command and backend quick-start example are checked as part of preparing this guide. See the README's guide-history entry for the actual results and scope; this is not a new deployment or proof of playable paintball.
