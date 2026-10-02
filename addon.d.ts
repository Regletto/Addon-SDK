// The core of the add-on API: what every Regletto product calls the same, on
// `window.addon`. What only one product has lies in the declarations of that
// product's SDK, on `addon.<product>`, and they refer to this file. Together they
// are the reference on regletto.com/developers.

/**
 * A string in one language, or one per language: `{ de: 'Figuren', en: 'Characters' }`.
 * Regletto picks the author's language, then English, then the first one.
 */
type AddonText = string | { [language: string]: string }

/** An entry of the workspace's side column or a button in its head. */
interface AddonFrameItem {
	/** Comes back in `addon.onFrame()`. Same form as an id part of the manifest. */
	id: string
	/** 1 to 40 characters on one line, or one per language. */
	label: AddonText
	/** A name from Material Symbols Rounded. */
	icon?: string
}

/** What stands in the frame around the workspace. A second call replaces the first whole. */
interface AddonWorkspace {
	/** 1 to 40 characters, or one per language. */
	title: AddonText
	/** At most 50 rows. `[]` gives the surface the whole width. */
	sidebar: AddonFrameItem[]
	/** At most 8 buttons in the head. */
	buttons: AddonFrameItem[]
}

/** A dialog over the window. Regletto draws the frame, dialog.js the surface. */
interface AddonDialog {
	/** 1 to 40 characters, or one per language. */
	title: AddonText
	/** 1 to 80 characters beside the title, or one per language. */
	note?: AddonText
	/** 1 or 2 buttons at the foot. `addon.onButton()` in dialog.js hears them. */
	buttons: { id: string; label: AddonText; primary?: boolean }[]
	/** 360 to 960 by 240 to 720 points. */
	size: { width: number; height: number }
}

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

	/** @deprecated Goes in 2.0.0. Use `cover`. */
	face(source?: string | Node, small?: boolean): HTMLElement
	/** @deprecated Goes in 2.0.0. Use `icon`. */
	mark(symbol: string, small?: boolean): HTMLElement
	/** @deprecated Goes in 2.0.0. Use `note`. */
	say(value: AddonPart): HTMLElement
	/** @deprecated Goes in 2.0.0. Use `count`. */
	tally(value: AddonPart): HTMLElement
	/** @deprecated Goes in 2.0.0. Use `badge`. */
	ribbon(value: AddonPart): HTMLElement
	/** @deprecated Goes in 2.0.0. Use `dot`. */
	pip(colour?: string): HTMLElement
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
	/** The values of `settings` in addon.json, `{ <id>: value }`. A row nobody touched answers its `default`. Read, never set. */
	settings(): Promise<{ [id: string]: any }>
	/** The author changed a setting. The whole set comes along. */
	onSettings(fn: (values: { [id: string]: any }) => void): () => void

	/** Needs `workspace`; in addon.js only. Says what stands in the frame. A description that misses its form is refused whole. */
	workspace(spec: AddonWorkspace): Promise<void>
	/** In addon.js only. A row of the side column or a button of the head was pressed. */
	onFrame(fn: (id: string) => void): () => void
	/** @deprecated Goes in 2.0.0. Use `onFrame`. */
	onPick(fn: (id: string) => void): () => void
	/**
	 * In addon.js and panel.js. Lays overlay.js over the whole window for at most 6 s.
	 * `data` at most 4 KB as JSON, `say` 1 to 40 characters for screen readers.
	 */
	overlay<T>(data: T, options?: { say?: AddonText }): Promise<void>
	/**
	 * In addon.js and panel.js, only while the author presses something.
	 * Answers what dialog.js hands `addon.close()`, `null` for the cross, Esc or a click beside it.
	 */
	dialog<T = unknown>(spec: AddonDialog): Promise<T | null>

	/** In dialog.js only. A button of the frame was pressed. */
	onButton(fn: (id: string) => void): () => void
	/**
	 * In dialog.js and overlay.js. Ends the dialog, and `value` is what `addon.dialog()` answers;
	 * ends the overlay before its 6 s, which needs no value.
	 */
	close<T>(value?: T): Promise<void>
	/** In overlay.js only. The `data` handed to `addon.overlay()`; cast it to the type you handed in. */
	readonly overlayData: unknown
	/** @deprecated Goes in 2.0.0. Use `close`. */
	done(): Promise<void>
}

declare var addon: Addon
interface Window { addon: Addon }
