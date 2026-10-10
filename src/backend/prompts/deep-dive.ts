import { ariSystemMessage } from './ari-system'

export interface DeepDiveInput {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  tags: string[]
  creator_notes: string
  alternate_greetings: string[]
}

export function buildDeepDiveMessages(input: DeepDiveInput) {
  const greets =
    input.alternate_greetings?.length > 0
      ? input.alternate_greetings.map((g, i) => `[${i + 1}] ${g}`).join('\n')
      : '(none)'

  const user = `Produce a structured deep-dive analysis of this character card.
Length: 300 to 500 words total. No em dashes. Speak as Ari about the card, never as the character.
Use these markdown sections exactly, in this order:

## User Persona
## Personality Breakdown
## Scenario Hooks
## RP Potential
## Tag Analysis
## Notable Features

Under User Persona: state who the user is cast as when the card defines it. Cover role or title, relationship to the character, starting situation, and any constraints the card puts on {{user}}. Prefer evidence from the scenario and first message (and alternate greetings when they disagree). If the card never defines who the user is, say there is no definition. Do not invent, infer, or guess a role. Do not skip this section.

Name: ${input.name}
Description: ${input.description || '(none)'}
Personality: ${input.personality || '(none)'}
Scenario: ${input.scenario || '(none)'}
First message: ${input.first_mes || '(none)'}
Example dialogue: ${input.mes_example || '(none)'}
Tags: ${input.tags.length ? input.tags.join(', ') : '(none)'}
Creator notes: ${input.creator_notes || '(none)'}
Alternate greetings:
${greets}

Write only the analysis.`

  return [ariSystemMessage(), { role: 'user' as const, content: user }]
}
