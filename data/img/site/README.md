# Site identity

The Chinese name is **峡谷天机**; the English name remains **Lineup Synergy**.
The browser title includes both names, with the active language first. Header,
startup text, footer, and the home page use the active-language name.

`favicon.svg` is the original vector source. Its five connected nodes represent
the five positions in a lineup; the highlighted center emphasizes their shared
interaction. The navy, cyan, white, and orange come from the site's existing
palette. The mark has no text or fine detail, so it remains legible at 16 pixels.
The header uses the SVG at 24 pixels; modern browsers use the SVG favicon and
other browsers can use the 64 × 64 PNG fallback, `favicon.png`.

To regenerate the PNG using an existing local installation of `sharp`:

```sh
node -e "require('sharp')('data/img/site/favicon.svg').resize(64,64).png().toFile('data/img/site/favicon.png')"
```

No external artwork or official game/team logo is used. The frontend versioning
script includes the icon bytes in its release hash and versions the favicon links.
The header logo uses the same query parameter as its importing module, so a new
release can replace cached icons consistently.
