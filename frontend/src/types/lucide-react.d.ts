/**
 * Local lucide-react path import typings.
 *
 * Some legacy components import icons via deep paths such as
 * `lucide-react/dist/esm/icons/menu`. The official package only ships types
 * for the package entry points, so we provide a thin wrapper here that maps
 * every deep import to the canonical `LucideIcon` React component type.
 */
declare module 'lucide-react/dist/esm/icons/*' {
  import type { LucideIcon } from 'lucide-react';
  const Icon: LucideIcon;
  export default Icon;
}
