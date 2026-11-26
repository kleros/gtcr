import { SUBGRAPH_RULING } from './status-constants'

/*
 * The court's own words for a dispute's choices: the `rulingOptions.titles`
 * of the MetaEvidence file the dispute was raised under ("Yes, Add It",
 * "No, Don't Add It"). They are what jurors read on the court's site when
 * they vote, so a vote or a ruling shown with them reads as the court shows
 * it, rather than as the page's own "For the challenger".
 *
 * Choice 1 is always the requester's side and choice 2 the challenger's, in
 * every Curate contract, but the words are not: some removal files list
 * "No, Remove It" first and "Yes, Keep it" second. So a title is only ever
 * looked up by the choice number, never read for its yes or no.
 *
 * The file is written by whoever deploys or governs the list. A title that
 * is not text, is empty, or matches the other choice's gives no titles at
 * all (the page's own words then), and each is kept to one plain line.
 */

/** Titles in choice order: index 0 is choice 1. */
export type RulingTitles = readonly string[]

/**
 * Longer titles are cut with an ellipsis: they sit on one line beside a
 * count. Counted in characters (code points), so a cut never splits one.
 */
export const MAX_TITLE_LENGTH = 60

// Control characters, invisible marks (zero-width, soft hyphen, joiners) and
// bidirectional marks and overrides: a title could otherwise run invisible
// text or flip the words around it.
const INVISIBLE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g

const clean = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  const chars = [...text]
  return chars.length > MAX_TITLE_LENGTH
    ? `${chars
        .slice(0, MAX_TITLE_LENGTH - 1)
        .join('')
        .trimEnd()}…`
    : text
}

/**
 * The ruling titles of a MetaEvidence file, or undefined when it has none
 * the page can stand behind: both sides need a title of their own.
 */
export const rulingTitlesOf = (file: unknown): RulingTitles | undefined => {
  if (!file || typeof file !== 'object') return undefined
  const options = (file as { rulingOptions?: unknown }).rulingOptions
  if (!options || typeof options !== 'object') return undefined
  const titles = (options as { titles?: unknown }).titles
  if (!Array.isArray(titles) || titles.length < 2) return undefined
  const words = titles.map(clean)
  const [requester, challenger] = words
  if (
    !requester ||
    !challenger ||
    requester.toLowerCase() === challenger.toLowerCase()
  )
    return undefined
  // A later choice with no usable title keeps its place, so the numbers
  // still line up; the caller names it its own way.
  return words.map((word) => word ?? '')
}

/** The court's title for a choice, when the file gave one. */
export const rulingTitle = (
  titles: RulingTitles | undefined,
  choice: number | undefined,
): string | undefined =>
  titles && choice !== undefined && choice >= 1
    ? titles[choice - 1] || undefined
    : undefined

/**
 * The court's choice number for a ruling as the indexers record it: 1 for
 * the requester's side, 2 for the challenger's. A refusal and an unknown
 * value have no title.
 */
export const rulingChoiceOf = (
  ruling: string | null | undefined,
): number | undefined =>
  ruling === SUBGRAPH_RULING.ACCEPT
    ? 1
    : ruling === SUBGRAPH_RULING.REJECT
      ? 2
      : undefined
