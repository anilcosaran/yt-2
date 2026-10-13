# Library (Kütüphane)

The former "Assets / Varlıklar" screen, redesigned as a library with **smart collections**. UI and flows only: the
data is mock state (`library-seed.ts`) kept in memory by `library-store.ts` (zustand). It survives client
navigation and resets on a full reload. The old screen stays at `/storage/legacy` for comparison; `/storage`
redirects here.

## Routes (`/library?…`)

| URL | View |
| --- | --- |
| `/library` · `?type=video\|image\|audio\|avatar\|motion\|template\|text` | All items (the landing view) / one type, picked with the type chips above the grid: grid or list, filters, sort, multi-select + bulk actions. A small "n onay bekliyor" pill next to the chips opens the review panel. |
| `?view=recent` | Recent generations: uniform square grid (3–4 per row), prompt and save / ⋯ on hover, save all, auto-save and auto-filing in the settings menu |
| `?collection=<id>` | Collection: cover, name, one meta line, the AI note, one "Ekle" menu (from library / upload) and ⋯; tabs *Items · Settings*. Settings shows general, smart mode and status; intake, analysis, usage and quality rules sit under a collapsed *Gelişmiş ayarlar*. |
| `&review=suggestions\|consent\|failed\|duplicates` | Review side panel (collection suggestions, consent, analysis errors, duplicates) |
| `&asset=<id>` | Centered preview (`library-asset-sheet.tsx`): media, Spark / download, Memory switch (`memory`), AI tools (links to `/tools?tool=…`), collections, AI analysis with editable tags, notes added one per line (`notes`). ←/→ moves between items. |
| `&new=1` | New collection: name + smart switch (+ optional description for AI) |

The contextual sidebar (`library-sidebar-nav.tsx`, wired into `components/layout/app-sidebar.tsx`) lists All items,
Recent generations and the collections (icon, name, item count; no status or smart markers); the rail item
"Kütüphane" points here.

There is one kind of collection. **Smart** is a switch on it (`LibraryCollection.smart`): turning it on analyses its
items, proposes matching library items for approval and enables the AI rules below; turning it off makes it a plain
folder and keeps the settings for later.

## Smart collection model

A collection has four groups of settings (`CollectionSettings` in `library-types.ts`, form in
`library-settings-fields.tsx`, shared by the wizard and the Rules tab):

- **Intake** — manual / AI matching / rules (`tag|name|kind|source|duration` conditions, all/any), accepted types,
  auto-add vs. ask for approval, include AI generations. Shows how many library items match right now.
- **Automatic analysis** — scope (everything / images only / selected types / off), depth (quick / detailed),
  features (tags, description, transcript, OCR, colours, quality, people, brand fit), re-analyse on edit, monthly
  credit budget and what happens when it runs out, cost estimate, "analyse existing items now".
- **AI use & frequency** — on/off, which surfaces (Spark, Flow, Assistant), max uses per item, reuse interval
  (cooldown), once per project, weekly cap, selection priority (least used / newest / best quality / random),
  what happens at the limit, only use analysed items. Shows the live impact on availability.
- **Quality & permissions** — min resolution, duration range, skip low quality, duplicates (merge/warn/ignore),
  consent for people, licence required, collection end date.

`getAvailability()` in `library-logic.ts` turns these rules into one state per item and collection:
available · cooling down (n days) · limit reached · needs consent · low quality · no licence · duplicate ·
awaiting analysis · hidden from AI · expired. Cards, filters, the usage log and the "What AI sees" selection
preview all use it, so changing a rule immediately changes what AI would pick.

## Edge cases covered in the UI

- Item in several collections → per-collection limit and status in the detail sheet.
- Analysis off while AI may use the collection, or "only analysed items" on with analysis off → warnings.
- Lowering the max-uses limit below current usage → "n items reach the limit now".
- Weekly cap higher than available items, no surface selected, no accepted type → warnings.
- Accepted types narrowed while other types are already inside → they stay, new ones are not added.
- Wrong matches → approval mode + review panel with confidence and reason; bulk approve. Turning smart on for the first time always asks before adding.
- People without consent, failed analysis, duplicates → Review tabs with the fitting actions.
- Paused (AI does not use it), frozen (no new items), archived, expiring/expired collections → banners.
- Deleting a collection keeps its items (optionally deletes the ones only in it); deleting a used item warns.
- Unsaved generations expire after the retention period → countdown, save all, auto-save and auto-filing toggles.
- Uploads → simulated progress, analysis and routing into matching smart collections (or their review queue).
