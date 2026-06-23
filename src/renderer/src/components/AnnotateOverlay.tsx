import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { useSuppressPreview } from '../overlay'
import type { PendingShot } from './PreviewPane'

/** A freehand stroke, stored in canvas-pixel coordinates so it survives redraws. */
interface Stroke {
  color: string
  /** Line width in canvas pixels (already scaled for the displayed zoom). */
  width: number
  points: { x: number; y: number }[]
}

/** A text label, anchored top-left in canvas pixels so it survives redraws. */
interface TextItem {
  x: number
  y: number
  text: string
  color: string
  /** Font size in canvas pixels. */
  size: number
}

/** A single annotation, kept in an ordered list so undo/redraw honour draw order. */
type Item = { kind: 'stroke'; stroke: Stroke } | { kind: 'text'; text: TextItem }

/** The active text editor: where it sits and the style its result will use. */
interface Editing {
  /** Editor position within the stage, in display pixels. */
  left: number
  top: number
  color: string
  /** Textarea font size (display pixels). */
  sizeDisplay: number
  /** Committed font size (canvas pixels). */
  sizeCanvas: number
  /** Text anchor in canvas pixels (top-left). */
  cx: number
  cy: number
}

type Tool = 'draw' | 'text'

/** Annotation pen colours (kept few — chips are clearer than a full picker). */
const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#1c1c1e']

/** Size presets, expressed in *displayed* pixels (scaled to canvas at draw time).
 *  `px` is the pen line width; the text tool maps these to font sizes. */
const WIDTHS: { id: string; label: string; px: number }[] = [
  { id: 's', label: 'S', px: 3 },
  { id: 'm', label: 'M', px: 6 },
  { id: 'l', label: 'L', px: 11 }
]

const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Display-px font size for each pen-width preset (reused by the text tool). */
function textSizeForWidth(px: number): number {
  return px <= 3 ? 18 : px <= 6 ? 28 : 40
}

interface Props {
  /** PNG `data:` URL of the frozen preview to annotate. */
  image: string
  /** Discard the annotation and return to the live preview. */
  onCancel: () => void
  /** Persist the composited PNG and stage it as a chat attachment. */
  onConfirm: (shot: PendingShot) => void
}

/**
 * Full-window overlay that lets the user draw and add text on a frozen
 * screenshot of the preview and stage the result as a chat attachment.
 *
 * The live preview is a native WebView2 child surface that paints above all HTML,
 * so we cannot annotate it in place. Instead the caller captures it to a PNG and
 * mounts this overlay, which {@link useSuppressPreview suppresses} (hides) the
 * native webview and renders the captured image into a `<canvas>` the user can
 * draw on. On confirm we composite image + annotations to a PNG, save it to a
 * temp file via `screenshot.save`, and hand the path back through
 * {@link Props.onConfirm}.
 */
export default function AnnotateOverlay({ image, onCancel, onConfirm }: Props): JSX.Element {
  // Hide the native preview webview while the overlay is up (it would paint over us).
  useSuppressPreview(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const itemsRef = useRef<Item[]>([])
  const drawingRef = useRef<Stroke | null>(null)

  const [tool, setTool] = useState<Tool>('draw')
  const [color, setColor] = useState(COLORS[0])
  const [widthPx, setWidthPx] = useState(WIDTHS[1].px)
  const [ready, setReady] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Active text editor + its current value, mirrored in a ref so commit()/confirm()
  // can read the latest without re-creating callbacks or hitting stale closures.
  const [editing, setEditing] = useState<Editing | null>(null)
  const [draft, setDraft] = useState('')
  const liveRef = useRef<{ editing: Editing | null; draft: string }>({ editing: null, draft: '' })
  liveRef.current = { editing, draft }

  // Repaint the whole canvas: base image, then every committed item, then any
  // in-flight stroke.
  const redraw = useCallback((): void => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const item of itemsRef.current) {
      if (item.kind === 'stroke') drawStroke(ctx, item.stroke)
      else drawText(ctx, item.text)
    }
    if (drawingRef.current) drawStroke(ctx, drawingRef.current)
  }, [])

  // Load the captured PNG, size the canvas to its natural resolution, paint it.
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
      }
      setReady(true)
      redraw()
    }
    img.src = image
  }, [image, redraw])

  // Keep the text editor focused as it opens / moves.
  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  // Esc cancels the overlay (mirrors the app's other dismissible surfaces), but
  // not while a text editor is open — there Esc cancels just the edit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (liveRef.current.editing) return
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  /** Map a pointer event to canvas-pixel coordinates (canvas is CSS-scaled to fit). */
  const toCanvasPoint = (e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  /** Open a text editor at the click point, committing any editor already open. */
  const openTextEditor = (e: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return
    const rect = canvas.getBoundingClientRect()
    const stageRect = stage.getBoundingClientRect()
    const scale = canvas.width / rect.width
    const sizeDisplay = textSizeForWidth(widthPx)
    const pt = toCanvasPoint(e)
    setEditing({
      left: e.clientX - stageRect.left,
      top: e.clientY - stageRect.top,
      color,
      sizeDisplay,
      sizeCanvas: sizeDisplay * scale,
      cx: pt.x,
      cy: pt.y
    })
    setDraft('')
  }

  /** Flush the open text editor onto the canvas (no-op when nothing is open). */
  const commitEditing = useCallback((): void => {
    const { editing, draft } = liveRef.current
    if (!editing) return
    liveRef.current = { editing: null, draft: '' }
    setEditing(null)
    setDraft('')
    const text = draft.replace(/\s+$/, '')
    if (text.trim().length > 0) {
      itemsRef.current = [
        ...itemsRef.current,
        {
          kind: 'text',
          text: { x: editing.cx, y: editing.cy, text, color: editing.color, size: editing.sizeCanvas }
        }
      ]
      setHasContent(true)
    }
    redraw()
  }, [redraw])

  /** Discard the open text editor without committing it. */
  const cancelEditing = useCallback((): void => {
    liveRef.current = { editing: null, draft: '' }
    setEditing(null)
    setDraft('')
    redraw()
  }, [redraw])

  const onEditorKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitEditing()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
    // Keep edits local — don't trip global shortcuts (Esc-to-close, etc.).
    e.stopPropagation()
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (!ready) return
    if (tool === 'text') {
      if (liveRef.current.editing) commitEditing()
      openTextEditor(e)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    const canvas = canvasRef.current!
    const scale = canvas.width / canvas.getBoundingClientRect().width
    drawingRef.current = {
      color,
      width: Math.max(1, widthPx * scale),
      points: [toCanvasPoint(e)]
    }
    redraw()
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>): void => {
    const stroke = drawingRef.current
    if (!stroke) return
    stroke.points.push(toCanvasPoint(e))
    redraw()
  }

  const finishStroke = (e: PointerEvent<HTMLCanvasElement>): void => {
    const stroke = drawingRef.current
    if (!stroke) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    drawingRef.current = null
    // A click without movement still leaves a visible dot.
    itemsRef.current = [...itemsRef.current, { kind: 'stroke', stroke }]
    setHasContent(true)
    redraw()
  }

  const undo = (): void => {
    itemsRef.current = itemsRef.current.slice(0, -1)
    setHasContent(itemsRef.current.length > 0)
    redraw()
  }

  const clear = (): void => {
    itemsRef.current = []
    drawingRef.current = null
    setHasContent(false)
    cancelEditing()
  }

  const confirm = useCallback(async (): Promise<void> => {
    const canvas = canvasRef.current
    if (!canvas || saving) return
    setSaving(true)
    setError(null)
    try {
      commitEditing()
      redraw()
      const dataUrl = canvas.toDataURL('image/png')
      const path = await window.api.screenshot.save(dataUrl)
      const thumb = makeThumb(canvas)
      onConfirm({ path, thumb })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }, [commitEditing, onConfirm, redraw, saving])

  return (
    <div className="annotate" role="dialog" aria-label="Annotate screenshot">
      <div className="annotate-toolbar">
        <span className="annotate-hint">
          Draw or add text on the screenshot, then attach it to your message.
        </span>
        <div className="annotate-tools">
          <div className="annotate-toolseg">
            <button
              className={`annotate-tool${tool === 'draw' ? ' is-active' : ''}`}
              onClick={() => setTool('draw')}
              title="Draw freehand"
            >
              Draw
            </button>
            <button
              className={`annotate-tool${tool === 'text' ? ' is-active' : ''}`}
              onClick={() => setTool('text')}
              title="Add text — click the image, then type"
            >
              Text
            </button>
          </div>
          <div className="annotate-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`annotate-swatch${c === color ? ' is-active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={`Colour ${c}`}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
          <div className="annotate-widths">
            {WIDTHS.map((w) => (
              <button
                key={w.id}
                className={`annotate-width${w.px === widthPx ? ' is-active' : ''}`}
                onClick={() => setWidthPx(w.px)}
                title={`${w.label} — pen & text size`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button className="btn btn--sm btn--ghost" onClick={undo} disabled={!hasContent}>
            Undo
          </button>
          <button className="btn btn--sm btn--ghost" onClick={clear} disabled={!hasContent}>
            Clear
          </button>
        </div>
        <div className="annotate-actions">
          {error && <span className="annotate-error">{error}</span>}
          <button className="btn btn--sm btn--ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn--sm btn--primary"
            onClick={() => void confirm()}
            disabled={saving}
          >
            {saving ? 'Attaching…' : 'Attach to chat'}
          </button>
        </div>
      </div>
      <div className="annotate-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className={`annotate-canvas${tool === 'text' ? ' annotate-canvas--text' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
        {editing && (
          <textarea
            ref={editRef}
            className="annotate-textedit"
            style={{
              left: `${editing.left}px`,
              top: `${editing.top}px`,
              color: editing.color,
              fontSize: `${editing.sizeDisplay}px`
            }}
            value={draft}
            rows={1}
            spellCheck={false}
            wrap="off"
            placeholder="Type…"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitEditing()}
            onKeyDown={onEditorKey}
          />
        )}
      </div>
    </div>
  )
}

/** Stroke the given path onto a 2D context. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points
  if (pts.length === 0) return
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = stroke.width
  if (pts.length === 1) {
    // A single tap → a dot.
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

/** Draw a (possibly multi-line) text label with a contrasting halo for legibility. */
function drawText(ctx: CanvasRenderingContext2D, t: TextItem): void {
  const lines = t.text.split('\n')
  const lineHeight = t.size * 1.2
  ctx.save()
  ctx.font = `600 ${t.size}px ${FONT_STACK}`
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, t.size * 0.16)
  ctx.strokeStyle = haloFor(t.color)
  ctx.fillStyle = t.color
  lines.forEach((line, i) => {
    if (!line.length) return
    const y = t.y + i * lineHeight
    ctx.strokeText(line, t.x, y)
    ctx.fillText(line, t.x, y)
  })
  ctx.restore()
}

/** Pick an outline tone opposite the text colour so it stays readable anywhere. */
function haloFor(color: string): string {
  return isLight(color) ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.85)'
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // Rec. 601 luma.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

/** Downscale the canvas to a small PNG data URL for the chat attachment chip. */
function makeThumb(canvas: HTMLCanvasElement): string {
  const maxW = 176
  const scale = Math.min(1, maxW / canvas.width)
  const tw = Math.max(1, Math.round(canvas.width * scale))
  const th = Math.max(1, Math.round(canvas.height * scale))
  const thumb = document.createElement('canvas')
  thumb.width = tw
  thumb.height = th
  const ctx = thumb.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')
  ctx.drawImage(canvas, 0, 0, tw, th)
  return thumb.toDataURL('image/png')
}
