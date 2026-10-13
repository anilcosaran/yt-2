# UI font licenses

The UI typefaces are self-hosted through `next/font/local` so that `next build` never downloads
fonts from Google Fonts. Each file is the variable font Google Fonts serves, taken from the Google
Fonts repository at commit `23e54b51ddffbc7713c583748e3bd86f62b1fa4a` and reduced to the Google
Fonts `latin` + `latin-ext` subsets (English and Turkish, including ğ ş ı İ ö ü ç).

| Family | Bundled file | Upstream file | Axes kept | Used by | License |
| --- | --- | --- | --- | --- | --- |
| Inter 4.001 | `Inter-Variable.woff2` | `ofl/inter/Inter[opsz,wght].ttf` | `wght` 100–900 (`opsz` pinned to its default 14) | `app/layout.tsx` (`--font-inter`) | SIL Open Font License 1.1, `Inter-OFL.txt` |
| Space Grotesk 2.000 | `SpaceGrotesk-Variable.woff2` | `ofl/spacegrotesk/SpaceGrotesk[wght].ttf` | `wght` 300–700 (declared 500–700) | `app/layout.tsx` (`--font-space-grotesk`) | SIL Open Font License 1.1, `SpaceGrotesk-OFL.txt` |
| Instrument Sans 1.000 | `InstrumentSans-Variable.woff2` | `ofl/instrumentsans/InstrumentSans[wdth,wght].ttf` | `wght` 400–700 (declared 400–600; `wdth` pinned to its default 100) | `components/spark/spark-editor-shell.tsx` (`--font-instrument-sans`) | SIL Open Font License 1.1, `InstrumentSans-OFL.txt` |

The files were produced with fontTools 4.64: `fontTools.varLib.instancer` pins the axes listed above
(what Google Fonts serves when only `wght` is requested), then `fontTools.subset` keeps the code points
`U+0000-00FF, U+0100-02BA, U+02BB-02BC, U+02BD-02C5, U+02C6, U+02C7-02CC, U+02CE-02D7, U+02DA, U+02DC,
U+02DD-02FF, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1D00-1DBF, U+1E00-1E9F,
U+1EF2-1EFF, U+2000-206F, U+20A0-20AB, U+20AC, U+20AD-20C0, U+2113, U+2122, U+2191, U+2193, U+2212,
U+2215, U+2C60-2C7F, U+A720-A7FF, U+FEFF, U+FFFD` with the default layout features plus `tnum` and
`pnum`, all `name` records, and WOFF2 output. Glyph outlines and advances match the Google Fonts
`latin` and `latin-ext` files at every weight the UI uses.

The fonts may be used, embedded, modified, and redistributed under the OFL terms. The font files must
not be sold by themselves, and redistributed font files must keep their copyright and license notices.
