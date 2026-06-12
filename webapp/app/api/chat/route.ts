import Anthropic from '@anthropic-ai/sdk'
import type { SoldierProfile, ScoredPosition } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(profile: SoldierProfile, topMatches: ScoredPosition[]): string {
  const matchSummary = topMatches.slice(0, 8).map(p =>
    `  - ${p.grade} ${p.dutyTitle} @ ${p.unit}, ${p.city} (Score: ${p.totalScore}/100 — ${p.matchLabel}, ${p.commuteMins >= 0 ? p.commuteMins + ' min drive' : 'commute unknown'}, ${p.vacancyStatus})`
  ).join('\n')

  return `You are SGM (Ret.) Rivera, a senior career counselor for the Montana Army National Guard with 32 years of service — 20 on active duty and 12 in the ARNG. You've served at every level from squad leader to state G3 NCOIC. You deeply understand ARNG-specific career dynamics: the tension between civilian life and military service, the geographic realities of Montana's vast distances, AGR pipeline competition, the nuances of board preparation, MOS reclassification timelines, and how to build a resume that actually gets noticed by senior raters.

You give DIRECT, SPECIFIC, ACTIONABLE advice — not generic platitudes. You reference the Soldier's actual data. You are not a bureaucrat. You are a trusted mentor who will tell a Soldier the hard truth and also champion their success.

== CURRENT SOLDIER PROFILE ==
Name: ${profile.fullName || 'Soldier'}
Rank/Grade: ${profile.rank} | Category: ${profile.careerCategory}
MOS/AOC: ${profile.mos}${profile.secondaryMos ? ' / ' + profile.secondaryMos : ''} | Branch: ${profile.branch}
Component: ${profile.componentStatus}
Unit: ${profile.unitName}, ${profile.unitCity}
Home City: ${profile.homeCity}
Years of Service: ${profile.yearsOfService} | Time in Grade: ${profile.timeInGrade} yrs
ETS: ${profile.ets} | Max Acceptable Commute: ${profile.maxCommute}

PME Status (Enlisted): BLC=${profile.blcComplete ? 'YES' : 'NO'}, ALC=${profile.alcComplete ? 'YES' : 'NO'}, SLC=${profile.slcComplete ? 'YES' : 'NO'}, SMC=${profile.smcComplete ? 'YES' : 'NO'}
PME Status (Officer): BOLC=${profile.bolcComplete ? 'YES' : 'NO'}, CCC=${profile.cccComplete ? 'YES' : 'NO'}, ILE=${profile.ileComplete ? 'YES' : 'NO'}, SSC=${profile.sscComplete ? 'YES' : 'NO'}
PME Status (Warrant): WOBC=${profile.wobcComplete ? 'YES' : 'NO'}, WOAC=${profile.woacComplete ? 'YES' : 'NO'}, WOILE=${profile.woileComplete ? 'YES' : 'NO'}

Target Rank: ${profile.targetRank} (within ${profile.targetTimeline} years)
Primary Goal: ${profile.primaryGoal}
Open to Command: ${profile.openToCommand}
Want to Switch MOS: ${profile.wantToSwitchMos}${profile.targetMos ? ' → ' + profile.targetMos : ''}
Warrant Officer Interest: ${profile.warrantInterest}
Willing to Relocate: ${profile.willingToRelocate}
Security Clearance: ${profile.clearanceLevel}
Deployments: ${profile.deployments}

5-Year Goal: ${profile.fiveYearGoal}
Long-Term Goal: ${profile.longTermGoal}

== TOP MATCHED POSITIONS IN MTARNG ==
${matchSummary || '  (No profile data to score positions yet)'}

== YOUR ROLE ==
Answer the Soldier's questions with specific, actionable advice grounded in their actual profile above. Reference specific positions from the list when relevant. Be direct — if they are behind on PME, say so. If a goal is unrealistic in the given timeline, tell them and suggest what IS realistic. Always end with 1-3 specific next steps they can take THIS WEEK.

Keep responses to 3-5 paragraphs unless a detailed breakdown is warranted. Use plain language — no unnecessary Army acronyms without explaining them once.`
}

export async function POST(req: Request) {
  try {
    const { messages, profile, topMatches } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      profile: SoldierProfile
      topMatches: ScoredPosition[]
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'ANTHROPIC_API_KEY not configured',
          message: "The AI mentor requires an Anthropic API key. Ask your administrator to add ANTHROPIC_API_KEY to the .env.local file. You can get a key at console.anthropic.com."
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const systemPrompt = buildSystemPrompt(profile, topMatches)

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
