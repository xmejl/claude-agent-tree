import type { View } from '../types'

export const QUESTION = 'How do you want to see the agent orchestration?'

export const LABEL = { pane: 'Agents pane', web: 'Web page', window: 'Browser window' } as const

// The window option is offered only when an OS launcher is available.
export const optionsFor = (canOpenWindow: boolean): string[] =>
  canOpenWindow ? [LABEL.pane, LABEL.web, LABEL.window] : [LABEL.pane, LABEL.web]

// the answer is the labels chosen, comma-joined; anything else (free text, a dismissed
// dialog) falls back to the pane, so the user always sees something
export const parseChoice = (answer: string): Pick<View, 'pane' | 'web' | 'window'> => {
  const picked = answer.split(',').map(s => s.trim())
  const view = {
    pane: picked.includes(LABEL.pane),
    web: picked.includes(LABEL.web),
    window: picked.includes(LABEL.window) || picked.includes('Edge window'),
  }

  return view.pane || view.web || view.window ? view : { pane: true, web: false, window: false }
}
