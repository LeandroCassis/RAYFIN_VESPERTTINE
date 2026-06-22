import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdvisorFinding, AdvisorReport, StudioProject } from '@shared/ipc'

interface Props {
  project: StudioProject
  /** Hand a finding to the Build chat so Copilot can fix it. */
  onFix: (finding: AdvisorFinding) => void
}

interface FindingGroup {
  key: string
  title: string
  blurb: string
  findings: AdvisorFinding[]
}

/** Display order + copy for each check category. */
const CATEGORIES: { key: string; title: string; blurb: string }[] = [
  {
    key: 'auth',
    title: 'Authentication & access',
    blurb: 'Routes and data that can be reached without signing in.'
  },
  {
    key: 'policy',
    title: 'Data policies',
    blurb: 'Database access that is broader than it should be.'
  }
]

function sevRank(severity: string): number {
  switch (severity.toLowerCase()) {
    case 'high':
      return 0
    case 'medium':
    case 'med':
      return 1
    case 'low':
      return 2
    default:
      return 3
  }
}

/** Map a severity to its CSS modifier (`high` | `med` | `low`). */
function sevClass(severity: string): string {
  const s = severity.toLowerCase()
  if (s === 'high') return 'high'
  if (s === 'low') return 'low'
  return 'med'
}

function sevLabel(severity: string): string {
  const s = severity.toLowerCase()
  if (s === 'high') return 'High'
  if (s === 'low') return 'Low'
  if (s === 'medium' || s === 'med') return 'Medium'
  return severity ? severity[0].toUpperCase() + severity.slice(1) : 'Info'
}

/** Bucket findings into display groups by category, sorted by severity. */
function groupFindings(findings: AdvisorFinding[]): FindingGroup[] {
  const groups: FindingGroup[] = []
  const seen = new Set<string>()

  for (const cat of CATEGORIES) {
    const matched = findings.filter((f) => (f.category || 'other') === cat.key)
    if (matched.length) {
      seen.add(cat.key)
      groups.push({ ...cat, findings: matched })
    }
  }

  // Any categories the model invented beyond our known set.
  const extras = findings.filter((f) => !seen.has(f.category || 'other'))
  if (extras.length) {
    groups.push({ key: 'other', title: 'Other', blurb: 'Additional findings.', findings: extras })
  }

  for (const g of groups) {
    g.findings.sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
  }
  return groups
}

/**
 * The Advisor tab: runs a Copilot-driven, read-only security review of the active
 * Rayfin app and presents the findings. Two checks for now — routes not behind
 * authentication, and database policies that are too permissive — each rendered as
 * a severity-coded card with a one-click "Fix with Copilot" hand-off to the chat.
 */
export default function AdvisorView({ project, onFix }: Props): JSX.Element {
  const [report, setReport] = useState<AdvisorReport | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const cancelledRef = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Reset when switching projects.
  useEffect(() => {
    setReport(null)
    setRunning(false)
    setProgress(null)
    setError(null)
  }, [project.id])

  // Live progress while a review runs (scoped to this project).
  useEffect(() => {
    const off = window.api.advisor.onEvent((env) => {
      if (env.projectId !== project.id) return
      if (env.event.type === 'progress') setProgress(env.event.text)
    })
    return off
  }, [project.id])

  const run = useCallback(async () => {
    cancelledRef.current = false
    setRunning(true)
    setError(null)
    setProgress('Starting analysis…')
    setReport(null)
    try {
      const result = await window.api.advisor.run(project.id)
      if (!mounted.current || cancelledRef.current) return
      setReport(result)
      if (!result.ok) setError(result.summary)
    } catch (err) {
      if (mounted.current) setError(String(err))
    } finally {
      if (mounted.current) {
        setRunning(false)
        setProgress(null)
      }
    }
  }, [project.id])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setRunning(false)
    setProgress(null)
    void window.api.advisor.cancel(project.id)
  }, [project.id])

  const groups = useMemo(
    () => (report?.ok ? groupFindings(report.findings) : []),
    [report]
  )
  const issueCount = report?.ok ? report.findings.length : 0

  return (
    <div className="advisor">
      <div className="advisor-head">
        <div>
          <h2 className="advisor-title">Advisor</h2>
          <p className="advisor-sub">
            Run a Copilot-powered security review of your app. It flags routes that
            aren’t behind authentication and database policies that are too permissive.
          </p>
        </div>
        <div className="advisor-actions">
          {report?.ok && !running && (
            <span className={`advisor-count${issueCount === 0 ? ' advisor-count--ok' : ''}`}>
              {issueCount === 0 ? 'All clear' : `${issueCount} issue${issueCount === 1 ? '' : 's'}`}
            </span>
          )}
          {running ? (
            <button className="btn btn--sm btn--ghost" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button className="btn btn--sm btn--primary" onClick={() => void run()}>
              {report ? 'Re-run analysis' : 'Run analysis'}
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className="advisor-scanning">
          <div className="advisor-scanner" aria-hidden="true">
            <span className="advisor-scanline" />
          </div>
          <div className="advisor-scan-text">
            <span className="advisor-scan-title">Analyzing your app…</span>
            <span className="advisor-progress">
              {progress ?? 'Reviewing routes and data policies…'}
            </span>
          </div>
        </div>
      )}

      {!running && error && <div className="alert alert--error advisor-error">{error}</div>}

      {!running && report?.ok && issueCount === 0 && (
        <div className="advisor-empty">
          <div className="advisor-empty-badge" aria-hidden="true">
            ✓
          </div>
          <h3 className="advisor-empty-title">No issues found</h3>
          <p className="advisor-empty-sub">
            {report.summary ||
              'Your routes look authenticated and your data policies appropriately scoped.'}
          </p>
        </div>
      )}

      {!running && report?.ok && issueCount > 0 && (
        <div className="advisor-results">
          {report.summary && <p className="advisor-summary">{report.summary}</p>}
          {groups.map((group) => (
            <section className="advisor-group" key={group.key}>
              <div className="advisor-group-head">
                <h3 className="advisor-group-title">{group.title}</h3>
                <span className="advisor-group-count">{group.findings.length}</span>
              </div>
              <div className="advisor-grid">
                {group.findings.map((finding, i) => (
                  <div className="advisor-finding" key={finding.id || `${group.key}-${i}`}>
                    <div className="advisor-finding-top">
                      <span className={`sev sev--${sevClass(finding.severity)}`}>
                        {sevLabel(finding.severity)}
                      </span>
                      {finding.file && (
                        <span className="advisor-file" title={finding.file}>
                          {finding.file}
                        </span>
                      )}
                    </div>
                    <h4 className="advisor-finding-title">{finding.title}</h4>
                    <p className="advisor-finding-detail">{finding.detail}</p>
                    {finding.recommendation && (
                      <div className="advisor-rec">
                        <span className="advisor-rec-label">Fix</span>
                        <span className="advisor-rec-text">{finding.recommendation}</span>
                      </div>
                    )}
                    <div className="advisor-finding-foot">
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => onFix(finding)}
                        title="Send this issue to the Build chat for Copilot to fix"
                      >
                        ✨ Fix with Copilot
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!running && !report && !error && (
        <div className="advisor-intro">
          <div className="advisor-intro-badge" aria-hidden="true">
            🛡️
          </div>
          <h3 className="advisor-intro-title">Review your app for security issues</h3>
          <p className="advisor-intro-sub">
            The Advisor asks Copilot to read your app and report problems. It won’t change
            any code — just run it and review what it finds.
          </p>
          <div className="advisor-checks">
            <div className="advisor-check">
              <span className="advisor-check-icon" aria-hidden="true">
                🔒
              </span>
              <div>
                <span className="advisor-check-title">Unauthenticated routes</span>
                <span className="advisor-check-desc">
                  Data entities and pages reachable without signing in.
                </span>
              </div>
            </div>
            <div className="advisor-check">
              <span className="advisor-check-icon" aria-hidden="true">
                🗄️
              </span>
              <div>
                <span className="advisor-check-title">Permissive data policies</span>
                <span className="advisor-check-desc">
                  Access that lets users reach data they shouldn’t.
                </span>
              </div>
            </div>
          </div>
          <button className="btn btn--primary advisor-intro-run" onClick={() => void run()}>
            Run analysis
          </button>
        </div>
      )}
    </div>
  )
}
