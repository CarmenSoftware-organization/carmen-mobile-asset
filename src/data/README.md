# data/

Persistence, networking, and sync. Owns SQLite repositories, the typed `CarmenApi`
interface and its mock/http implementations, the mutation queue, and the sync worker.
May depend on `platform/`. Must NOT import from `features/` or `ui/`.
