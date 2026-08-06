'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { RosterSoldier } from '@/lib/commandTypes'
import { buildNameMap, rehydrateNames } from '@/lib/commanderAI'
import { queryClaude, getStoredClaudeKey } from '@/lib/claude'
import { queryAskSage, buildFullMessage, getStoredCredentials } from '@/lib/asksage'
import { cn } from '@/lib/utils'

const ARMY_GREEN = '#1B4F2A'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Multi-turn force-management conversation, shared by the commander and G1
 * views. It differs from the soldier-facing mentor in two ways that matter:
 * the system prompt is the force picture rather than one career, and every
 * soldier crosses the boundary as a pseudonym.
 *
 * The whole payload is rendered verbatim behind a disclosure. A commander being
 * asked to act on a recommendation should be able to read exactly what the
 * model was told — including what it was told is missing.
 */
export function ForceChat({
  systemPrompt, roster, suggestions, scopeLabel, emptyHint,
}: {
  systemPrompt: string
  /** Used only in the browser, to map pseudonyms back to names in the reply. */
  roster: RosterSoldier[]
  suggestions: string[]
  scopeLabel: string
  emptyHint?: string
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPayload, setShowPayload] = useState(false)
  const [claudeKey, setClaudeKey] = useState('')
  const [creds, setCreds] = useState({ email: '', apiKey: '' })
  const endRef = useRef<HTMLDivElement>(null)

  // Credentials live in localStorage, which does not exist during the static
  // export, so they can only be read after mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setClaudeKey(getStoredClaudeKey())
    setCreds(getStoredCredentials())
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, loading])

  const hasCreds = Boolean(claudeKey || (creds.email && creds.apiKey))
  const nameMap = useMemo(() => buildNameMap(roster), [roster])

  async function send(question: string) {
    const q = question.trim()
    if (!q || loading) return
    if (!hasCreds) {
      setError('Add a Claude API key or Ask Sage credentials on the Ask Steeves page first.')
      return
    }
    setError('')
    setDraft('')
    // The whole history goes with each request — a commander's follow-up
    // ("what about the warrants?") is meaningless without the turn before it.
    const history: ChatTurn[] = [...turns, { role: 'user', content: q }]
    setTurns(history)
    setLoading(true)
    try {
      const reply = claudeKey
        ? await queryClaude(systemPrompt, history, claudeKey, { maxTokens: 2000 })
        : await queryAskSage(buildFullMessage(systemPrompt, history), creds.email, creds.apiKey)
      // Pseudonyms become names here, in the browser. Names never left it.
      setTurns([...history, { role: 'assistant', content: rehydrateNames(reply, nameMap) }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong reaching the AI provider.')
      setTurns(turns)   // drop the unanswered question rather than stranding it
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {!hasCreds && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>No AI provider configured.</strong> Everything else in this app works without one —
          the analysis below is computed locally. To ask questions, add a Claude API key or Ask Sage
          credentials on the{' '}
          <Link href="/ai-mentor" className="underline font-semibold">Ask Steeves</Link> page.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-gray-900">Ask about {scopeLabel}</h2>
            <p className="text-xs text-gray-500">
              Soldiers are sent as pseudonyms; names are restored in your browser only.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {turns.length > 0 && (
              <button onClick={() => { setTurns([]); setError('') }}
                className="text-xs text-gray-500 hover:text-gray-800 underline">
                Clear conversation
              </button>
            )}
            <button onClick={() => setShowPayload(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-800 underline">
              {showPayload ? 'Hide' : 'Show'} what is sent
            </button>
          </div>
        </div>

        {showPayload && (
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-xs text-gray-600 mb-2">
              Exactly what the model receives. Read this before acting on anything it says —
              note in particular what it is told is <em>unknown</em>.
            </p>
            <pre className="text-[11px] leading-snug text-gray-700 whitespace-pre-wrap max-h-80 overflow-auto bg-white border rounded p-3">
              {systemPrompt}
            </pre>
          </div>
        )}

        <div className="px-5 py-4 space-y-4 max-h-[28rem] overflow-y-auto">
          {turns.length === 0 && (
            <div className="text-sm text-gray-500">
              {emptyHint ?? 'Ask anything about manning, losses, promotion requirement, or succession.'}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('rounded-2xl px-4 py-2.5 max-w-[85%] text-sm whitespace-pre-wrap',
                t.role === 'user'
                  ? 'bg-green-800 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm')}>
                {t.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
                Reading the force picture…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="px-5 py-2 text-sm text-red-700 bg-red-50 border-t border-red-200">{error}</div>
        )}

        <div className="px-5 py-3 border-t">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) }
              }}
              rows={2}
              placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <button
              onClick={() => send(draft)}
              disabled={loading || !draft.trim()}
              className="px-5 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: ARMY_GREEN }}>
              Send
            </button>
          </div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Questions this data can actually answer
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)} disabled={loading}
                className="text-left text-xs px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-green-50 hover:border-green-600 disabled:opacity-40 max-w-md">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
