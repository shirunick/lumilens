import { ariSystemMessage } from './ari-system'

export interface QuickOverviewInput {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes?: string
  tags: string[]
  creator_notes: string
}

export function buildQuickOverviewMessages(input: QuickOverviewInput) {
  const user = `Write a quick pitch of this character card in 3 to 5 plain-text sentences.

Critical: who YOU, the user, are cast as. Many cards define {{user}} in the scenario or first message (teacher, student, rival, spouse, stranger, employee). Read those fields carefully and get the role right. A wrong role is a failed pitch.

Structure:
1. One or two sentences on what the card is (premise, genre, tone), in Ari's voice.
2. If the card defines your role: one sentence that starts with "You are" or "You play" and names your exact role, your relationship to the character, and the situation you start in. Example shape: "You are her teacher, reviewing after-hours work she should not have handed in." Pull concrete details from description, scenario, and especially the first message, where {{user}} or second person usually shows who the user is.
3. If the card never defines who you are: say that plainly in one short sentence. Example shape: "The card does not define who you are." Do not invent, infer, or guess a role.
4. Optional: one dry Ari observation if it fits.

Never invent a user role to fill the gap. No "most likely", no "probably", no guessed casting.
Speak as Ari about the card, never as the character. No markdown headings. No hashtags. No emoji. No em dashes.
Name: ${input.name}
Description: ${input.description || '(none)'}
Personality: ${input.personality || '(none)'}
Scenario: ${input.scenario || '(none)'}
First message: ${input.first_mes || '(none)'}
Tags: ${input.tags.length ? input.tags.join(', ') : '(none)'}
Creator notes: ${input.creator_notes || '(none)'}

Write only the pitch.`

  return [ariSystemMessage(), { role: 'user' as const, content: user }]
}
