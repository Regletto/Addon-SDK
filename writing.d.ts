// What only Regletto Writing has: `addon.writing`. The core is in addon.d.ts.
// Everything here knows a chapter, a book or a place in the text, and its
// permissions carry the prefix `writing:`.

/** A place in a chapter: `[block, offset]`. A block is a paragraph. */
type WritingPoint = [number, number]

/** A stretch of text in one chapter. `selection()` answers it, `mentions()` finds it, `suggest()` and `reveal()` take it. */
interface WritingSpot {
	chapter: string
	from: WritingPoint
	to: WritingPoint
}

/** A chapter or a section of the chapter tree. A section carries `items`. */
interface WritingNode {
	type: 'chapter' | 'section'
	id: string
	title: string
	/** Words of a chapter. */
	words?: number
	items?: WritingNode[]
}

/** The chapter tree of the open book, as the author sees it. */
interface WritingTree {
	/** The title of the book as the shelf shows it. */
	title: string
	tree: WritingNode[]
	/** The id of the open chapter. */
	open: string | null
	problems?: unknown[]
}

/** A run of text with its marks. */
interface WritingRun {
	t: string
	[mark: string]: unknown
}

/** The model of a chapter. Notes are apart from the text. */
interface WritingDoc {
	format: number
	blocks: { runs?: WritingRun[]; [key: string]: unknown }[]
	notes: unknown[]
}

/** A found place: a spot and a line around it. */
interface WritingMention extends WritingSpot {
	/** A snippet around the place, not from the start of the paragraph. */
	line: string
}

/** What to count. */
interface WritingAsk {
	/** At most 50 words, each at most 200 characters. */
	words: string[]
	/**
	 * `exact` the characters as typed, `nocase` the same in any case, `word` only whole words,
	 * `loose` whole words with a German ending (-s -n -en -es). Default `loose`.
	 */
	match?: 'exact' | 'nocase' | 'word' | 'loose'
	/** How many places come back, at most 500. `0` only counts. The count is always the full one. */
	spots?: number
}

/** Per word: how often it stands in the manuscript, and where. */
type WritingMentions = { [word: string]: { count: number; spots: WritingMention[] } }

interface WritingNote {
	/** `null` where nothing was written yet. Refuses without an open book. */
	read(): Promise<any>
	write(data: any): Promise<void>
}

interface AddonWriting {
	/** Needs `writing:read`. The chapter tree of the open book. Refuses without one. */
	tree(): Promise<WritingTree>
	/** Needs `writing:read`. One chapter of the open book. Refuses an id it does not know. */
	chapter(id: string): Promise<{ id: string; doc: WritingDoc; words: number }>
	/**
	 * Needs `writing:read`. Where the author stands: a spot and its text,
	 * `null` where no chapter is open. Refuses without a book.
	 */
	selection(): Promise<(WritingSpot & { text: string }) | null>
	/**
	 * Needs `writing:suggest`. Lays a suggestion at a place in one paragraph; only a click of the
	 * author puts it in. `text` `''` means take it out. Text and `why` at most 2000 characters.
	 */
	suggest(spot: WritingSpot & { text: string; why?: string }): Promise<void>
	/** Needs `writing:read`. How often each word stands in the manuscript, and where. Notes are not searched. */
	mentions(ask: WritingAsk): Promise<WritingMentions>
	/**
	 * Needs `writing:read`. The same count, live: `onMentions()` hears it whenever the manuscript
	 * is saved. `null` stops; a second call replaces the first.
	 */
	watch(ask: WritingAsk | null): Promise<void>
	/** The count of `watch()` changed. */
	onMentions(fn: (said: WritingMentions) => void): void
	/**
	 * Needs `writing:read`, and only while the author presses something on this surface.
	 * Opens the chapter and selects the place in the middle of the desk.
	 */
	reveal(spot: WritingSpot): Promise<void>
	/** The note at the open book: `<book>/addons/<id>.json`. Needs no permission. At most 1 MB. */
	readonly bookStore: WritingNote
	/** The author went into another book, or out of one. Read `bookStore` again. */
	onBook(fn: () => void): void
}

interface Addon {
	/** What only Regletto Writing has. In addon.js, panel.js and dialog.js, not in overlay.js. */
	readonly writing: AddonWriting
}
