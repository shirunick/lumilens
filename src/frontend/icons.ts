function svg(inner: string, size: number, fill = 'none'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`
}

const MAGNIFIER = `<circle cx="11" cy="11" r="7"/><line x1="16.65" y1="16.65" x2="21" y2="21"/>`

export const MAGNIFYING_GLASS_SVG = svg(MAGNIFIER, 20)

export const icons = {
  search: (s = 20) => svg(MAGNIFIER, s),
  dice: (s = 20) =>
    svg(
      `<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>`,
      s,
    ),
  flame: (s = 20) =>
    svg(
      `<path d="M12 3c1 3.5-2.5 5-2.5 8.5a3.5 3.5 0 007 0c0-1.2-.5-2.3-1.2-3.2C18.5 9.6 20 12 20 14.5a8 8 0 01-16 0C4 9 9 7.5 12 3z"/>`,
      s,
    ),
  sliders: (s = 20) =>
    svg(
      `<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.2" fill="currentColor"/><circle cx="15" cy="12" r="2.2" fill="currentColor"/><circle cx="8" cy="18" r="2.2" fill="currentColor"/>`,
      s,
    ),
  chevronRight: (s = 18) => svg(`<polyline points="9 6 15 12 9 18"/>`, s),
  chevronLeft: (s = 20) => svg(`<polyline points="15 6 9 12 15 18"/>`, s),
  x: (s = 22) =>
    svg(`<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>`, s),
  heart: (s = 22) =>
    svg(
      `<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>`,
      s,
    ),
  undo: (s = 18) =>
    svg(`<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>`, s),
  shuffle: (s = 18) =>
    svg(
      `<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>`,
      s,
    ),
  trash: (s = 20) =>
    svg(
      `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4h6v2"/>`,
      s,
    ),
  chat: (s = 18) =>
    svg(`<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>`, s),
  check: (s = 18) => svg(`<polyline points="20 6 9 17 4 12"/>`, s),
  refresh: (s = 16) =>
    svg(
      `<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 11-2.1-9.4L23 10"/>`,
      s,
    ),
  bolt: (s = 20) =>
    svg(`<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>`, s),
  book: (s = 20) =>
    svg(
      `<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z"/><path d="M4 21.5V4.5"/>`,
      s,
    ),
}
