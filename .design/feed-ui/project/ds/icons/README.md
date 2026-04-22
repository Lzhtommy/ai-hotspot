# icons

Testify uses **Lucide** (https://lucide.dev) as its icon system.

- Stroke: 1.5px (Lucide default)
- Grid: 24×24
- License: ISC
- Loaded either from CDN or from local SVGs in this folder.

## Usage

**JSX (preferred):** import SVG as a React component, or inline paste the contents:

```jsx
import sendIcon from './assets/icons/send.svg';
<img src={sendIcon} width="16" height="16" alt="" />;
```

**HTML:** load the Lucide CDN runtime and use `<i data-lucide="send">`:

```html
<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js"></script>
<i data-lucide="send"></i>
<script>
  lucide.createIcons();
</script>
```

## Size guidelines

| Context                     | Size    |
| --------------------------- | ------- |
| Dense tables, inline chips  | 14px    |
| Buttons, inputs, nav        | 16px    |
| Large nav / sidebar rail    | 20px    |
| Empty states, hero callouts | 24–32px |

Icons inherit `currentColor`; never paint them with a fill.

## Local files

A core subset is checked in so the system works offline. Names match Lucide's.

- Navigation: `home`, `search`, `settings`, `inbox`, `bell`, `user`, `users`, `menu`, `more-horizontal`
- Actions: `plus`, `check`, `x`, `copy`, `download`, `upload`, `trash`, `edit`, `link`, `external-link`, `send`, `filter`
- Chevrons: `chevron-down`, `chevron-right`, `chevron-left`, `arrow-right`, `arrow-up-right`
- Testify domain: `message-square-quote`, `video`, `star`, `image`, `code`, `eye`, `sparkles`, `layout-grid`, `share-2`

If a name isn't here, fetch it from https://lucide.dev/icons and drop the SVG in.
