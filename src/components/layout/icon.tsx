/**
 * Typed icon renderer — Phase 4 FEED-03, D-06.
 *
 * Renders icons from /icons/{name}.svg (public/ static assets) as <img> tags.
 * Only the 21-icon allowlist from the Phase 4 plan is accepted; the TypeScript
 * union type enforces this at compile time so typos fail the build.
 *
 * Consumed by:
 *   - src/components/layout/button.tsx
 *   - src/components/layout/icon-button.tsx
 *   - src/components/feed/feed-card.tsx (and most feed components)
 */

export type IconName =
  | 'sparkles'
  | 'inbox'
  | 'arrow-up-right'
  | 'star'
  | 'globe'
  | 'send'
  | 'filter'
  | 'users'
  | 'settings'
  | 'search'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'external-link'
  | 'more-horizontal'
  | 'check'
  | 'x'
  | 'download'
  | 'loader'
  | 'alert-circle'
  | 'tag'
  // Phase 5 additions (Plan 05-05) — UserChip authenticated branch
  | 'log-out'
  | 'user';

interface IconProps {
  name: IconName;
  /** Pixel size — applied to both width and height. Default: 16 */
  size?: number;
  className?: string;
  /** When false, renders aria-hidden="true". Default: true (decorative) */
  decorative?: boolean;
}

/**
 * Renders a single Lucide-compatible icon from /icons/{name}.svg.
 * Decorative by default (aria-hidden="true"). Pass decorative={false} when the icon
 * carries semantic meaning and no adjacent text label is present.
 */
export function Icon({ name, size = 16, className, decorative = true }: IconProps) {
  return (
    <img
      src={`/icons/${name}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden={decorative ? 'true' : undefined}
      className={[
        'inline-block align-middle',
        // icon-invert preserved for future dark-mode per D-06 (unused in Phase 4)
        'icon-invert',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
