# fonts

Self-hosted variable webfonts used across the Testify design system.

- **Geist** (display + body) — variable font, weights 100–900. Licensed under SIL OFL 1.1. Source: https://vercel.com/font
- **JetBrains Mono** (code) — variable font, weights 100–800. Licensed under SIL OFL 1.1. Source: https://www.jetbrains.com/lp/mono/

## Files expected

- `Geist-Variable.woff2`
- `JetBrainsMono-Variable.woff2`

## ⚠️ Substitution note

Because this project was built with no source materials, **placeholder font references are used**. The `colors_and_type.css` `@font-face` blocks point at these filenames, but if they're missing the system falls back to `ui-sans-serif` / `ui-monospace` via the font-stack. The UI kits additionally load Geist and JetBrains Mono from **Google Fonts** as a safety net so previews render correctly:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

**Action for the user:** if you want fully self-hosted fonts, drop the two `.woff2` files into this folder and the `@font-face` rules will pick them up with no changes. Otherwise the Google Fonts CDN covers it.
