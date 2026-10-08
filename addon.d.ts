// The core of the add-on API: what every Regletto product calls the same, on
// `window.addon`. What only one product has lies in the declarations of that
// product's SDK (its surfaces and `addon.<product>`), and they refer to this file. Together they
// are the reference on regletto.com/developers.

/**
 * A string in one language, or one per language: `{ de: 'Figuren', en: 'Characters' }`.
 * Regletto picks the author's language, then English, then the first one.
 */
type AddonText = string | { [language: string]: string }

/**
 * The fifteen values of the author's theme, and `mode`.
 * The same values stand as CSS properties on `:root`: `var(--accent)`.
 */
interface AddonTheme {
	mode: 'light' | 'dark'
	base: string
	desk: string
	page: string
	ink: string
	dim: string
	line: string
	accent: string
	'ink-page': string
	'accent-soft': string
	'accent-hover': string
	raise: string
	danger: string
	'danger-soft': string
	'mark-ink': string
	veil: string
}

/** A part from `addon.views`, text, or an array of them. */
type AddonPart = Node | string | number | null | undefined | false | AddonPart[]

/** The fields the default arrangement of a hull reads. `Id` is the type of your ids. */
interface AddonFields<Id extends string | number = string | number> {
	/** Comes back in `onPick`; not drawn. */
	id?: Id
	/** A picture at the ratio of a cover: a source or a node. */
	cover?: string | Node
	/** A name from Material Symbols Rounded, in a small box. */
	icon?: string
	name?: AddonPart
	/** The second line, at most two lines high. */
	note?: AddonPart
	/** A number in digits of equal width. */
	count?: AddonPart
	/** A band on the soft accent. */
	badge?: AddonPart
	/** How far something has come: a fraction, or a value of `gaugeOf`. */
	gauge?: number
	gaugeOf?: number
	/** Drawn as selected. */
	current?: boolean
	/** A click, Enter or Space. */
	onPick?: (id: Id) => void
}

/** One row of a right-click menu. */
interface AddonMenuRow {
	id: string
	/** One language, or one per language. */
	label: AddonText
	icon?: string
	key?: string
	on?: () => void
	part?: string
}

/**
 * A list or a grid. Built, never updated: call it again and replace the node.
 * `Id` is the type of your ids, `Item` the shape of your items.
 */
interface AddonViewSpec<Id extends string | number = string | number, Item extends AddonFields<Id> = AddonFields<Id>> {
	items?: Item[]
	/** Compartments with a head, a chevron and a count, instead of `items`. */
	sections?: { id: string; name: string; items: Item[]; shut?: boolean }[]
	/** Which hull each item gets. */
	item?: 'row' | 'card' | 'tile'
	/** The id drawn as selected. */
	current?: Id | null
	onPick?: (id: Id) => void
	/** Right click: the rows of the menu. */
	onMenu?: (id: Id, section?: string) => AddonMenuRow[]
	/** Dragged: the whole new order. */
	onOrder?: (ids: Id[], section?: string) => void
	/** The dashed plus after the compartments. Needs `newSection`, the word on the button. */
	onNewSection?: (name: string) => void
	newSection?: string
	/** Your own element per item: the list sets its behaviour on that node. */
	row?: (item: Item) => Node
	card?: (item: Item) => Node
	tile?: (item: Item) => Node
}

/**
 * The parts box: hulls with behaviour, parts that do not know where they stand,
 * two views. Nothing forces a shape.
 */
interface AddonViews {
	/** Full width, two lines high. One argument: the default arrangement. Two: exactly these parts. */
	row(fields: AddonFields, parts?: AddonPart[]): HTMLElement
	/** 340 px, paper with a line and a shadow. */
	card(fields: AddonFields, parts?: AddonPart[]): HTMLElement
	/** 148 px, with a 134 px picture. */
	tile(fields: AddonFields, parts?: AddonPart[]): HTMLElement
	cover(source?: string | Node, small?: boolean): HTMLElement
	icon(symbol: string, small?: boolean): HTMLElement
	name(value: AddonPart): HTMLElement
	note(value: AddonPart): HTMLElement
	count(value: AddonPart): HTMLElement
	badge(value: AddonPart): HTMLElement
	/** `gauge(3, 10)` and `gauge(0.3)` draw the same. */
	gauge(value: number, of?: number): HTMLElement
	/** Pairs of a word and its value, in two columns. */
	fields(pairs: [AddonPart, AddonPart][]): HTMLElement
	/** A dot of the given colour. */
	dot(colour?: string): HTMLElement
	/** Side by side. */
	line(...parts: AddonPart[]): HTMLElement
	/** One under the other. */
	stack(...parts: AddonPart[]): HTMLElement
	/** Pushes what follows to the right. */
	gap(): HTMLElement
	/** A field in place: Enter takes it, Esc leaves it. `done` only runs when the name changed. */
	rename(node: Node, done: (name: string) => void): void
	/** A tip after 400 ms, at the right edge. */
	tip(node: Node, text: string): void
	list<Id extends string | number = string | number, Item extends AddonFields<Id> = AddonFields<Id>>(spec: AddonViewSpec<Id, Item>): HTMLElement
	grid<Id extends string | number = string | number, Item extends AddonFields<Id> = AddonFields<Id>>(spec: AddonViewSpec<Id, Item>): HTMLElement
}

/**
 * Writes to the add-on's log, `<userData>/logs/addons/<id>.log`. `regletto logs` follows it.
 * An add-on from the store keeps warnings and errors only.
 */
interface AddonLog {
	debug(...parts: unknown[]): void
	info(...parts: unknown[]): void
	warn(...parts: unknown[]): void
	error(...parts: unknown[]): void
}

/** The add-on's own note. Needs no permission. At most 1 MB. */
interface AddonStore {
	/** `null` where nothing was written yet. */
	read<T = unknown>(): Promise<T | null>
	write<T>(data: T): Promise<void>
}

/**
 * A shortcut the author presses anywhere in the window, and may lay on another key in the settings.
 * One laid in addon.js or panel.js is kept: from the next start on it stands before that surface runs,
 * and a press builds the surface out of sight. The first time, it stands once the surface has run.
 */
interface AddonShortcut {
	/** Your name for it: a-z, 0-9 and "-", 2 to 64 characters. The same id again replaces your shortcut. */
	id: string
	/**
	 * The default key, written the way Regletto writes it: `Ctrl`, `Alt`, `Shift` in this order and one key,
	 * `'Ctrl+Shift+M'`. It needs `Ctrl` or `Alt`, or is an F-key alone. `''` is none, and the author may give one.
	 * A key that is taken stays with the one who had it, and one on Backspace, Delete or an arrow stays the text's:
	 * yours stands without one, and the log says so.
	 */
	key: string
	/** The name the settings list it under: 1 to 40 characters, or one per language. */
	label: AddonText
	/** Called on the press, where the shortcut was laid. The press counts as the author pressing. */
	run: () => unknown
}

/** Shortcuts. Every one of them goes when the add-on is switched off. */
interface AddonKeys {
	/** Lays a shortcut, at most 20 per add-on. Refuses one that misses its form. */
	add(shortcut: AddonShortcut): Promise<void>
}

/**
 * A line in the corner of the window, drawn by Regletto in its own shape with your add-on's name before the sentence.
 * A `'done'` line without a button goes by itself after 3 s and 2 s of fading; a failure and a line with a button
 * stay until the author clicks, your next line replaces them, or a strip of Regletto's own takes their place.
 */
interface AddonNotice {
	/** One sentence on one line: 1 to 80 characters, or one per language. */
	text: AddonText
	/** `'done'` (the default), with a tick where it goes by itself, or `'failed'`, with an exclamation mark. */
	kind?: 'done' | 'failed'
	/** One button behind the sentence. */
	action?: {
		/** 1 to 40 characters, or one per language. */
		label: AddonText
		/** Called where `notify()` was called. The press counts as the author pressing. */
		run: () => unknown
	}
}

/** `window.addon`: the whole way an add-on reaches Regletto. Every refusal is a thrown error, never empty data. */
interface Addon {
	/** The language of the window, two letters (`'de'`, `'en'`). Does not change; `onLang()` says when it did. */
	readonly lang: string
	/**
	 * The author changed the language. Regletto translates the frame itself; redraw what you drew.
	 * Every `on…` answers a function that stops listening.
	 */
	onLang(fn: (lang: string) => void): () => void
	/** The author's theme. Does not change; `onTheme()` says when it did. `null` if the program could not read its palettes. */
	readonly theme: AddonTheme | null
	/** The theme changed. The CSS properties on `:root` are already new when this runs. */
	onTheme(fn: (theme: AddonTheme) => void): () => void
	readonly log: AddonLog
	readonly views: AddonViews
	/** The note that travels with the project: `<project>/addons/<id>.json`. */
	readonly store: AddonStore
	/**
	 * The values of the rows in `settings.rows` of addon.json, `{ <id>: value }`. A row nobody touched answers its `default`.
	 * Read, never set: the author sets them in the add-on's own category of the settings window where `settings.category` gives one,
	 * else behind the add-on's card.
	 */
	settings(): Promise<{ [id: string]: any }>
	/** The author changed a setting. The whole set comes along. */
	onSettings(fn: (values: { [id: string]: any }) => void): () => void
	/** In addon.js and panel.js; editor.js has the same as `host.keys`. Not in dialog.js or overlay.js. */
	readonly keys: AddonKeys
	/**
	 * Shows a line in the corner of the window. In addon.js and panel.js; editor.js has the same as `host.notify`.
	 * Not in dialog.js or overlay.js. Your next line replaces it, and it goes when the add-on is switched off.
	 * A strip that waits for the author, Regletto's or another add-on's failure or button, is not displaced:
	 * then nothing shows, and the log says so. A strip of Regletto's own may take your line's place, button and all.
	 * Refuses a line that misses its form.
	 */
	notify(notice: AddonNotice): Promise<void>
}

declare var addon: Addon
interface Window { addon: Addon }
