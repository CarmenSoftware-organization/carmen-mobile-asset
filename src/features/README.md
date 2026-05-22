# features/

Per-domain modules — `auth/`, `asset/`, `count/`, `scan/`, `photo/`, `sync/`. Each owns its hooks, stores (Zustand), and feature-specific components.
May depend on `data/`. Must NOT import from `ui/`.
