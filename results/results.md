# Results

Copy numbers from a `timings.json` you actually produced, or from a clock you started yourself. Leave a cell blank when you did not measure it. Do not fill a cell to make the table look finished.

`npm run metrics -- --timings runs/<stamp>/timings.json` prints what the file contains. It does not write this table. Human interventions and "planted bug found" are always "not measured" in that printout, because the scripts do not know them.

| run | setup | ticket | wall clock | p50 | slowest | human interventions | delegations | tests passing | eval pass first try | token usage | cost usd | planted bug found |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |

Setup A can fill one row per ticket because each worker is its own process. Setup B is one session: fill the session wall clock on a single row and leave the other ticket rows blank unless you timed them by hand.

p50 is the nearest-rank 50th percentile of the ticket wall clocks in that run. The slowest cell is the max, not a guess.

Token usage and cost come only from the Claude Code result event (`usage`, `total_cost_usd`). If the event has no such field, leave the cell blank.

Score "planted bug found" only after you read the checker's findings. The answer key is `.planted-bug.md`. Open it after you score, not before.
