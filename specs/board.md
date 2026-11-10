# Ticket board

Both labs read this file.

- **status:** `draft`, `ready`, or `done`. Only `ready` tickets are dispatched.
- **mode:** `solo` or `team`. Solo means one worker does the ticket. Team means that worker may split the ticket across subagents. The example tickets are solo so the two labs start from the same work.
- **runs alongside:** a hint. These tickets touch different modules and may overlap. It does not block anything.
- **waits for:** a hard dependency. The runner starts the ticket only after those ids have finished with a passing worker and a passing `npm test`.

`src/app.ts` is the shared wiring file. Parallel tickets will both edit it. That conflict is the merger's job.

| id | title | status | mode | runs alongside | waits for |
| --- | --- | --- | --- | --- | --- |
| 001-search | Search recipes | ready | solo | 002-favorites, 003-tags, 005-input-validation | - |
| 002-favorites | Favorite a recipe | ready | solo | 001-search, 003-tags, 005-input-validation | - |
| 003-tags | Tag recipes | ready | solo | 001-search, 002-favorites, 005-input-validation | - |
| 004-pagination | Paginate recipe lists | ready | solo | - | 001-search |
| 005-input-validation | Validate recipe input | ready | solo | 001-search, 002-favorites, 003-tags | - |
