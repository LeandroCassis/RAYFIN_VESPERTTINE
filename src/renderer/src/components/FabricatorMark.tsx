import vesperttineMark from '../assets/vesperttine-mark.png'

interface FabricatorMarkProps {
  /** Sizing/positioning class(es). Sizing lives in main.css (for example .brand-mark). */
  className?: string
  /** Accessible label; when omitted the mark is decorative. */
  title?: string
}

/**
 * VESPERTTINE's tiled staircase mark.  The source artwork is a high-resolution
 * transparent PNG so this same identity is used by the app shell, loading state,
 * deployment state and every in-product avatar without falling back to the old
 * Fabricator glyph.
 */
export function FabricatorMark({ className, title }: FabricatorMarkProps): JSX.Element {
  return (
    <img
      className={className ? `fab-mark ${className}` : 'fab-mark'}
      src={vesperttineMark}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  )
}

export default FabricatorMark
