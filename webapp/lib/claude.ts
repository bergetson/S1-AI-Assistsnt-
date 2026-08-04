// Claude API called directly from the browser — required for static hosting.
// The anthropic-dangerous-direct-browser-access header opts in to CORS.
// Haiku 4.5 is the cheapest Claude model: $1/M input, $5/M output tokens.
const CLAUDE_MODEL = 'claude-haiku-4-5'

interface ClaudeContentBlock {
  type: string
  text?: string
}

export async function queryClaude(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string,
  opts: { maxTokens?: number } = {}
): Promise<string> {
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        system: systemPrompt,
        messages,
      }),
    })
  } catch {
    throw new Error('Could not reach the Claude API. If you are on a restricted network, check that api.anthropic.com is allowed.')
  }

  if (res.status === 401) {
    throw new Error('The Claude API rejected the key. Check the API key in ⚙ settings.')
  }
  if (res.status === 429) {
    throw new Error('Claude API rate limit reached. Wait a moment and try again.')
  }
  if (!res.ok) {
    throw new Error(`Claude API returned an error (${res.status}). Try again in a moment.`)
  }

  const data = await res.json() as { content?: ClaudeContentBlock[]; stop_reason?: string }
  const text = data.content?.find(b => b.type === 'text')?.text
  if (!text) return 'No response received from Claude.'
  // Without this the reply just stops mid-sentence and looks like a model failure.
  return data.stop_reason === 'max_tokens'
    ? `${text}\n\n_[Response hit the length limit — ask a narrower question for the rest.]_`
    : text
}

const KEY_STORAGE = 'claude-api-key'

export function getStoredClaudeKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(KEY_STORAGE) ?? process.env.NEXT_PUBLIC_CLAUDE_API_KEY ?? ''
}

export function setStoredClaudeKey(key: string): void {
  if (typeof window === 'undefined') return
  if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
  else localStorage.removeItem(KEY_STORAGE)
}
