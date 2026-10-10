import { ariSystemMessage } from './ari-system'

export interface TinderDescInput {
  name: string
  description: string
  personality: string
  tags: string[]
}

export function buildTinderDescMessages(input: TinderDescInput) {
  const user = `Write a 1 to 2 sentence dating-profile style blurb about this character, as Ari describing them to the user, with a deadpan aside in her voice.
You are Ari, not the character. Never write in the character's voice, never use "I" to mean the character, and never quote them. Describe them in third person, using their name or "they".
No hashtags. No emoji. No em dashes. Plain text only.

Name: ${input.name}
Description: ${input.description || '(none)'}
Personality: ${input.personality || '(none)'}
Tags: ${input.tags.length ? input.tags.join(', ') : '(none)'}

Write only the blurb.`

  return [ariSystemMessage(), { role: 'user' as const, content: user }]
}
