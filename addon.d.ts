// The core of the add-on API: what every Regletto product calls the same, on
// `window.addon`. What only one product has lies in the declarations of that
// product's SDK (its surfaces and `addon.<product>`), and they refer to this file. Together they
// are the reference on regletto.com/developers.
//
// A call needs no permission unless its note names one. A permission stands in `needs` of
// addon.json with its reason, the sentence the author reads before installing:
// `{ "need": "net", "why": "Downloads the model that reads a picture." }`. The core's permissions,
// `workspace` and `net`, carry no prefix; a product's carry the product's key from `engines`
// and a colon, `<key>:read`.

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

/** A row of the right-click menu of a list or a grid that does something. */
interface AddonMenuChoice {
	id: string
	/** One language, or one per language. */
	label: AddonText
	/** A name from Material Symbols Rounded. */
	icon?: string
	/** A key shown at the right edge, `'Ctrl+D'`. Only shown: `addon.keys` lays a shortcut. */
	key?: string
	/** Called on the pick. */
	on?: () => void
	part?: never
}

/** A parting line between two rows. */
interface AddonMenuParting {
	part: true
}

/** One row of a right-click menu: a choice, or a parting line. */
type AddonMenuRow = AddonMenuChoice | AddonMenuParting

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

/** One entry of a folder, as `files.list()` answers it. */
type AddonFileEntry =
	| { name: string; kind: 'file'; size: number }
	| { name: string; kind: 'folder' }

/**
 * The add-on's own folder on this machine, `<userData>/addons-data/<id>/`: what it downloaded or made, never the author's files.
 * It stays when the add-on is switched off or updated, and goes to the recycle bin when it is removed. Needs no permission.
 *
 * A path is relative, with `/` between its parts: at most 8 parts and 120 characters, none of `\ < > : " | ? *`
 * and no control or format character, no part ending in a dot or a space, and no part named for a Windows device,
 * with or without an extension: `con`, `nul`, `aux.json` and `com1.txt` are all refused. So is a part ending in
 * `.<digits>-<digits>.part`, like `model.bin.1-2.part`: that name is Regletto's own, for a file on its way in.
 * One file holds at most 128 MB; the folder at most 1 GB and 10 000 files. A refusal is thrown and names no path of this machine.
 */
interface AddonFiles {
	/** The file as bytes, or `null` where nothing is there. A folder is refused. */
	read(path: string): Promise<ArrayBuffer | null>
	/** The file as UTF-8 text, or `null` where nothing is there. */
	read(path: string, as: 'text'): Promise<string | null>
	/** Replaces the file whole, and lays the folders on its way. A string is stored as UTF-8. A folder standing there is refused. */
	write(path: string, data: string | ArrayBuffer | ArrayBufferView): Promise<void>
	/** One level, by name. No path, or `''`, is the folder itself; `null` where no such folder is. A file is refused. */
	list(path?: string): Promise<AddonFileEntry[] | null>
	/** Moves a file, or a folder with everything in it, to the recycle bin. `false` where nothing was there. The folder itself, `''`, is refused. */
	remove(path: string): Promise<boolean>
}

/** What a call to the internet carries besides its address. Any other field is refused. */
interface AddonFetchOptions {
	/** `'GET'` when left out. The answer to a `'HEAD'` has an empty body, whatever its `content-length` says. */
	method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	/**
	 * Names and values as strings. `authorization` stays behind when a redirect leaves the origin.
	 * `connection`, `content-length`, `expect`, `keep-alive`, `transfer-encoding` and `upgrade` are refused: the connection is Regletto's.
	 */
	headers?: { [name: string]: string }
	/** What goes out, at most 128 MB; a string goes as UTF-8. Not with GET or HEAD. */
	body?: string | ArrayBuffer | ArrayBufferView
}

/** What came back. A status of the far side, 404 or 500 say, is an answer and not a refusal. */
interface AddonFetchAnswer<Body> {
	status: number
	/** By lower-case name. */
	headers: { [name: string]: string }
	body: Body
}

/**
 * The internet. Needs `net` in `needs`; the call goes out from Regletto, never from your surface.
 * Only `https:`, and every hop of a redirect too: a redirect to `http:` is refused before anything goes to it,
 * and so is an address with a user or a password in it. At most 20 redirects.
 * An answer holds at most 128 MB, as much as one file in `files`. A call lasts at most 20 minutes, all its hops together,
 * and ends sooner where nothing arrives for 5 minutes. At most four of your calls run at once; a further one waits its turn,
 * and its 20 minutes begin when it goes out. Switching the add-on off, removing it or reloading it stops what is running.
 * What did not arrive is thrown, never an empty answer: the message carries `net.fetch(): offline` where the far side
 * could not be reached (no network, no such name, the line broke), and `net.fetch(): timeout` past either deadline.
 * Every request stands in your log with its method and address, and every call that threw with its address and message,
 * also for an add-on from the store.
 */
interface AddonNet {
	/** The body as UTF-8 text. */
	fetch(address: string, options: AddonFetchOptions & { as: 'text' }): Promise<AddonFetchAnswer<string>>
	/** The body as bytes. */
	fetch(address: string, options?: AddonFetchOptions): Promise<AddonFetchAnswer<ArrayBuffer>>
	/**
	 * Downloads a file straight into your own folder (`files`) at `path`: the way for a file too large for your archive,
	 * a model say. It goes to the disk as it arrives, never whole into memory, and is moved to `path` whole once it arrived
	 * and its checksum held; until then what stood at `path` stays, and if it fails or is stopped nothing stays, not even
	 * a folder on its way. The same rules as `fetch()` (https: on every hop, every request in your log), and at most 128 MB,
	 * as much as one file in `files` holds and `files.read()` carries, within the room the folder has left. No deadline
	 * but a silence of 5 minutes. At most four of your downloads run at once, a further one waits its turn; one per path,
	 * whatever the case of its letters. Switching the add-on off, removing it or reloading it stops them.
	 *
	 * Start it from a click of the author: Regletto never downloads by itself, and a download nobody asked for
	 * spends their bandwidth and their disk.
	 *
	 * Thrown, with its word in the message: `net.download(): status 404` where the far side answered anything but 2xx,
	 * `net.download(): sha256` where the checksum did not hold, `offline`, `timeout`, `stopped`, and a refused path or
	 * a full folder as with `files`.
	 */
	download(address: string, path: string, options?: AddonDownloadOptions): Promise<AddonDownloaded>
	/**
	 * Stops the download into `path`, running or waiting, and answers once it let go of `path`, so a new download into it
	 * may follow at once: `true` where it stopped (it throws `net.download(): stopped`), `false` where there was none or it
	 * was whole before the stop came.
	 */
	stopDownload(path: string): Promise<boolean>
}

/** What a download carries besides its address and path. Any other field is refused. */
interface AddonDownloadOptions {
	/** Called on the first bytes, then at most every 400 ms, and once when all arrived. */
	onProgress?: (progress: AddonDownloadProgress) => void
	/**
	 * The SHA-256 of the file, 64 hexadecimal characters. What arrived otherwise is laid down nowhere.
	 * There is no `signal`: an `AbortSignal` does not cross into Regletto, `stopDownload(path)` stops a download.
	 */
	sha256?: string
}

/** How far a download has come. */
interface AddonDownloadProgress {
	/** The bytes that arrived so far. */
	loaded: number
	/** The bytes the far side announced, `null` where it said nothing. */
	total: number | null
}

/** What a download laid down. */
interface AddonDownloaded {
	/** In bytes. */
	size: number
	/** The SHA-256 of the file, 64 lower-case hexadecimal characters. */
	sha256: string
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
	 * `'Ctrl+Shift+M'`. It needs `Ctrl` or `Alt`, unless it is an F-key. `''` is none, and the author may give one.
	 * A key that is taken stays with the one who had it, and one on Backspace, Delete or an arrow stays the text's:
	 * yours stands without one, and the log says so.
	 * `Ctrl+Alt` with a character (`'Ctrl+Alt+M'`, also with `Shift`) is not given either: on keyboards with AltGr,
	 * the German among them, it types a character and never arrives. With an F-key or Enter it is given.
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

/** The menus of the product's menu bar a row can stand in, by name. The product's declaration names them. */
interface AddonMenus {}

/** What a pick in the menu bar, or a press of the row's `key`, tells `run`. */
interface AddonMenuContext {
	/** The menu the row stands in. */
	menu: keyof AddonMenus
}

/** A row in the list of an entry with `items`. */
interface AddonMenuItem {
	/** a-z, 0-9 and "-", 2 to 64 characters; unique in its list. */
	id: string
	/** 1 to 40 characters on one line, or one per language. */
	label: AddonText
	/** A name from Material Symbols Rounded. */
	icon?: string
	/** Makes the row a switch in this state. Lay the entry again to change it. */
	checked?: boolean
	/** Called where the entry was laid. The pick counts as the author pressing. */
	run(context: AddonMenuContext): unknown
}

interface AddonMenuEntryBase {
	/** The menu it stands in, at its foot behind a line. An add-on lays no menu of its own. */
	menu: keyof AddonMenus
	/** a-z, 0-9 and "-", 2 to 64 characters. The same id again replaces your row, in its place. */
	id: string
	/** 1 to 40 characters on one line, or one per language. */
	label: AddonText
	/** A name from Material Symbols Rounded. */
	icon: string
}

/** A row that does something. */
interface AddonMenuAction extends AddonMenuEntryBase {
	/**
	 * Lays the shortcut of the same id, as `addon.keys.add()` does, with this label and `run`; the key follows its rules.
	 * The row names the key in force, the one the author may have given it.
	 */
	key?: string
	/** Makes the row a switch in this state. Lay the entry again to change it. */
	checked?: boolean
	/** Called where the entry was laid. The pick counts as the author pressing. */
	run(context: AddonMenuContext): unknown
	/** A row with `run` opens no list. */
	items?: never
}

/** A row that opens a list of your own, one level deep. */
interface AddonMenuList extends AddonMenuEntryBase {
	/** 1 to 20 rows. */
	items: AddonMenuItem[]
	/** Each item runs, not the row that opens them. */
	run?: never
	/** A row that opens a list has no shortcut. */
	key?: never
	/** A row that opens a list is no switch. */
	checked?: never
}

/** A row in a menu of the menu bar. */
type AddonMenuEntry = AddonMenuAction | AddonMenuList

/**
 * Rows in the menus of the product's menu bar. Every one of them goes when the add-on is switched off.
 * One laid in addon.js or panel.js is kept: from the next start on it stands before that surface runs,
 * and a pick builds the surface out of sight.
 */
interface AddonMenuBar {
	/**
	 * Adds a row at the foot of `menu`, at most 20 entries per add-on; a row with `key` counts among the add-on's 20 shortcuts too.
	 * Refuses one that misses its form or finds no room, and nothing is laid.
	 */
	add(entry: AddonMenuEntry): Promise<void>
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
	/** One button behind the sentence. The line goes when the surface that called `notify()` closes: its button would press nothing. */
	action?: {
		/** 1 to 40 characters, or one per language. */
		label: AddonText
		/** Called where `notify()` was called. The press counts as the author pressing. */
		run: () => unknown
	}
}

/**
 * The add-on's own background process: worker.js at the root of its folder, asked for with `"worker": true` in addon.json.
 * For work too heavy for a surface, a model say. Regletto starts it on the first call and keeps it; switching the add-on off,
 * removing, updating or reloading it stops it, and the next call after that starts it again.
 */
interface AddonWorker {
	/**
	 * Calls what worker.js serves under `name` with copies of `args`, and answers a copy of what it answered.
	 * Data crosses, a function or a node does not. What the served function threw is thrown, and the message carries
	 * its own; what Regletto says, the message carries as `worker.call():` and a fixed word: `timeout` where the call
	 * took longer than five minutes (the process is then stopped), `stopped` where the process was stopped before it
	 * answered, `crashed` where it ended by itself. A name worker.js does not serve is refused the same way.
	 */
	call<T = unknown>(name: string, ...args: unknown[]): Promise<T>
}

/** Another add-on, as `addon.use()` found it: its version, and the way to ask what it provides. */
interface AddonUse {
	/** Its version, as its addon.json says; for `'program'` the product's own. */
	readonly version: string
	/**
	 * Asks what the other add-on offers under `name`, one of its `provides`, with a copy of `query`, and answers a copy
	 * of what its function answered. Query and answer are plain data, as JSON has it: no function, node, `undefined`,
	 * `Date`, `Map` or `ArrayBuffer`, and at most 16 MB written as JSON. `Answer` is the type the other add-on promises.
	 *
	 * `null` where the other add-on is gone since `use()` (switched off, removed, too old) or where the surface that offers
	 * it does not run now; an offer its worker.js lays as it loads is always reached, since Regletto starts the worker for it.
	 * What its function threw is thrown with its own message. What Regletto refuses carries `use():` in the message: a name not in
	 * its `provides`, a query or an answer that is not plain data, and `use(): timeout` past five minutes.
	 */
	call<Answer = unknown, Query = unknown>(name: string, query?: Query): Promise<Answer | null>
}

/**
 * `window.addon`: the whole way an add-on reaches Regletto. Every refusal is a thrown error, never empty data.
 * Of the core, worker.js has only `serve`, `provide`, `use`, `files`, `net` and `log`; overlay.js only `lang`, `theme`,
 * `views` and `log`.
 */
interface Addon {
	/** The language of the window, two letters (`'de'`, `'en'`). Does not change; `onLang()` says when it did. */
	readonly lang: string
	/**
	 * The author changed the language. Regletto translates the frame itself; redraw what you drew.
	 * Every `on…` answers a function that stops listening. Not in overlay.js or worker.js.
	 */
	onLang(fn: (lang: string) => void): () => void
	/** The author's theme. Does not change; `onTheme()` says when it did. `null` if the program could not read its palettes. */
	readonly theme: AddonTheme | null
	/** The theme changed. The CSS properties on `:root` are already new when this runs. Not in overlay.js or worker.js. */
	onTheme(fn: (theme: AddonTheme) => void): () => void
	readonly log: AddonLog
	readonly views: AddonViews
	/** The note that travels with the project: `<project>/addons/<id>.json`. Not in overlay.js or worker.js. */
	readonly store: AddonStore
	/** The add-on's own folder for files, a downloaded model say. In addon.js, panel.js, dialog.js and worker.js; not in overlay.js, and editor.js has none. */
	readonly files: AddonFiles
	/**
	 * The internet, with `net` in needs: a service to ask, a model to download into `files`.
	 * In addon.js, panel.js, dialog.js and worker.js; not in overlay.js, and editor.js has none.
	 */
	readonly net: AddonNet
	/** The add-on's worker.js, with `"worker": true` in addon.json. In addon.js, panel.js and dialog.js; not in overlay.js, and editor.js has none. */
	readonly worker: AddonWorker
	/**
	 * In worker.js only. Serves `name` to `addon.worker.call(name, …args)`: `answer` gets copies of the arguments, and what it
	 * answers, or what its promise resolves to, goes back as a copy. The same name again replaces it; the function returned
	 * stops serving it. A name is a-z, 0-9 and "-", 2 to 64 characters. An argument without a declared type is `unknown`,
	 * since any caller may send anything: declare it, `(text: string) => …`.
	 *
	 * worker.js runs in a process of its own, as CommonJS: `require` gives `assert`, `buffer`, `crypto`, `events`,
	 * `string_decoder`, `util` and `zlib` of Node, and the add-on's own .js and .json files by `./`, named with their extension.
	 * There it has `addon.serve`, `addon.provide`, `addon.use`, `addon.files`, `addon.net` and `addon.log`, and no `process`,
	 * `fetch`, `WebSocket` or `__filename`.
	 * Its console and every error nobody caught go to the add-on's log; a stack names its files and no folder of the machine.
	 */
	serve<Args extends unknown[] = unknown[]>(name: string, answer: (...args: Args) => unknown): () => void
	/**
	 * Hands `answer` to other add-ons under `name`, one of `provides` in addon.json; they reach it with `addon.use()`.
	 * In addon.js, panel.js and worker.js: one of addon.js or panel.js is answered while that surface stands, one of
	 * worker.js whenever asked, since Regletto starts the worker for it and asks once worker.js has loaded, so lay it as
	 * worker.js loads, before anything it awaits. `answer` gets a copy of the query and answers
	 * plain data, or a promise of it; what it throws, the one who asked gets thrown. Answer at once, as a call waits
	 * five minutes at most. The same name again replaces the offer, the function returned withdraws it, and every offer
	 * goes when the add-on is switched off, removed or reloaded. Refuses a name that is not in `provides`.
	 */
	provide<Query = unknown, Answer = unknown>(name: string, answer: (query: Query) => Answer | Promise<Answer>): Promise<() => void>
	/**
	 * Another add-on, where it is there: `id` stands in `uses` of addon.json with the lowest version you read, and
	 * nothing installs it along. `null` where it is not installed, switched off, older than `uses` asks or provides nothing:
	 * the normal case, never an error and no line in any log. `'program'` needs no entry in `uses` and reaches what the
	 * product offers itself. In addon.js, panel.js, dialog.js and worker.js; not in overlay.js, and editor.js has none.
	 * Refuses an id that is not in `uses`. Reading another add-on needs no permission; its store stays its own.
	 */
	use(id: string): Promise<AddonUse | null>
	/**
	 * The values of the rows in `settings.rows` of addon.json, `{ <id>: value }`. A row nobody touched answers its `default`.
	 * Read, never set: the author sets them in the add-on's own category of the settings window where `settings.category` gives one,
	 * else behind the add-on's card. Not in overlay.js or worker.js.
	 */
	settings(): Promise<{ [id: string]: any }>
	/** The author changed a setting. The whole set comes along. Not in overlay.js or worker.js. */
	onSettings(fn: (values: { [id: string]: any }) => void): () => void
	/** In addon.js and panel.js; editor.js has the same as `host.keys`. Not in dialog.js or overlay.js. */
	readonly keys: AddonKeys
	/** In addon.js and panel.js; editor.js has the same as `host.menu`, with `when` and `checked` asked as the menu opens. Not in dialog.js or overlay.js. */
	readonly menu: AddonMenuBar
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
