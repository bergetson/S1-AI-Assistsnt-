'use client'

import { useState, useRef, useEffect } from 'react'
import { useProfileStore } from '@/lib/store'
import { positions } from '@/lib/data/positions'
import { scoreAllPositions, getPmeGaps } from '@/lib/scoring'
import { buildSystemPrompt, buildFullMessage, queryAskSage, getStoredCredentials, setStoredCredentials } from '@/lib/asksage'
import { queryClaude, getStoredClaudeKey, setStoredClaudeKey } from '@/lib/claude'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const STARTER_PROMPTS = [
  'What should my next assignment be?',
  'Should I switch MOS or branch?',
  'What schools do I need to promote?',
  'How do I become a warrant officer?',
  'What does my 5-year career path look like?',
  'How do I prepare for a command position?',
  'What AGR opportunities exist for me?',
  'How do I transition to officer?',
]

export default function AiMentorPage() {
  const { profile, profileComplete } = useProfileStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState({ email: '', apiKey: '' })
  const [claudeKey, setClaudeKey] = useState('')
  const [claudeKeyInput, setClaudeKeyInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [showKeySettings, setShowKeySettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setCreds(getStoredCredentials())
    setClaudeKey(getStoredClaudeKey())
  }, [])

  // Claude (cheapest: Haiku) is the preferred provider; Ask Sage is fallback
  const hasCreds = Boolean(claudeKey || (creds.email && creds.apiKey))
  const providerName = claudeKey ? 'Claude' : 'Ask Sage'

  function saveApiKey() {
    if (claudeKeyInput.trim()) {
      setStoredClaudeKey(claudeKeyInput)
      setClaudeKey(claudeKeyInput.trim())
    }
    const email = emailInput.trim() || creds.email
    const apiKey = keyInput.trim() || creds.apiKey
    if (email || apiKey) {
      setStoredCredentials(email, apiKey)
      setCreds({ email, apiKey })
    }
    setClaudeKeyInput('')
    setEmailInput('')
    setKeyInput('')
    setShowKeySettings(false)
    setError(null)
  }

  const scored = scoreAllPositions(profile, positions)
  const topMatches = scored.slice(0, 10)
  const pmeGaps = getPmeGaps(profile)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    if (!hasCreds) {
      setShowKeySettings(true)
      setError('Add an API key first (gear icon, top right).')
      return
    }
    setError(null)

    const userMsg: Message = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const systemPrompt = buildSystemPrompt(profile, topMatches)
      const history = newMessages.map(m => ({ role: m.role, content: m.content }))

      let reply: string
      if (claudeKey) {
        reply = await queryClaude(systemPrompt, history, claudeKey)
      } else {
        reply = await queryAskSage(buildFullMessage(systemPrompt, history), creds.email, creds.apiKey)
      }

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, content: reply, streaming: false } : m
      ))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to get a response. Check your connection and API key.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (!profileComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center px-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-green-950 shadow-xl mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)' }}>S</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Steeves needs to know you first</h2>
        <p className="text-gray-600 mb-6 leading-relaxed">
          Complete your Soldier profile so Steeves can give you specific, relevant career advice
          based on your rank, MOS, home city, and goals. Takes about 5 minutes.
        </p>
        <Link
          href="/profile"
          className="inline-block px-6 py-3 rounded-lg text-white font-semibold shadow"
          style={{ backgroundColor: '#1B4F2A' }}
        >
          Build My Profile →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4">
          {/* Profile Summary */}
          <div className="rounded-lg p-3 mb-4 text-white" style={{ backgroundColor: '#1B4F2A' }}>
            <div className="font-bold text-sm">{profile.fullName || 'Soldier'}</div>
            <div className="text-xs opacity-90 mt-1">
              {profile.rank} · {profile.mos} · {profile.componentStatus}
            </div>
            <div className="text-xs opacity-80 mt-0.5">{profile.unitName}</div>
            <div className="text-xs opacity-80">{profile.homeCity}, MT</div>
            <div className="mt-2 pt-2 border-t border-green-700 text-xs">
              Goal: <strong>{profile.targetRank}</strong> in {profile.targetTimeline} yrs
            </div>
          </div>

          {/* PME Gaps */}
          {pmeGaps.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">PME Gaps</h3>
              <div className="space-y-1">
                {pmeGaps.map((gap, i) => (
                  <div key={i} className="text-xs bg-orange-50 border border-orange-200 rounded px-2 py-1 text-orange-800">
                    ⚠ {gap}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Matches */}
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Top Matched Positions</h3>
            <div className="space-y-2">
              {topMatches.slice(0, 4).map(pos => (
                <div key={pos.id} className="bg-gray-50 rounded p-2 border border-gray-200">
                  <div className="text-xs font-semibold text-gray-800 leading-tight">{pos.dutyTitle}</div>
                  <div className="text-xs text-gray-500">{pos.unit}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-bold" style={{ color: '#1B4F2A' }}>{pos.totalScore}/100</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{pos.city}</span>
                    {pos.vacancyStatus === 'Vacant' && (
                      <span className="ml-auto text-xs bg-green-100 text-green-700 px-1 rounded">Vacant</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Starter prompts */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ask Me About…</h3>
            <div className="space-y-1">
              {STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                  className="w-full text-left text-xs px-2 py-1.5 rounded border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT PANEL — CHAT ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold text-green-950"
                style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)' }}>S</div>
              <h1 className="font-bold text-gray-800">Ask Steeves</h1>
            </div>
            <p className="text-xs text-gray-500 ml-9">Your S1 Career Manager · Powered by {providerName} · Context-aware advice based on your profile</p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200"
              >
                Clear chat
              </button>
            )}
            <button
              onClick={() => setShowKeySettings(v => !v)}
              title="Ask Sage API key settings"
              className={`text-sm px-2 py-1 rounded border ${hasCreds ? 'text-gray-400 border-gray-200 hover:text-gray-600' : 'text-amber-700 border-amber-300 bg-amber-50'}`}
            >
              ⚙ {hasCreds ? '' : 'Set API Key'}
            </button>
          </div>
        </div>

        {/* API key settings panel */}
        {showKeySettings && (
          <div className="px-4 py-3 border-b border-gray-200 bg-amber-50 flex-shrink-0">
            <p className="text-xs text-amber-800 mb-2 font-medium">
              {hasCreds
                ? `Using ${providerName}. Enter new values below to replace the saved keys.`
                : 'Add a Claude API key (recommended) or Ask Sage credentials. Keys are stored only in this browser and sent nowhere except directly to the AI provider.'}
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <span className="text-xs font-semibold text-amber-900 w-20 flex-shrink-0">Claude</span>
                <input
                  type="password"
                  value={claudeKeyInput}
                  onChange={e => setClaudeKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveApiKey() }}
                  placeholder={claudeKey ? 'Claude API key (saved — paste to replace)' : 'Claude API key (sk-ant-…)'}
                  className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <span className="text-xs font-semibold text-amber-900 w-20 flex-shrink-0">Ask Sage</span>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder={creds.email ? `Email (current: ${creds.email})` : 'Ask Sage account email…'}
                  className="flex-1 w-full rounded-lg border border-amber-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveApiKey() }}
                  placeholder={creds.apiKey ? 'API key (saved)' : 'Ask Sage API key…'}
                  className="flex-1 w-full rounded-lg border border-amber-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                onClick={saveApiKey}
                className="self-end px-4 py-1.5 rounded-lg text-white text-sm font-semibold"
                style={{ backgroundColor: '#1B4F2A' }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-extrabold text-green-950 shadow-lg mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)' }}>S</div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Ask Steeves anything</h2>
              <p className="text-gray-500 max-w-md mx-auto text-sm">
                I know your full profile, your top matched positions, and the MTARNG force structure.
                Ask me about promotions, MOS switches, schools, AGR pipelines, or your 5-year plan.
              </p>
              <p className="text-xs text-gray-400 mt-4">
                Click a prompt on the left or type your question below.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-extrabold mr-2 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)', color: '#0D2614' }}>
                  S
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mr-2"
                style={{ background: 'linear-gradient(135deg, #C8A96E, #e0c080)', color: '#0D2614' }}>S</div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your career path, positions, schools, promotions…"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#1B4F2A' } as React.CSSProperties}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#1B4F2A' }}
            >
              {isLoading ? '…' : 'Send'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
