# yt-2

UI-only clone of the Youtorch web app (`youtorch-ui`) for designing a new look. Same components, styles, fonts,
i18n messages and `public/` assets; no API, Firebase or Stripe connection — all data is mock (see `mock/README.md`).

```bash
npm install
npm run dev        # http://localhost:3100
npm run typecheck
```

- Routes, components and `lib/*/api.ts` modules are unchanged, so screens behave like Youtorch.
- Tests, Dockerfile and CI files were not copied.
- The original `Youtorch` repo is only read from, never modified.
