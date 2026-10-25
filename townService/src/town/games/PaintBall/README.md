# Paintball development handoff

Last updated: 2026-10-25 (EDT).

## Read this first — people and AI assistants

**New teammate? Start with [TEAM_GUIDE.md](./TEAM_GUIDE.md).** It explains the imports, helpers, data fields, request shapes, testing steps, and unfinished work in plain language. This README remains the technical handoff and maintenance record.

This README describes the current paintball foundation, not a finished game. Paths are repository-root-relative unless stated otherwise. Preserve capitalization: `PaintBall/PaintBallGame.ts` exports `PaintballGame`; the tests are `PaintballGame.test.ts` and `PaintballSetup.test.ts`.

**Current status:** shared contract types, shared default values, backend initialization helpers, and a fictional lobby example exist. The game class remains abstract. No real lobby admission, phase transitions, timers, combat, or paintball frontend/network integration is implemented. These latest local changes have not been deployed by this task.

## What happened so far

1. Followed the existing Tic-Tac-Toe/base-game structure and reused the owner's starter files.
2. Added shared paintball data definitions, then expanded them with teams, readiness, phases, team scores, projectile data, timestamps, and draft command types.
3. Added `shared/paintball/setup.json` as the single source for the saved task guide's settings: 10 players, 180 seconds of active play, 3000 ms respawn delay, 2000 ms spawn protection, and 300 ms minimum shot interval. The old 120-second example is superseded.
4. Added backend match/player initialization helpers and updated the abstract game's constructor to use the fresh-state factory.
5. A previous interrupted edit left a test importing `createPaintballExample` before it was implemented. Added the actual typed, exported lobby-example helper on 2026-10-25; this fixes both the missing-export diagnostic and the cascading implicit-any callback diagnostics without adding `any` annotations.
6. Kept README pointers and purpose-focused comments in affected paintball files. Unrelated working-tree changes were not overwritten.

## File map

| File | Purpose |
| --- | --- |
| `shared/types/CoveyTownSocket.d.ts` | Type declarations used through the existing frontend/backend type wrappers; no runtime defaults or rule validation. |
| `shared/paintball/setup.json` | Shared numerical defaults, with a `_readme` pointer because JSON does not support comments. |
| `townService/src/town/games/PaintBall/PaintballSetup.ts` | Backend defaults export, fresh match/player initialization, and a fictional lobby fixture. |
| `townService/src/town/games/PaintBall/PaintBallGame.ts` | Abstract game class; delegates initialization to `createInitialPaintballState()`. |
| `townService/src/town/games/PaintBall/PaintballGame.test.ts` | Tests constructor defaults through a test-only concrete subclass. |
| `townService/src/town/games/PaintBall/PaintballSetup.test.ts` | Tests the full balanced example lobby and explicit player initialization. |
| `townService/src/town/games/PaintBall/README.md` | Handoff, actual status, verification, history, and maintenance rules. |
| `townService/src/town/games/PaintBall/TEAM_GUIDE.md` | Beginner-friendly teammate usage guide with copyable backend examples, frontend import guidance, and testing steps. |

Reference files: `townService/src/town/games/Game.ts`, `townService/src/town/games/TicTacToeGame.ts`, and the frontend/backend `src/types/CoveyTownSocket.d.ts` wrappers. These reference files were not changed for this fix.

## Shared types and values

- `PaintballTeam`: draft `RED` / `BLUE` team labels for review.
- `PaintballPhase`: `LOBBY`, `COUNTDOWN`, `ACTIVE`, or `RESULTS`. This does not change the cross-game `GameStatus` union. Future code must update both phase and status consistently.
- `PaintballConfig`: capacity, active duration in seconds, respawn/protection/shot intervals in milliseconds.
- `PaintballPlayerState`: player ID, name, optional team, readiness, four-direction facing, arena position, ammo, score, and elimination flag. Optional `respawnAtMs`, `protectedUntilMs`, and `lastShotAtMs` are server Unix epoch millisecond timestamps, not countdown durations.
- `PaintballProjectile`: ID, shooter ID, firing team, arena position, and velocity in arena-coordinate units per second. These fields do not implement collision or projectile simulation.
- `PaintballGameState`: player stats, phase, optional host, team scores, countdown, projectiles, active-match time, and optional winning team. It retains inherited `status` and optional individual `winner` for compatibility; team outcomes should use `winningTeam`, not put a team label in `winner`. No outcome computation exists yet.
- `PaintballMove`: four-direction move/shoot request, not a claim of an accepted hit or score change. Free-angle mouse aiming remains a contract decision.
- `PaintballCommand`, `PaintballReadyCommand`, `PaintballTeamCommand`, and `PaintballCommandReturnType`: draft request/success-payload shapes. They are deliberately **not added to the live `InteractableCommand` union** yet; current board-game handlers assume a `gamePiece`. Future integration must narrow inputs and validate them rather than blindly widening that union. The server must derive the acting player from its authenticated socket.
- `PaintballExampleName`: reserves `lobby`, `countdown`, `active`, `respawning`, and `tiedResults` names. **Only `lobby` is currently implemented by `createPaintballExample`, whose argument is intentionally typed as `'lobby'`.** The other names do not imply working factories.

Settings currently match the saved task guide, not evidence that runtime rules enforce them. Starting ammo, spawn geometry, countdown length, and aiming details still require agreement. No general-purpose runtime network validator has been added.

## Backend helper imports and behavior

From a file in the same `PaintBall` directory:

```ts
import {
  paintballDefaults,
  createInitialPaintballState,
  createPaintballPlayerState,
  createPaintballExample,
} from './PaintballSetup';
import { PaintballGameState } from '../../../types/CoveyTownSocket';
```

- `paintballDefaults`: read-only exported settings from the JSON file.
- `createInitialPaintballState()`: returns fresh mutable arrays/score objects for an empty lobby: waiting status, `LOBBY` phase, no players/projectiles, zero team scores/countdown, and 180 seconds of active-match time. Host and winners are not set. No timers or broadcasts start.
- `createPaintballPlayerState(input)`: requires trusted server-selected player ID, name, position, and ammo; optionally accepts team/direction. Copies the position and starts not-ready, not-eliminated, score zero, facing `front` unless supplied. This is initialization, not admission, balancing, spawn selection, or socket validation.
- `createPaintballExample('lobby')`: returns a fresh fictional roster with 10 players, 5 on each team, with the first as host. IDs/names, coordinates, and 12 rounds of sample ammo are explicitly test data, not actual participants or approved starting values. It does not call `join()`, run a match, or connect to a server.

Frontend code should import shared **types** through its own `src/types/CoveyTownSocket` wrapper, with the relative path calculated from the actual file location. It must not import the backend helper module. A frontend example wrapper has not been implemented. Shared JSON values are available for future frontend consumption without runtime TypeScript imports across packages.

## Abstract game responsibilities

The base `Game` owns the match ID, server `Player` list, state access, and `toModel()`. Match-specific `playerStates` is a different collection; future join/leave code must keep both consistent.

`applyMove`, `_join`, and `_leave` remain abstract. The inherited `join()` calls `_join` before adding a base participant; `leave()` calls `_leave` before removing one. Do not remove `abstract` until real tested implementations exist. The constructor test's subclass deliberately throws from gameplay methods; those methods are not game implementations.

## Remaining work and ownership boundary

The whole feature still needs real admission/team/readiness/host rules, lifecycle transitions, timers, movement/combat/scoring/respawns, safe shared command integration, server area/factory registration, frontend controller/UI/map wiring, and end-to-end verification. This list covers the whole team, not only Ethan's sprint assignment.

For Ethan's Task 2.1, review the contract with teammates, complete the phase-transition prototype, and provide the remaining labelled phase examples and message/request-response documentation. Backend lobby rules, multiplayer town integration, and the lobby/arena UI remain their assigned owners' work according to the sprint plan.

## Verification and commands

Run from the repository's `townService` directory:

```bash
# Focused tests
npm test -- --runInBand --runTestsByPath src/town/games/PaintBall/PaintballSetup.test.ts src/town/games/PaintBall/PaintballGame.test.ts

# Lint the files touched by the missing-export fix
npx --no-install eslint src/town/games/PaintBall/PaintballSetup.ts src/town/games/PaintBall/PaintballSetup.test.ts

# Broader checks
npx --no-install tsc --noEmit -p .
npm test -- --runInBand
```

Actual 2026-10-25 results:

- Reproduced the missing export and implicit-any errors before editing.
- After implementing the typed helper, focused tests passed: **2 suites / 3 tests**. No explicit `any` annotations or suppression comments were needed in the filter callbacks.
- Targeted ESLint passed after formatting the setup file.
- Backend typecheck still reports the known untouched `TwilioVideo.ts` missing token identity and `TestUtils.ts` Socket.IO export/symbol conversion errors. No paintball diagnostics were reported in that typecheck.
- Full backend suite: **2 suites passed / 10 failed to compile**, with the same Twilio/TestUtils blockers. All 3 executed tests passed. The broader suite includes unrelated working-tree test changes; those files were not edited in this fix.
- No browser, frontend build, gameplay test, or new deployment was performed for this change. Earlier server smoke checks do not validate these latest local changes.

## README maintenance rules — for every person and AI assistant

1. **Read before editing.** Read this README and the actual affected code, then check `git status --short`. Do not assume all existing changes belong to your task.
2. **Update alongside the code.** Any paintball change to behavior, types, defaults, files, tests, integration, or known limitations must update this README in the same change/PR. For comment-only changes, record the documentation change without claiming new behavior.
3. **Keep the current-state sections current.** Update the file map, field descriptions, method responsibilities, decisions, unfinished-work list, and verification whenever affected. Keep TEAM_GUIDE.md aligned when imports, supported examples, helpers, settings, or usage steps change. A changelog entry alone is not enough.
4. **Separate fact, intention, and assumption.** Label implemented behavior, abstract contracts, proposed rules, and example values explicitly. Do not turn a proposed value into a team requirement without confirmation.
5. **Explain purpose in comments.** Document what each new/changed type, field, class, or method is responsible for. Include units, meaningful defaults, validation responsibilities, and important side effects where relevant. Mark future behavior as future; comments must not claim it already works.
6. **Maintain README pointers.** Keep a read-this-README comment in every paintball source/test file, including shared files modified for paintball. Use a correct relative path or an explicitly repository-root-relative path. Update pointers and this file map when moving files. This does not require adding paintball notices to unrelated project files.
7. **Verify honestly.** Run the relevant focused tests and lint for changes. Run backend typecheck/broader tests when behavior or shared contracts change. Record exact commands, working directory, date, scope, and actual pass/fail/blocker results. Say when a check was not rerun; never invent output or present historical results as a fresh run.
8. **Preserve scope and existing work.** Do not overwrite unrelated edits, rewrite shared declarations outside the paintball scope, rename case-sensitive paths casually, or repair dependency/Twilio issues without the appropriate scope. Never put credentials or session tokens in this README.
9. **Append a concise history entry.** Use the template below, retain useful prior entries, and update the last-updated date. Correct stale current-state claims rather than keeping contradictory descriptions in place.
10. **Completion means evidence.** Before marking work finished, compare the README to the diff, ensure paths/pointers resolve, and confirm the documented checks reflect what actually ran. A working constructor is not a working game.

### Change-history template

```text
### YYYY-MM-DD — Short description
- Changed: exact repository-relative files and what changed.
- Behavior: what now works; explicitly say if behavior did not change.
- Decisions: confirmed rules, or clearly labeled assumptions/examples.
- Verification: commands + working directory + real result, or not run and why.
- Remaining/blockers: unfinished work and unresolved errors.
```

## Change history

### 2026-10-24 — Imports, shared state, and constructor foundation

- Changed: added paintball types in `shared/types/CoveyTownSocket.d.ts`; populated the existing `townService/src/town/games/PaintBall/PaintBallGame.ts` and `townService/src/town/games/PaintBall/PaintballGame.test.ts` starter files.
- Behavior: an abstract match foundation initializes empty waiting state. A test-only subclass exercises it. No playable rules or integration were added.
- Decisions: `120` seconds is an example; starting ammo, spawns, and match rules remain undecided.
- Verification: focused test and targeted lint passed; backend typecheck and broader suite encountered the untouched Twilio/TestUtils blockers described above.
- Remaining: gameplay rules, networking, UI/map wiring, and broader project check blockers.

### 2026-10-24 — Human/AI handoff and purpose-focused comments

- Changed: created this README and its update rules; added README pointers in the three source/test files listed above; clarified field, constructor, abstract method, and test-fixture comments.
- Behavior: no gameplay behavior changed.
- Decisions: documented actual implementation separately from proposed gameplay and examples.
- Verification: focused Jest test and targeted ESLint rerun passed from `townService`; backend `npx tsc --noEmit -p .` rerun reported the same untouched-file blockers. Broader suite was not rerun for this documentation-only pass.
- Remaining: unchanged from the not-implemented list above.

### 2026-10-25 — Shared foundation and missing example-export fix

- Changed: earlier local work added shared contract types, `shared/paintball/setup.json`, backend factories in `PaintballSetup.ts`, and `PaintballSetup.test.ts`; the constructor now uses the shared-state factory. This fix added the real typed `createPaintballExample('lobby')` implementation and updated the current README sections.
- Behavior: the lobby fixture contains a balanced fictional roster. Both reported TypeScript errors disappear because the imported helper exists and returns `PaintballGameState`; the `player` callback type is inferred correctly.
- Decisions: defaults follow the saved task guide; sample ammo/coordinates are not gameplay settings. Only the lobby example is implemented; no live networking or gameplay was added.
- Verification: reproduced failure, then focused Jest passed (2 suites / 3 tests), targeted ESLint passed, backend typecheck and full suite rerun exposed the existing Twilio/TestUtils blockers described above.
- Remaining: other phase examples, frontend example wrapper, team contract review, lifecycle prototype, and full-game integration. Not deployed in this task.

### 2026-10-25 — Plain-language teammate usage guide

- Changed: added `townService/src/town/games/PaintBall/TEAM_GUIDE.md` and linked it here; updated the file map and maintenance rule to keep both documents aligned.
- Behavior: documentation only; no application source, settings, or gameplay behavior changed.
- Coverage: explains every current helper, shared fields/types and settings, backend versus frontend import boundaries, draft commands, the abstract class, test instructions, saved sprint ownership, and what remains unimplemented.
- Verification: ran the guide's exact focused Jest command from `townService` (2 suites / 3 tests passed). Extracted the backend quick-start example, resolved its imports to the actual source for a scratch run, and executed it with the installed tsx CLI; assertions on its match/player/lobby/request values passed. `git diff --check` passed. Broader typecheck/full suites were not rerun for this documentation-only task; earlier blockers remain recorded above.
- Remaining: unchanged feature backlog. No new deployment or GitHub push was performed.
