# CROSSROADS — Foundation 2C.2

## First command-model adoption

The existing `makeCommand()` vocabulary is now used by one deliberately
low-risk action: the mobile **Details** button.

This pass adds:

- `addTrayCommand(command)`
- `mobileDetailsCommand()`
- command metadata for label, enabled state, handler, reason, and CSS class
- `CMD OK` / `CMD MISS` in the startup diagnostic

Migrated Details button occurrences: 7

Everything else still uses the established action path:

- Draw Die
- deployment
- Run / Advance / Fire
- Down / Rally / Ambush / Assault
- movement confirmation
- targeting and reactions
- round flow

No gameplay rule or order behavior was intentionally changed.

Upload every file to the repository root and wait until the visible badge says
`Foundation 2C.2`. A healthy diagnostic includes both `DOM OK` and `CMD OK`.
