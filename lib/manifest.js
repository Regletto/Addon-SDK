// addon.json — the eight fields an add-on must carry, checked before
// anything else happens with it. See Notion › Add-on-Plattform › Der Standard
// for the table this file builds against; nothing here invents a field or a
// shape of its own.
//
// Takes the raw text of addon.json, not a path — the caller already has
// the file (an unpacked release ZIP, a catalog entry, disk), and a second way
// to read it would be one way too many. No window, no filesystem: a pure
// function in and out, like src/zip.js.

const FIELD_NAME_RE = /^[A-Za-z0-9_-]{1,40}$/
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/
// **`<publisher>.<name>`, and the whole of it is a folder name**, so it is held to
// the 64 characters a bare name had: the path arithmetic in addons.js stays as it
// was measured. A name of `part` is left out because `<id>.part` is the folder an
// install is written into.
const ID_RE = /^(?=.{5,64}$)(?!.*\.part$)[a-z0-9][a-z0-9-]{1,63}\.[a-z0-9][a-z0-9-]{1,63}$/
const ICON_RE = /^[a-z0-9_]{1,40}$/
const VERSION_RE = /^\d+\.\d+\.\d+$/
const ENGINE_RE = /^>=\d+\.\d+\.\d+$/
const PRODUCT_RE = /^[a-z][a-z0-9-]{1,19}$/
// **This program's own key in `engines`.** A product reads its key and no other.
const PRODUCT = 'writing'
// **A prefix stands before everything only one product knows**; without one it
// is the core (Notion › Der Standard › Die Erlaubnisse). `store`, `settings`,
// `log`, `theme` and `lang` ask nothing: they hand an add-on its own data.
const NEEDS = ['workspace', 'writing:read', 'writing:suggest']

// A harmless single line: no control, format, surrogate or private-use
// character. Deliberately the four named categories (Cc, Cf, Cs, Co) and not
// the wider \p{C} shorthand, which also covers Cn — an unassigned codepoint —
// and would reject a character Unicode has not reached yet rather than one
// this program has reason to distrust: an emoji new to a later Unicode
// version would fail here forever, on an Electron that simply has not been
// updated. Every bidi override is Cf, so a separate bidi check would only
// repeat this one.
const CONTROL_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u
const harmless = (v, max) => {
  if (typeof v !== 'string' || CONTROL_RE.test(v) || v.trim().length === 0) return false
  // Counted in code points ([...v].length), not the UTF-16 units v.length
  // gives — an emoji is two units and one character — and not grapheme
  // clusters either, which would need Intl.Segmenter: a base letter carrying
  // dozens of combining marks still counts as one code point here. That gap
  // is deliberate, not missed — the worst it produces is one overlong glyph,
  // and the rail already clips overflow; a segmenter is a line of its own
  // for an edge nothing here is guarding against.
  const points = [...v].length
  return points >= 1 && points <= max
}

// title becomes an aria-label and a sentence in the warning dialog, and a
// string can pass harmless() while saying nothing at all, filled entirely
// with invisible characters no control-character check catches — a Braille
// blank is one. Chasing character classes only ever finds the ones already
// known, so the rule is a positive one instead: somewhere in the string is a
// letter or a number. That still misses a genuine oddity, and on purpose:
// Hangul Filler (U+3164) renders as nothing but is General_Category=Lo, a
// letter, so it passes this rule too — no rule of this shape closes every
// invisible case, and test/manifest.js documents this one rather than
// hiding it.
const SAYS_SOMETHING_RE = /[\p{L}\p{N}]/u
const meaningfulTitle = (v) => harmless(v, 40) && SAYS_SOMETHING_RE.test(v)

// **The two fields an add-on may say twice** — `title` and `description`, the
// only two of the eight that become prose on this program's screen. The other
// six are an id, a version, a person, an engine bound and an icon: none of them
// is a sentence, and none of them changes with the language of the reader.
//
// The shape is the one Notion › Design-Referenz › Offen named while this was still open: a
// plain string, or a map of language keys to strings.
//
//   "title": "Figuren"
//   "title": { "de": "Figuren", "en": "Characters" }
//
// **The string stays the short form and is not deprecated.** Most add-ons are
// written in one language by one person, and demanding a map of one entry from
// them would be ceremony. Both forms are read by pick() below, and after read()
// nothing in this program ever sees the map — see the note there.
//
// **The keys are checked for their shape and not against src/texts/.** An add-on
// may offer Italian before Regletto does; that entry is then simply never picked,
// which is a smaller fault than refusing the whole manifest over a language we
// might ship next month. It is the same two-letter key the interface language
// carries in settings.json, so `de` and not `de-DE` — the interface has one file
// per language, and a book's `de-DE` is a different question (src/profiles.js).
const LANG_KEY_RE = /^[a-z]{2}$/
// An empty map is refused: `{}` would be a field that is present, well-formed
// and says nothing at all, and pick() would have nothing to fall back to. A
// missing field and a field that names no language are the same fault, so they
// get the same answer.
const spoken = (v, one) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.entries(v).every(([key, said]) => LANG_KEY_RE.test(key) && one(said))

// Either form, held to the same rule per string it would be held to alone.
const said = (one) => (v) => one(v) || spoken(v, one)

// **Which of the two the reader gets**, and it never answers nothing: a field
// that reached this point passed `said()`, so a map has at least one entry.
//
// The order is the author's language, then English, then whatever is there. The
// middle step is what keeps a German Regletto from showing an Italian name
// merely because the add-on is Italian and Spanish: English is the language this
// program assumes every add-on author can write, and it is the one Notion › Add-on-Schnittstelle
// asks for beside the author's own.
//
// `lang` is the interface language — two letters — and an unknown one is not a
// fault here: it falls through to English like any language the add-on did not
// name.
function pick (value, lang) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return value[lang] ?? value.en ?? Object.values(value)[0]
}

// **Every refusal has a fixed code**, the same in the program, in the SDK and on
// regletto.com/developers/errors/<code>. The words they replace are `noJson`,
// `form`, `missing`, `unknown`, `engine`, `name` and `mismatch`. Written once
// here: the SDK reads this file, so it reads this table.
//
//   RA001  the text is not valid JSON
//   RA002  a field, or the whole file, does not have the required shape
//   RA003  a required field is missing
//   RA004  a field that does not exist
//   RA005  the manifest is whole, the program is older than `engines` asks
//   RA006  the `id` cannot be a folder name (a device name, say)
//   RA007  the archive holds another add-on than the catalog entry asked for
//   RA008  `engines` names no key for this product
//   RA009  a folder with the old `regletto.json`: built for an older version
//
// **And six for the folder and the archive around the manifest** — 1 October
// 2026, for `regletto check` in the SDK, which refuses them before an archive
// exists. They stand in this table and nowhere else, so the program, the SDK and
// the page explaining them say the same code; addons.js still answers its own
// words (`noManifest`, `entry`, `tooBig` …) until it is moved over to these.
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

// One predicate per field, in the order the Standard
// lists them — read() walks this object and stops at the first field that
// fails, so the order here is the order a broken manifest gets explained in.
// The shape mirrors VALID in settings.js: a name-to-predicate map and a loop
// over it, nothing more.
const FIELDS = {
  id: (v) => typeof v === 'string' && ID_RE.test(v),
  // **The two that may also be a map of languages** — see said() above. The rule
  // per string is unchanged, and it is the same rule whether one stands there or
  // five: a 40-character title in German is a 40-character title in English.
  title: said(meaningfulTitle),
  description: said((v) => harmless(v, 200)),
  version: (v) => typeof v === 'string' && VERSION_RE.test(v),
  author: (v) => harmless(v, 60),
  // One range per product, `{ "writing": ">=0.9.0" }`. Another product's key is
  // read as well-formed and left alone: this one asks for its own below.
  engines: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length > 0 &&
    Object.entries(v).every(([product, range]) => PRODUCT_RE.test(product) && typeof range === 'string' && ENGINE_RE.test(range)),
  icon: (v) => typeof v === 'string' && ICON_RE.test(v),
  needs: (v) => Array.isArray(v) && v.every((need) => NEEDS.includes(need))
}

// **A field an add-on may leave out** — `settings`, 24 September 2026. It
// stands in the manifest and not in addon.js because the setup after *Installieren*
// asks it before addon.js has ever run (Notion › Design-Referenz › Architektur, *Die
// Einrichtung eines Add-ons und seine Einstellungen*). A list of rows, the same
// fields a row of the settings window carries, and one more — `first`:
//
//   { "id": "goal", "group": "Ziel", "type": "number", "label": "Wörter am Tag",
//     "hint": "…", "default": 500, "min": 100, "max": 5000, "offer": [250, 500],
//     "first": true }
//
// **Five types of the settings window's ten.** `path` reaches a folder an add-on
// never sees, `keys` belongs to keys.js, and `action`, `info` and `grammar` show
// what the program knows.
//
// **The same two rules the eight fields keep**: an unknown key in a row is a
// refusal, and every string that becomes text on the screen is held to
// harmless() — or is a map of languages, which dies in read() like `title` does.
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

// What each type demands beside the common fields, and nothing else may stand.
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
// `offer` is the one type field that may be left out: a number row without the
// values behind the chevron is a field alone.
const OPTIONAL = new Set(['group', 'hint', 'first', 'offer'])

// **Does this value belong in this row.** One question with two askers: read()
// holds `default` to it, and addons.js holds the author's stored value to it —
// a value that misses its row is read as the default there, not as damage.
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

// **The panel an add-on brings for the side column** — `panel`, 24 September
// 2026, and the reason it stands here is the one `settings` has: the setup after
// *Installieren* asks whether it goes into the rail before any code of the
// add-on's has run.
//
//   "panel": { "icon": "today", "label": "Heute", "about": "Was heute geschrieben wurde." }
//
// Three fields and no fourth: the sign in the rail, the name, and the one line
// the side column's dialog shows under its list. `label` and `about` may be maps
// of languages, like `title` and `description`, and die in read() the same way.
// What stands in the opened panel is the add-on's own: `panel.js` draws it.
const PANEL_FIELDS = ['icon', 'label', 'about']
const soundPanel = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).every((key) => PANEL_FIELDS.includes(key)) &&
  typeof v.icon === 'string' && ICON_RE.test(v.icon) &&
  said((one) => harmless(one, 40))(v.label) && aside(v.about)

// **The fields beside the eight, and each of them may be left out.** Unknown is
// still a refusal; absent is not.
const EXTRA = {
  settings: soundSettings,
  panel: soundPanel
}

// **`$schema` is the one field that is allowed and ignored.** The template writes
// it so an IDE can complete and check the file; read() drops it, so nothing past
// that point ever sees it.
const IGNORED = '$schema'

// The map dies here for the rows as it does for `title` — see read().
const spokenRow = (row, lang) => ({
  ...row,
  label: pick(row.label, lang),
  ...(row.group === undefined ? {} : { group: pick(row.group, lang) }),
  ...(row.hint === undefined ? {} : { hint: pick(row.hint, lang) }),
  ...(row.options ? { options: row.options.map((one) => ({ value: one.value, label: pick(one.label, lang) })) } : {})
})

// Three plain numbers, nothing semver brings for comparing them — no
// dependency for three integers. Not exported: read() below validates
// engineVersion before this ever runs, so the one thing worth guarding
// against — an unparsable version turning into NaN and comparing false
// against everything — can no longer reach it here. A caller with a version
// of its own to compare and no validation like read() applies (task 12,
// against a catalog entry) exports this itself rather than reopening that
// gap.
function compareVersions (a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

// text and engineVersion are both a contract on the caller, not manifest
// content, and a broken one is loud on purpose: silence already means
// something else here (a rejected manifest, or an engine too old), and a
// caller bug must not read as either. engineVersion is the running program's
// own version (major.minor.patch); this module knows nothing about Electron
// or package.json. text must already be a string — a Buffer out of
// src/zip.js has its own encoding to decide, which belongs to whoever
// unpacked the archive, not here.
// **`lang` is the interface language, and the map dies here.** Everything past
// this function — addons.js, the six places in addons-view.js that show a card,
// the warning dialog, the rail — goes on seeing a plain string in `title` and
// `description`, exactly as it did before an add-on could say them twice. That
// is the whole reason the resolution sits in the one reader rather than at the
// six screens: a second shape travelling to the renderer would be six places to
// teach about it and six places that would drift.
//
// It is optional, and left out it means English: pick() falls through
// `value[undefined]` to `value.en`. Tools and checks that only ask *is this
// manifest sound* need not have an opinion about the reader.
function read (text, engineVersion, lang) {
  if (typeof engineVersion !== 'string' || !VERSION_RE.test(engineVersion)) {
    throw new TypeError(
      `manifest.read: engineVersion must look like "major.minor.patch", got ${JSON.stringify(engineVersion)}`)
  }
  if (typeof text !== 'string') {
    throw new TypeError(
      `manifest.read: text must be a string, not ${text?.constructor?.name ?? typeof text} — decode it first, e.g. buffer.toString('utf8')`)
  }

  // Notepad and PowerShell put a byte order mark at the start of a file
  // meant to be hand-edited, and JSON.parse trips over it — the same
  // allowance jsonfile.js makes for settings.json and palettes.json. Done
  // ahead of the try below, not inside it: neither charCodeAt nor slice can
  // throw on a string, and a try body should only hold what can actually
  // raise the error its catch is written for.
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

  // Checked before the eight fields themselves, so a typo in a field name
  // (`tittle` beside a missing `title`) is named as the stray key it is,
  // not read as that field silently missing.
  for (const field of Object.keys(parsed)) {
    if (field !== IGNORED && !Object.hasOwn(FIELDS, field) && !Object.hasOwn(EXTRA, field)) {
      const error = { code: CODES.unknown }
      // The field name of a rejected manifest ends up in a message shown to
      // an author — an unbounded, attacker-chosen string does not belong
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
  // **Another product's add-on is not a broken one**: `engines` is well formed and
  // simply holds no key for this program, so it does not run here. No manifest
  // travels with this answer, because there is no card to draw a title on.
  if (!Object.hasOwn(parsed.engines, PRODUCT)) {
    return { ok: false, error: { code: CODES.product, field: 'engines' } }
  }
  delete parsed[IGNORED]

  // Not a form error: the manifest is valid, the add-on just does not run on
  // this program's version. `ok` stays false and `error.code` is RA005 —
  // distinct from every other rejection, so a caller reading only `manifest`
  // still gets one, and a caller reading `ok` cannot mistake this for a
  // broken file. `need` is the version engine actually asked for, already
  // parsed out of the `>=` prefix — a caller building a hint for the author
  // (the installed view, task 02) reads it here instead of slicing the
  // field again. The catalog (task 11) leaves this manifest out of the list
  // entirely; the installed view shows it disabled, with that hint.
  // **Both fields are settled before either return below**, and the too-old one
  // is a return that carries a manifest: the installed view draws that card with
  // its title and its sentence on it, so it needs them in the reader's language
  // as much as a card that runs. `parsed` is this function's own — straight out
  // of JSON.parse three dozen lines up and held by nobody else — so it is written
  // in place rather than copied.
  parsed.title = pick(parsed.title, lang)
  parsed.description = pick(parsed.description, lang)
  if (parsed.settings) parsed.settings = parsed.settings.map((row) => spokenRow(row, lang))
  if (parsed.panel) parsed.panel = { ...parsed.panel, label: pick(parsed.panel.label, lang), about: pick(parsed.panel.about, lang) }

  const required = parsed.engines[PRODUCT].slice(2) // strips the leading ">="
  if (compareVersions(engineVersion, required) < 0) {
    return { ok: false, manifest: parsed, error: { code: CODES.engine, need: required } }
  }

  return { ok: true, manifest: parsed }
}

// **Two predicates and two forms beside read(), and they left this file for a
// second caller rather than on speculation** — roadmap 30, task 07. A workspace
// description (`workspace()` in addonhost.js) is the same kind of thing
// addon.json is: a string somebody else wrote that becomes text on this
// program's screen, with a `title` that can end up as an accessible name.
// Written a second time over there they would be two rules with one intention,
// and the arguments over CONTROL_RE and SAYS_SOMETHING_RE above — why the four
// named categories and not \p{C}, why code points and not UTF-16 units, why a
// positive rule for the title — would have to be believed rather than shared.
//
// **NAME_RE and ICON_RE go for exactly the same reason**, and they went one
// review later than they should have: addonhost.js carried both of them written
// out again, word for word, in the same file that imports the two predicates
// beside them. An addon's `name` is the host of its origin over there and the
// `id` of a workspace entry is the same shape on purpose; `icon` is the same
// Material Symbols name in the manifest and in a row of the side column. Two
// copies of one intention are two things to keep in step, and nothing would
// have said a word the day they drifted.
//
// **And `said` and `pick` go the same road, for the third caller of the same
// idea.** A workspace description (`workspace()` in addonhost.js) carries a
// `title` and up to 58 `label`s, and every one of them is what `title` and
// `description` are here: a stranger's words on this program's screen, in a
// program whose interface language the author changes at runtime. An add-on that
// may say its name in two languages in the manifest and not in its own side
// column would be half translated — so it is one rule, written once, and the map
// dies at the boundary over there exactly as it dies in read() here.
module.exports = { read, fits, harmless, meaningfulTitle, said, pick, NAME_RE, ID_RE, ICON_RE, CODES }
