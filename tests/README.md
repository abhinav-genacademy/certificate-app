Run `npm test` with Node.js 22.13 or newer.

The regression tests exercise CSV exports, generation button state across roster refreshes,
and certificate name corrections. Store tests execute the SQL against a temporary in-memory
SQLite database with PostgreSQL-compatible date/UUID functions and result conversions.
Chromium rendering is stubbed. No configured database, credentials, or external service is used.
