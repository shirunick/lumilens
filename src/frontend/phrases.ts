export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

type Line = { title: string; sub: string }

export const LOOKUP: readonly Line[] = [
  { title: 'One moment.', sub: 'Pulling up the card.' },
  { title: 'Let me find that one.', sub: 'It should be here somewhere.' },
  { title: 'Opening the file.', sub: 'Give me a second to read the label.' },
  { title: 'Checking the shelf.', sub: 'Your library is bigger than it looks.' },
]

export const QUICK_LOADING: readonly Line[] = [
  {
    title: 'Give me a second, skimming the premise.',
    sub: 'Working out who they are and what you are walking into.',
  },
  {
    title: 'Reading the first page.',
    sub: 'I will tell you what this is and where you fit in.',
  },
  {
    title: 'Let me size this one up.',
    sub: 'Premise, tone, and your part in it.',
  },
  {
    title: 'Skimming. Nobody reads the whole card.',
    sub: 'Just enough to tell you what you are getting into.',
  },
]

export const DEEP_LOADING: readonly Line[] = [
  {
    title: 'Slowing down for a proper read.',
    sub: 'Personality, hooks, and the traps worth knowing about.',
  },
  {
    title: 'Going through this one carefully.',
    sub: 'Some of it is only visible between the lines.',
  },
  {
    title: 'Taking the long way through the card.',
    sub: 'This will take a little longer than a pitch.',
  },
  {
    title: 'Reading the fine print.',
    sub: 'There is usually more going on than the tags admit.',
  },
]

export const SEARCH_LOADING: readonly Line[] = [
  {
    title: 'Searching your library.',
    sub: 'Reading cards to find the best fits.',
  },
  {
    title: 'Looking through the shelves.',
    sub: 'I will bring back the ones worth your time.',
  },
  {
    title: 'Going through your cards.',
    sub: 'Some of these have been waiting a while.',
  },
]

export const SURPRISE_LOADING: readonly Line[] = [
  { title: 'Rolling the dice.', sub: 'Picking something from your library.' },
  { title: 'Closing my eyes and pointing.', sub: 'This is how all good decisions are made.' },
  { title: 'Reaching into the pile.', sub: 'No promises about what comes out.' },
]

export const TINDER_LOADING: readonly Line[] = [
  {
    title: 'Shuffling your library.',
    sub: 'Writing the first profile.',
  },
  {
    title: 'Dealing the deck.',
    sub: 'I will have the first one ready shortly.',
  },
  {
    title: 'Setting up the stack.',
    sub: 'Everyone gets a fair look.',
  },
]

const CHOOSER_TITLES: readonly ((name: string) => string)[] = [
  (n) => `How do you want to tackle ${n}?`,
  (n) => `How deep should I go on ${n}?`,
  (n) => `What do you want to know about ${n}?`,
  (n) => `${n}. Short version or long version?`,
]

const CHOOSER_SUBS: readonly string[] = [
  'Pick how deep you want me to go before I start reading.',
  'Tell me how much of the card you want unpacked.',
  'I can keep it short or take it apart. Your call.',
  'Choose an angle and I will get to it.',
]

export function chooserTitle(name: string): string {
  return pick(CHOOSER_TITLES)(name)
}

export function chooserSub(): string {
  return pick(CHOOSER_SUBS)
}

const FOUND_INTROS: readonly ((n: number) => string)[] = [
  (n) => (n === 1 ? 'I found one worth showing you.' : `I found ${n} worth showing you.`),
  (n) => (n === 1 ? 'This is the one I would look at.' : `These ${n} are the ones I would look at.`),
  (n) => (n === 1 ? 'One candidate. Read my take.' : `${n} candidates. Read my take on each.`),
  (n) => (n === 1 ? 'Only one stood out.' : `${n} stood out. Here is what I think.`),
]

export function foundIntro(count: number): string {
  return pick(FOUND_INTROS)(count)
}

const SURPRISE_INTROS: readonly string[] = [
  'The dice landed here.',
  'This is what came out of the pile.',
  'Fate picked this one. I only report it.',
  'Random pick. Here is what I make of it.',
]

export function surpriseIntro(): string {
  return pick(SURPRISE_INTROS)
}

export const NO_MATCHES: readonly string[] = [
  'Nothing matched. Try fewer filters or different words.',
  'I came back empty handed. Loosen the search a little.',
  'No fits in your library. Broaden it and I will look again.',
]

export const NO_MORE: readonly string[] = [
  'That is everything I have for this search.',
  'I have run out of new ones for this search.',
  'No more cards that fit. Start a new search for fresh ones.',
]

export const EMPTY_LIBRARY: readonly string[] = [
  'Your library is empty.',
  'There is nothing in your library to pick from.',
]

export const PITCH_WAITING: readonly string[] = [
  'Reading it.',
  'One moment, skimming.',
  'Working out your part in this.',
  'Still reading.',
]

export const TINDER_EMPTY: readonly string[] = [
  'No cards left.',
  'That was the whole stack.',
  'You have been through everything.',
]