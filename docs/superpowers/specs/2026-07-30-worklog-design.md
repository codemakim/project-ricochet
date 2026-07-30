# Project Worklog Design

## Goal

Create one durable project log that explains major historical decisions and records future work without adding a documentation system to maintain.

## File

`docs/WORKLOG.md`

## Structure

1. Purpose and recording rules.
2. Retrospective summary of major development transitions.
3. Formal dated entries beginning on 2026-07-30.

Each formal entry stays short and contains:

- work completed;
- decisions and reasons;
- verification performed;
- next likely work.

## Evidence

Historical entries use Git history plus existing design and playtest documents. They describe direction rather than inventing missing dates, measurements, or implementation details. Uncertain chronology is marked as retrospective.

## Maintenance

Add 5–10 lines after meaningful work batches. Do not duplicate commit-by-commit details, test output, or specifications already stored elsewhere.

## Out of Scope

- per-task worklog files;
- generated changelog tooling;
- ADR infrastructure;
- release notes for players.
