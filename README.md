# CROSSROADS — Foundation 2B.4

## Changes

- Audited `INITIAL_UNITS`.
- Confirmed it had no runtime references.
- Removed the dead legacy force array.
- Added a stronger startup diagnostic containing:
  - build version
  - external data count
  - active scenario
  - runtime/rendered unit counts
  - deployment/phase state
  - zoom state
- Exposed the same information as:
  - `window.CROSSROADS_STARTUP_DIAGNOSTIC`

## Upload

Extract this ZIP and upload every file to the repository root.

Do not test until the visible badge says:

`Foundation 2B.4`

A healthy startup diagnostic should resemble:

`Foundation 2B.4 · data 4/4 · take_the_crossroads · 8/8 units · deploy · FIT`
