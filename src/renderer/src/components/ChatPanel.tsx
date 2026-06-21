import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type {
  ChatEvent,
  ChatMessage,
  ChatToolCall,
  ChatTurnResult,
  ReasoningEffort,
  StudioProject
} from '@shared/ipc'
import type { PendingShot } from './PreviewPane'
import Markdown from './Markdown'
import logo from '../assets/logo.png'

export interface UIChatMessage extends ChatMessage {
  /** Correlates streamed events to the active assistant bubble (live only). */
  turnId?: string
  /** True while the assistant turn is still streaming. */
  pending: boolean
  /** Transient status note (e.g. a transient-failure retry); not persisted. */
  notice?: string
}

interface Props {
  project: StudioProject
  messages: UIChatMessage[]
  onChange: (updater: (prev: UIChatMessage[]) => UIChatMessage[]) => void
  /** Called after a turn completes (used later to trigger deploy/preview refresh). */
  onTurnComplete?: (result: ChatTurnResult) => void
  /** Region screenshots staged for the next message. */
  attachments?: PendingShot[]
  /** Remove a staged screenshot (also deletes its temp file). */
  onRemoveAttachment?: (path: string) => void
  /** Called once staged screenshots have been sent so the parent can clear them. */
  onAttachmentsConsumed?: () => void
  /** Called when the user starts a new chat (parent clears persisted history). */
  onClearHistory?: () => void
  /** Called after the model / effort options change (parent refreshes project). */
  onOptionsChanged?: () => void
  /** True when chat is expanded to fill the build view (preview hidden). */
  focused?: boolean
  /** Toggle chat focus (full-width chat ⇄ split with preview). */
  onToggleFocus?: () => void
}

/** Suggested Copilot models (free-text still allowed via the datalist input). */
const MODEL_SUGGESTIONS = ['claude-sonnet-4.5', 'gpt-5.4', 'gpt-5-mini', 'gpt-4.1', 'o4-mini']

const EFFORT_OPTIONS: ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']

/** Starter prompts shown on the empty state; clicking one prefills the composer. */
const SUGGESTIONS = [
  'Add a new page that lists items from a table',
  'Create a form to add and save a record',
  'Improve the layout and color theme',
  'Add a chart that summarizes the data'
]

function UserIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

function SendIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  )
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function reduce(msg: UIChatMessage, ev: ChatEvent): UIChatMessage {
  switch (ev.type) {
    case 'delta':
      return { ...msg, text: msg.text + ev.text, notice: undefined }
    case 'tool-start':
      if (msg.tools.some((t) => t.id === ev.tool.id)) return msg
      return { ...msg, tools: [...msg.tools, ev.tool], notice: undefined }
    case 'tool-end':
      return {
        ...msg,
        tools: msg.tools.map((t) =>
          t.id === ev.id ? { ...t, state: ev.state, output: ev.output ?? t.output } : t
        )
      }
    case 'notice':
      return { ...msg, notice: ev.text }
    case 'error':
      return { ...msg, error: ev.text, pending: false, notice: undefined }
    case 'result':
      return { ...msg, pending: false, notice: undefined }
    default:
      return msg
  }
}

const TOOL_ICON: Record<ChatToolCall['state'], string> = {
  running: '⏳',
  success: '✓',
  error: '✗'
}

export default function ChatPanel({
  project,
  messages,
  onChange,
  onTurnComplete,
  attachments,
  onRemoveAttachment,
  onAttachmentsConsumed,
  onClearHistory,
  onOptionsChanged,
  focused,
  onToggleFocus
}: Props): JSX.Element {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [model, setModel] = useState(project.model ?? '')
  const [effort, setEffort] = useState<ReasoningEffort | ''>(project.effort ?? '')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function saveOptions(nextModel: string, nextEffort: ReasoningEffort | ''): void {
    void window.api.chat.setOptions(project.id, {
      model: nextModel.trim() || undefined,
      effort: nextEffort || undefined
    })
    onOptionsChanged?.()
  }

  useEffect(() => {
    const off = window.api.onChatEvent((envelope) => {
      if (envelope.projectId !== project.id) return
      onChangeRef.current((prev) =>
        prev.map((m) =>
          m.turnId === envelope.turnId && m.role === 'assistant' ? reduce(m, envelope.event) : m
        )
      )
    })
    return off
  }, [project.id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Auto-grow the composer textarea with its content (capped).
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  async function send(): Promise<void> {
    const text = input.trim()
    const shots = attachments ?? []
    if ((!text && shots.length === 0) || sending) return
    const prompt = text || 'Here is a screenshot of the current preview — please take a look.'
    setInput('')
    onAttachmentsConsumed?.()
    await dispatch(text || '(screenshot)', prompt, shots)
  }

  /** Append a fresh turn and stream its result. Shared by send + retry. */
  async function dispatch(
    displayText: string,
    prompt: string,
    shots: PendingShot[]
  ): Promise<void> {
    if (sending) return
    const turnId = uid()
    const userMsg: UIChatMessage = {
      id: uid(),
      role: 'user',
      text: displayText,
      tools: [],
      pending: false,
      attachments: shots.length || undefined
    }
    const assistantMsg: UIChatMessage = {
      id: uid(),
      turnId,
      role: 'assistant',
      text: '',
      tools: [],
      pending: true
    }
    onChange((prev) => [...prev, userMsg, assistantMsg])
    setSending(true)
    try {
      const result = await window.api.chat.send(
        project.id,
        turnId,
        prompt,
        shots.map((s) => s.path)
      )
      onChange((prev) => prev.map((m) => (m.turnId === turnId ? { ...m, pending: false } : m)))
      onTurnComplete?.(result)
    } finally {
      setSending(false)
    }
  }

  /** Re-send the user prompt that produced a failed assistant turn. */
  async function retry(assistantId: string): Promise<void> {
    if (sending) return
    const idx = messages.findIndex((m) => m.id === assistantId)
    if (idx <= 0) return
    const user = messages[idx - 1]
    if (!user || user.role !== 'user' || user.text === '(screenshot)') return
    await dispatch(user.text, user.text, [])
  }

  async function stop(): Promise<void> {
    await window.api.chat.cancel(project.id)
  }

  async function newChat(): Promise<void> {
    await window.api.chat.reset(project.id)
    onChange(() => [])
    onClearHistory?.()
  }

  function applySuggestion(text: string): void {
    setInput(text)
    taRef.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="chat">
      <div className="chat-toolbar">
        <span className="chat-toolbar-title">Chat</span>
        <span className="chat-toolbar-spacer" />
        <input
          className="chat-model"
          list="copilot-models"
          value={model}
          placeholder="Model: auto"
          title="Copilot model (blank = auto)"
          spellCheck={false}
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => saveOptions(model, effort)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <datalist id="copilot-models">
          {MODEL_SUGGESTIONS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <select
          className="chat-effort"
          value={effort}
          title="Reasoning effort"
          onChange={(e) => {
            const next = e.target.value as ReasoningEffort | ''
            setEffort(next)
            saveOptions(model, next)
          }}
        >
          <option value="">Effort: auto</option>
          {EFFORT_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button
          className="btn btn--xs btn--ghost"
          onClick={newChat}
          disabled={sending || messages.length === 0}
          title="Start a new conversation"
        >
          + New chat
        </button>
        {onToggleFocus && (
          <button
            className={`btn btn--xs ${focused ? 'btn--primary' : 'btn--ghost'}`}
            onClick={onToggleFocus}
            title={focused ? 'Exit focus — show the preview again' : 'Focus the chat — hide the preview'}
          >
            {focused ? '⤡' : '⤢'}
          </button>
        )}
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-welcome">
            <img className="chat-welcome-mark" src={logo} alt="" />
            <h2>Build {project.name}</h2>
            <p>
              Ask Copilot to add features or fix issues. It edits the code and Studio deploys with
              <code> rayfin up</code> — then the live app loads in the preview.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat-suggestion" onClick={() => applySuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const prevUser = m.role === 'assistant' && i > 0 ? messages[i - 1] : undefined
          const canRetry =
            Boolean(m.error) &&
            !sending &&
            prevUser?.role === 'user' &&
            !prevUser.attachments &&
            prevUser.text !== '(screenshot)'
          return (
            <div key={m.id} className={`turn turn--${m.role}`}>
              <div className={`turn-avatar${m.pending ? ' turn-avatar--pending' : ''}`}>
                {m.role === 'user' ? <UserIcon /> : <img src={logo} alt="" />}
              </div>
              <div className="turn-main">
                <div className="turn-role">{m.role === 'user' ? 'You' : 'Copilot'}</div>
                {m.tools.length > 0 && (
                  <div className="tool-activity">
                    {m.tools.map((t) => (
                      <details key={t.id} className={`tool-call tool-call--${t.state}`}>
                        <summary>
                          <span className="tool-call-icon">{TOOL_ICON[t.state]}</span>
                          <span className="tool-call-name">{t.name}</span>
                          <span className="tool-call-title">{t.title}</span>
                        </summary>
                        {t.output && <pre className="tool-call-output">{t.output}</pre>}
                      </details>
                    ))}
                  </div>
                )}
                {m.text &&
                  (m.role === 'assistant' ? (
                    <div className="msg-text msg-text--md">
                      <Markdown>{m.text}</Markdown>
                    </div>
                  ) : (
                    <div className="msg-text">{m.text}</div>
                  ))}
                {m.attachments ? (
                  <div className="msg-attach">
                    ⛶ {m.attachments} screenshot{m.attachments > 1 ? 's' : ''} attached
                  </div>
                ) : null}
                {m.notice && <div className="msg-notice">↻ {m.notice}</div>}
                {m.pending && !m.text && m.tools.length === 0 && (
                  <div className="msg-typing" aria-label="Thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                {m.error && (
                  <div className="alert alert--error msg-error">
                    <span className="msg-error-text">{m.error}</span>
                    {canRetry && (
                      <button
                        className="btn btn--xs btn--ghost msg-error-retry"
                        onClick={() => void retry(m.id)}
                        title="Re-send this message"
                      >
                        ↻ Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="composer">
        {(attachments?.length ?? 0) > 0 && (
          <div className="chat-attachments">
            {attachments!.map((a) => (
              <div key={a.path} className="chat-attachment" title="Screenshot to send">
                <img src={a.thumb} alt="screenshot" />
                <button
                  className="chat-attachment-x"
                  onClick={() => onRemoveAttachment?.(a.path)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="composer-box">
          <textarea
            ref={taRef}
            className="composer-input"
            placeholder={`Message Copilot about ${project.name}…`}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-actions">
            <span className="composer-hint">Enter to send · Shift+Enter for newline</span>
            {sending ? (
              <button className="btn btn--sm btn--ghost composer-stop" onClick={stop}>
                ■ Stop
              </button>
            ) : (
              <button
                className="composer-send"
                onClick={send}
                disabled={!input.trim() && (attachments?.length ?? 0) === 0}
                title="Send (Enter)"
              >
                <SendIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
