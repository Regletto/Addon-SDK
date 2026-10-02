// addon.json: the manifest every add-on carries, and the one check that decides
// whether Regletto Writing takes it.
//
// This file is shared. Writing runs it when it installs or loads an add-on, and
// the SDK (`regletto check`) ships a copy of it, so what the SDK accepts is what
// Writing accepts. The copy in the SDK is refreshed by `npm run sync` and is
// never edited by hand.
//
// read() takes the text of addon.json, not a path: the caller already has the
// file (from a disk, an unpacked archive or a catalog entry). No window, no
// filesystem, a pure function in and out.

const FIELD_NAME_RE = /^[A-Za-z0-9_-]{1,40}$/
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/
// `<publisher>.<name>`. The id becomes a folder name, so the whole of it is held
// to 64 characters, and a name of `part` is refused because `<id>.part` is the
// folder an install is written into.
const ID_RE = /^(?=.{5,64}$)(?!.*\.part$)[a-z0-9][a-z0-9-]{1,63}\.[a-z0-9][a-z0-9-]{1,63}$/
const ICON_RE = /^[a-z0-9_]{1,40}$/
const VERSION_RE = /^\d+\.\d+\.\d+$/
const ENGINE_RE = /^>=\d+\.\d+\.\d+$/
const PRODUCT_RE = /^[a-z][a-z0-9-]{1,19}$/
// This program's own key in `engines`. A product reads its key and no other.
const PRODUCT = 'writing'
// The permissions an add-on can ask for in `needs`. Without a prefix a permission
// belongs to the core, which every product has; a prefix (`writing:`) marks what
// only one product knows. `store`, `settings`, `log`, `theme` and `lang` ask for
// nothing: they only hand an add-on its own data.
const NEEDS = ['workspace', 'writing:read', 'writing:suggest']

// A harmless single line has no control, format, surrogate or private-use
// character. That is the four named categories (Cc, Cf, Cs, Co) and not the
// wider \p{C}, which also matches Cn, a code point that is merely unassigned: an
// emoji from a newer Unicode version would be refused for good on an Electron
// that has not caught up. Every bidirectional override is Cf, so a separate
// check for them would only repeat this one.
const CONTROL_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u
const harmless = (v, max) => {
	if (typeof v !== 'string' || CONTROL_RE.test(v) || v.trim().length === 0) return false
	// Length is counted in code points ([...v].length), not in the UTF-16 units
	// v.length gives: an emoji is two units and one character. Grapheme clusters
	// would need Intl.Segmenter; a letter carrying dozens of combining marks still
	// counts as one here. That is accepted, since the worst it produces is one
	// overlong glyph, and the rail clips overflow anyway.
	const points = [...v].length
	return points >= 1 && points <= max
}

// `title` becomes an aria-label and a sentence in the warning dialog, and a
// string can pass harmless() while saying nothing, filled with invisible
// characters that no control-character check catches (a Braille blank, say).
// Chasing character classes only finds the ones already known, so the rule is
// a positive one: somewhere in the string is a letter or a number. It still
// misses oddities, on purpose. Hangul Filler (U+3164) renders as nothing but is
// General_Category=Lo, a letter, so it passes. No rule of this shape closes
// every invisible case.
const SAYS_SOMETHING_RE = /[\p{L}\p{N}]/u
const meaningfulTitle = (v) => harmless(v, 40) && SAYS_SOMETHING_RE.test(v)

// Text an add-on may write in several languages. `title` and `description` are
// the two of the eight fields that become prose on screen; the others are an id,
// a version, a person, an engine bound and an icon, none of which changes with
// the language of the reader. Rows of `settings` and the `panel` use it too.
//
// The shape is a plain string, or a map of language keys to strings:
//
//   "title": "Figuren"
//   "title": { "de": "Figuren", "en": "Characters" }
//
// The string stays the short form and is not deprecated: most add-ons are
// written in one language by one person. Both forms are resolved to a plain
// string by pick() below, so after read() nothing else in the program ever sees
// a map.
//
// The keys are checked for their shape and not against the languages Writing
// ships. An add-on may offer Italian before Writing does; that entry is simply
// never picked, which is a smaller fault than refusing the manifest over a
// language that might be shipped next month. The key is the two-letter interface
// language of settings.json, so `de` and not `de-DE`.
const LANG_KEY_RE = /^[a-z]{2}$/
// An empty map is refused: `{}` is well formed, present and says nothing, and
// pick() would have nothing to fall back to.
const spoken = (v, one) =>
	v !== null && typeof v === 'object' && !Array.isArray(v) &&
	Object.keys(v).length > 0 &&
	Object.entries(v).every(([key, said]) => LANG_KEY_RE.test(key) && one(said))

// Either form, each string held to the rule it would be held to alone.
const said = (one) => (v) => one(v) || spoken(v, one)

// Which language the reader gets. It never answers nothing, because a field that
// reached this point passed said(), so a map has at least one entry.
//
// The order is the reader's language, then English, then whatever is there.
// English is the language every add-on author is assumed to write, which keeps
// a German Writing from showing an Italian name just because the add-on is
// written in Italian and Spanish. `lang` is the two-letter interface language;
// an unknown one is not a fault and falls through to English.
function pick (value, lang) {
	if (typeof value === 'string') return value
	if (!value || typeof value !== 'object') return ''
	return value[lang] ?? value.en ?? Object.values(value)[0]
}

// Every refusal has a fixed code, the same in Writing, in the SDK and on
// regletto.com/developers/errors/<code>.
//
//   RA001  the text is not valid JSON
//   RA002  a field, or the whole file, does not have the required shape
//   RA003  a required field is missing
//   RA004  a field that does not exist
//   RA005  the manifest is whole, but Writing is older than `engines` asks
//   RA006  the `id` cannot be a folder name (a device name, say)
//   RA007  the archive holds another add-on than the catalog entry asked for
//   RA008  `engines` names no key for this product
//   RA009  a folder with the old `regletto.json`, built for an older version
//
// The next six concern the folder or the archive around the manifest. The SDK
// raises them before an archive exists:
//
//   RA010  no addon.json at the root of the folder or the archive
//   RA011  a surface the manifest asks for has no file: addon.js for
//          `workspace`, panel.js for `panel`
//   RA012  a path cannot be laid down: a character Windows refuses, a device
//          name, a trailing dot or space, deeper than 8 or longer than 120
//   RA013  more than 10 000 files
//   RA014  more than 256 MB unpacked
//   RA015  the archive is over 32 MB
const CODES = {
	noJson: 'RA001',
	form: 'RA002',
	missing: 'RA003',
	unknown: 'RA004',
	engine: 'RA005',
	name: 'RA006',
	mismatch: 'RA007',
	product: 'RA008',
	old: 'RA009',
	noManifest: 'RA010',
	noEntry: 'RA011',
	entry: 'RA012',
	tooMany: 'RA013',
	tooBig: 'RA014',
	tooLarge: 'RA015'
}

// One predicate per required field. read() walks this object in order and stops
// at the first field that fails, so this is also the order a broken manifest is
// explained in.
const FIELDS = {
	id: (v) => typeof v === 'string' && ID_RE.test(v),
	// `title` and `description` may also be a map of languages, see said() above.
	// The rule per string is the same whether one stands there or five: a
	// 40-character title in German is a 40-character title in English.
	title: said(meaningfulTitle),
	description: said((v) => harmless(v, 200)),
	version: (v) => typeof v === 'string' && VERSION_RE.test(v),
	author: (v) => harmless(v, 60),
	// One range per product, `{ "writing": ">=0.9.0" }`. Another product's key is
	// read as well formed and left alone: read() asks for its own below.
	engines: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
		Object.keys(v).length > 0 &&
		Object.entries(v).every(([product, range]) => PRODUCT_RE.test(product) && typeof range === 'string' && ENGINE_RE.test(range)),
	icon: (v) => typeof v === 'string' && ICON_RE.test(v),
	needs: (v) => Array.isArray(v) && v.every((need) => NEEDS.includes(need))
}

// `settings`: what the author can set, as a list of rows. An optional field that
// stands in the manifest and not in addon.js because the setup that follows
// installing an add-on asks for it before addon.js has ever run. A row has the
// fields of a row in Writing's own settings window, plus `first`:
//
//   { "id": "goal", "group": "Ziel", "type": "number", "label": "Wörter am Tag",
//     "hint": "…", "default": 500, "min": 100, "max": 5000, "offer": [250, 500],
//     "first": true }
//
// Five of the settings window's ten row types are open to add-ons. `path` would
// reach a folder an add-on never sees, `keys` belongs to the shortcut editor, and
// `action`, `info` and `grammar` show what the program itself knows.
//
// The same two rules as the eight fields: an unknown key in a row is a refusal,
// and every string that becomes text on screen is held to harmless() or is a map
// of languages, which pick() resolves like it does for `title`.
const MOST_ROWS = 40
const MOST_TEXT = 200
const COMMON = ['id', 'group', 'type', 'label', 'hint', 'default', 'first']
const label = said((v) => harmless(v, 60))
const aside = said((v) => harmless(v, 200))
const heading = said((v) => harmless(v, 40))
const option = (v) =>
	v !== null && typeof v === 'object' && !Array.isArray(v) &&
	Object.keys(v).every((key) => key === 'value' || key === 'label') &&
	typeof v.value === 'string' && FIELD_NAME_RE.test(v.value) && heading(v.label)
const choices = (least, most) => (v) =>
	Array.isArray(v) && v.length >= least && v.length <= most && v.every(option) &&
	new Set(v.map((one) => one.value)).size === v.length

// What each type demands beside the common fields. Nothing else may stand.
const TYPES = {
	switch: {},
	segment: { options: choices(2, 4) },
	select: { options: choices(2, 50) },
	number: {
		min: Number.isInteger,
		max: Number.isInteger,
		offer: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 10 && v.every(Number.isInteger)
	},
	text: {}
}
// Fields a row may leave out. `offer` is the one type field among them: a number
// row without the values behind the chevron is a field alone.
const OPTIONAL = new Set(['group', 'hint', 'first', 'offer'])

// Does this value belong in this row? Two callers ask: read() holds `default` to
// it, and Writing holds the author's stored value to it. A stored value that
// misses its row is read as the default there, not as damage.
function fits (row, v) {
	switch (row.type) {
		case 'switch': return typeof v === 'boolean'
		case 'segment':
		case 'select': return row.options.some((one) => one.value === v)
		case 'number': return Number.isInteger(v) && v >= row.min && v <= row.max
		case 'text': return typeof v === 'string' && !CONTROL_RE.test(v) && [...v].length <= MOST_TEXT
		default: return false
	}
}

function soundRow (row) {
	if (row === null || typeof row !== 'object' || Array.isArray(row)) return false
	if (!Object.hasOwn(TYPES, row.type)) return false
	const own = TYPES[row.type]
	if (!Object.keys(row).every((key) => COMMON.includes(key) || Object.hasOwn(own, key))) return false
	if (typeof row.id !== 'string' || !FIELD_NAME_RE.test(row.id) || !label(row.label)) return false
	if (row.group !== undefined && !heading(row.group)) return false
	if (row.hint !== undefined && !aside(row.hint)) return false
	if (row.first !== undefined && typeof row.first !== 'boolean') return false
	for (const [key, ok] of Object.entries(own)) {
		if (row[key] === undefined ? !OPTIONAL.has(key) : !ok(row[key])) return false
	}
	if (row.type === 'number' && (row.min > row.max || (row.offer ?? []).some((n) => n < row.min || n > row.max))) return false
	return fits(row, row.default)
}

const soundSettings = (v) =>
	Array.isArray(v) && v.length >= 1 && v.length <= MOST_ROWS && v.every(soundRow) &&
	new Set(v.map((row) => row.id)).size === v.length

// `panel`: the panel an add-on brings for the side column. It stands in the
// manifest for the reason `settings` does: the setup after installing asks
// whether it goes into the rail before any code of the add-on has run.
//
//   "panel": { "icon": "today", "label": "Heute", "about": "Was heute geschrieben wurde." }
//
// Three fields and no fourth: the sign in the rail, the name, and the one line
// the side column's dialog shows under its list. `label` and `about` may be maps
// of languages. What stands in the opened panel is the add-on's own: panel.js
// draws it.
const PANEL_FIELDS = ['icon', 'label', 'about']
const soundPanel = (v) =>
	v !== null && typeof v === 'object' && !Array.isArray(v) &&
	Object.keys(v).every((key) => PANEL_FIELDS.includes(key)) &&
	typeof v.icon === 'string' && ICON_RE.test(v.icon) &&
	said((one) => harmless(one, 40))(v.label) && aside(v.about)

// The fields beside the eight, each of which may be left out. An unknown field
// is still a refusal; an absent one is not.
const EXTRA = {
	settings: soundSettings,
	panel: soundPanel
}

// `$schema` is the one field that is allowed and ignored. The templates write it
// so an editor can complete and check the file; read() drops it, so nothing past
// that point ever sees it.
const IGNORED = '$schema'

// Resolves the language maps of a settings row to plain strings, see read().
const spokenRow = (row, lang) => ({
	...row,
	label: pick(row.label, lang),
	...(row.group === undefined ? {} : { group: pick(row.group, lang) }),
	...(row.hint === undefined ? {} : { hint: pick(row.hint, lang) }),
	...(row.options ? { options: row.options.map((one) => ({ value: one.value, label: pick(one.label, lang) })) } : {})
})

// Compares two versions of the form major.minor.patch. Three plain numbers need
// no semver dependency. Not exported: read() validates engineVersion before this
// runs, so the one thing worth guarding against (an unparsable version turning
// into NaN, which compares false against everything) cannot reach it. A caller
// with a version of its own and no such validation exports this itself rather
// than reopening that gap.
function compareVersions (a, b) {
	const pa = a.split('.').map(Number)
	const pb = b.split('.').map(Number)
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] - pb[i]
	}
	return 0
}

// Judges the text of an addon.json.
//
//   read(text, engineVersion, lang)
//
// `text` is the file as a string. A Buffer has an encoding to decide, which
// belongs to whoever unpacked the archive, not here. `engineVersion` is the
// running program's own version, "major.minor.patch". Both are a contract on the
// caller and a broken one throws, on purpose: silence already means something
// else here (a rejected manifest, or an engine too old), and a caller's bug must
// not read as either.
//
// `lang` is the interface language, two letters, and it is optional: left out it
// means English. The language maps of `title`, `description`, `settings` and
// `panel` are resolved here, so everything past this function sees plain
// strings, exactly as before an add-on could say them twice. Resolving in the
// one reader beats teaching every screen that shows a card about a second shape.
// A tool that only asks "is this manifest sound" need not have an opinion about
// the reader.
//
// It answers `{ ok: true, manifest }`, or `{ ok: false, error: { code, ... } }`
// with the codes above. The too-old answer (RA005) carries the manifest as well,
// since the installed view draws that card disabled, with its title and its
// sentence on it, and `error.need`, the version `engines` asked for.
function read (text, engineVersion, lang) {
	if (typeof engineVersion !== 'string' || !VERSION_RE.test(engineVersion)) {
		throw new TypeError(
			`manifest.read: engineVersion must look like "major.minor.patch", got ${JSON.stringify(engineVersion)}`)
	}
	if (typeof text !== 'string') {
		throw new TypeError(
			`manifest.read: text must be a string, not ${text?.constructor?.name ?? typeof text} — decode it first, e.g. buffer.toString('utf8')`)
	}

	// Notepad and PowerShell put a byte order mark at the start of a file meant to
	// be edited by hand, and JSON.parse trips over it. Done ahead of the try below
	// because neither charCodeAt nor slice can throw on a string, and a try body
	// should only hold what can raise the error its catch is written for.
	const withoutBom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text

	let parsed
	try {
		parsed = JSON.parse(withoutBom)
	} catch {
		return { ok: false, error: { code: CODES.noJson } }
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { ok: false, error: { code: CODES.form } }
	}

	// Unknown fields are checked before the eight fields themselves, so a typo
	// (`tittle` beside a missing `title`) is named as the stray key it is and not
	// read as that field silently missing.
	for (const field of Object.keys(parsed)) {
		if (field !== IGNORED && !Object.hasOwn(FIELDS, field) && !Object.hasOwn(EXTRA, field)) {
			const error = { code: CODES.unknown }
			// The field name of a rejected manifest ends up in a message shown to an
			// author. An unbounded string of somebody else's choosing does not belong
			// there, so only a name that itself looks like a field name is kept.
			if (FIELD_NAME_RE.test(field)) error.field = field
			return { ok: false, error }
		}
	}

	for (const [field, ok] of Object.entries(FIELDS)) {
		if (!Object.hasOwn(parsed, field)) return { ok: false, error: { code: CODES.missing, field } }
		if (!ok(parsed[field])) return { ok: false, error: { code: CODES.form, field } }
	}
	for (const [field, ok] of Object.entries(EXTRA)) {
		if (Object.hasOwn(parsed, field) && !ok(parsed[field])) return { ok: false, error: { code: CODES.form, field } }
	}
	// Another product's add-on is not a broken one: `engines` is well formed and
	// simply holds no key for this program, so the add-on does not run here. No
	// manifest travels with this answer, because there is no card to draw.
	if (!Object.hasOwn(parsed.engines, PRODUCT)) {
		return { ok: false, error: { code: CODES.product, field: 'engines' } }
	}
	delete parsed[IGNORED]

	// Both fields are settled before either return below, because the too-old
	// answer carries a manifest too. `parsed` is this function's own, straight out
	// of JSON.parse and held by nobody else, so it is written in place rather than
	// copied.
	parsed.title = pick(parsed.title, lang)
	parsed.description = pick(parsed.description, lang)
	if (parsed.settings) parsed.settings = parsed.settings.map((row) => spokenRow(row, lang))
	if (parsed.panel) parsed.panel = { ...parsed.panel, label: pick(parsed.panel.label, lang), about: pick(parsed.panel.about, lang) }

	// Not a form error: the manifest is valid, the add-on just needs a newer
	// Writing. `ok` stays false and the code is RA005, distinct from every other
	// rejection. `need` is the version `engines` asked for, already cut from its
	// `>=` prefix, so a caller building a hint for the author does not slice the
	// field again.
	const required = parsed.engines[PRODUCT].slice(2) // strips the leading ">="
	if (compareVersions(engineVersion, required) < 0) {
		return { ok: false, manifest: parsed, error: { code: CODES.engine, need: required } }
	}

	return { ok: true, manifest: parsed }
}

// Beside read(), the predicates and patterns are exported because Writing's
// workspace descriptions (a title and up to 58 labels an add-on hands over at
// runtime) are the same kind of text as addon.json: words a stranger wrote that
// appear on this program's screen. One rule written once, rather than two
// copies to keep in step. The same goes for the language maps, so an add-on that
// may name itself in two languages in the manifest may do so in its side column
// too.
module.exports = { read, fits, harmless, meaningfulTitle, said, pick, NAME_RE, ID_RE, ICON_RE, CODES }
