# Core Feedback and Display Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make corrosion and conduction activations visible and prevent floating-point artifacts in level-up text.

**Architecture:** Reuse the existing core proc and field state. Add only scene-owned Phaser graphics synchronized by corrosion field IDs, plus one pure UI number formatter.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright.

## Global Constraints

- Do not change core gameplay chances, damage, counters, radius, or targeting.
- Keep tunable visual values in `GAME_TUNING`.
- Run browser automation only after unit behavior is green.

---

### Task 1: Stable display numbers

**Files:**
- Create: `src/game/ui/displayNumber.ts`
- Create: `src/game/ui/displayNumber.test.ts`
- Modify: `src/game/ui/LevelUpOverlay.ts`
- Modify: `src/game/ui/LevelUpOverlay.test.ts`

**Interfaces:**
- Produces: `formatDisplayNumber(value: number, maximumFractionDigits?: number): string`

- [ ] Write tests proving `456.00000000000006` renders as `456`, `0.30000000000000004` as `0.3`, and invalid values throw.
- [ ] Run the focused tests and confirm failure because the formatter does not exist.
- [ ] Implement rounding through `toFixed`, remove trailing zeroes, and use it for firepower and speed text.
- [ ] Run focused tests and commit.

### Task 2: Core feedback graphics

**Files:**
- Modify: `src/game/config/gameTuning.ts`
- Modify: `src/game/config/gameTuning.test.ts`
- Modify: `src/game/scenes/CombatScene.ts`
- Modify: `e2e/combat.spec.ts`

**Interfaces:**
- Corrosion graphics are named `core-feedback-corrosion`.
- Conduction graphics are named `core-feedback-conduction`.

- [ ] Add a focused E2E test expecting both named feedback objects to appear and expire.
- [ ] Run it and confirm failure because no named feedback exists.
- [ ] Add centralized alpha/duration tuning.
- [ ] Keep a `Map<fieldId, Phaser.GameObjects.Graphics>` synchronized with corrosion state.
- [ ] Draw a tick pulse and conduction double-ring pulse.
- [ ] Add DEV hooks used by the focused E2E test through the same drawing methods.
- [ ] Run focused unit tests, build, and focused E2E; then commit.

### Task 3: Integration verification

**Files:**
- Modify only if verification reveals a defect.

- [ ] Run all unit tests.
- [ ] Run the production build.
- [ ] Run the complete desktop/mobile E2E suite once.
- [ ] Confirm a clean working tree and review the final diff.
