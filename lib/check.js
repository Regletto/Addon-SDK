// regletto check: is this folder an add-on the product will take?
//
// Two parts judge it:
//
//   * addon.json itself, judged by the product's own manifest check, which its
//     SDK hands in as `product.manifest`. It is the very file the product runs,
//     so the verdict is the one the product would give.
//   * Everything around the manifest, which is this file: the files a surface
//     needs, the names a path may have, the limits an archive is held to. These
//     are the same in every product. The products keep them in their add-on
//     installers, which cannot be shared; test/same.js holds the values here to
//     the ones there.
//
// judge() is pure, so a test can hand it any folder it can imagine, including
// names Windows will not let one create. check() reads a real folder into it.

const fs = require('node:fs')
const path = require('node:path')
const zip = require('./zip.js')

// A product compares `engines` with its own version. The SDK has no version of
// the product to compare with, so it asks as if it were the newest: RA005 is the
// product's to say, when it loads the add-on.
const ENGINE = '999999.0.0'

// The limits of an add-on, the same in every product.
const MOST_DEPTH = 8                    // folders deep, file name included
const MOST_PATH = 120                   // characters in a path inside the archive
const MOST_MANIFEST = 64 * 1024         // bytes of addon.json
const MOST_ARCHIVE = 32 * 1024 * 1024   // bytes of the finished archive

// A name Windows keeps for a device, with or without an extension.
const RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/
// Characters no path segment may contain: the ones Windows refuses, and every
// control or invisible formatting character (a right-to-left override makes a
// name read as something it is not).
const UNSAFE = /[\\/<>:"|?*]|\p{Cc}|\p{Cf}/u

// What never goes into an archive, because it is there to build and not to run:
// anything starting with a dot, and these names.
const LEFT_OUT = new Set(['node_modules', 'dist', 'package.json', 'package-lock.json', 'jsconfig.json'])
const isLeftOut = (name) => name.startsWith('.') || LEFT_OUT.has(name)

const DOCS = 'https://regletto.com/developers/errors/'

// The surfaces every product has, each by the file that draws it and what asks for it, in
// the form of a product's `surfaces` (lib/cli.js): the workspace by the permission
// "workspace", the worker, a process of the add-on's own, by `"worker": true`.
const CORE_SURFACES = {
	'addon.js': { need: 'workspace' },
	'worker.js': { field: 'worker' }
}

// Every surface in this product, the core's first, as [file, ask].
const surfacesOf = (product) => Object.entries({ ...CORE_SURFACES, ...product.surfaces })

// Whether the manifest asks for a surface at all, by a permission or a field. A surface
// the file itself asks for is asked by being there, so it can never be missing.
const askedByManifest = (ask) => Boolean(ask.need || ask.field)

// Whether this sound manifest asks for the surface.
function asksFor (manifest, ask) {
	if (ask.need) return manifest.needs.some((entry) => entry.need === ask.need)
	return Boolean(ask.field && manifest[ask.field])
}

// How a message names what asks for a surface: a permission in "needs", or a field.
const askPhrase = (ask) => (ask.need ? `"${ask.need}" in "needs"` : `a "${ask.field}"`)

// What a finding carries for a surface without its file: the field that asks, with the
// permission where one in "needs" does, and the file.
const missingSurface = (file, ask) => (ask.need
	? { field: 'needs', need: ask.need, surface: file }
	: { field: ask.field, surface: file })

// A surface the manifest asks for without its file: what asked, and the file it misses.
function missingSurfaceMessage ({ field, need, surface }) {
	return need
		? `"${field}" has "${need}", but there is no ${surface}.`
		: `"${field}" is set, but there is no ${surface}.`
}

// A file the manifest names that is not in the folder, or that no archive takes: it may
// lie on the disk, and the product still never gets it.
function missingFileMessage ({ field, path: file }) {
	const leftOutPart = file.split('/').find(isLeftOut)
	return leftOutPart
		? `"${field}" names ${file}, but "${leftOutPart}" never goes into the archive.`
		: `"${field}" names ${file}, but there is no such file.`
}

// What each code says about `found`, in `product`. The codes themselves are
// listed in the product's manifest check, as CODES.
const MESSAGES = {
	RA001: () => 'addon.json is not valid JSON.',
	RA002: (found) => found.field
		? `"${found.field}" does not have the required form.`
		: 'addon.json does not have the required form.',
	RA003: (found) => `"${found.field}" is missing.`,
	RA004: (found) => found.field
		? `"${found.field}" is not a field of addon.json.`
		: 'addon.json has a field that does not exist.',
	RA005: (found, product) => `Needs ${product.name} ${found.need} or later.`,
	RA006: () => 'The publisher in "id" is a name Windows keeps for a device (con, nul, com1 and so on).',
	RA008: (found, product) => `"engines" has no entry for ${product.name}, "${product.key}".`,
	RA009: () => 'This folder has regletto.json, the manifest of an older version. ' +
		'It is called addon.json now, with "id" and "engines".',
	RA010: () => 'There is no addon.json in this folder.',
	RA011: (found) => (found.surface ? missingSurfaceMessage(found) : missingFileMessage(found)),
	RA012: () => 'This path cannot be used in an add-on: a character Windows does not allow, a device name, ' +
		'a dot or space at the end, more than 8 folders deep or longer than 120 characters.',
	RA013: () => 'More than 10 000 files.',
	RA014: () => 'More than 256 MB unpacked.',
	RA015: () => 'The archive is larger than 32 MB.',
	RA016: () => 'Every entry of "needs" is { "need": ..., "why": ... }, and one has no "why": ' +
		'the sentence that tells the author why the add-on needs this permission.',
	RA017: () => '"settings" is { "rows": [...] }, not the list of rows itself. ' +
		'Beside "rows" it may carry { "category": { "title": ... } } for a category of its own in the settings window.',
	RA018: (found) => found.contrast
		? `The theme "${found.contrast.theme}" in "themes" has too little contrast in ${found.contrast.mode} mode: ` +
			`${found.contrast.fg} on ${found.contrast.bg} is ${found.contrast.ratio} : 1, and it needs ${found.contrast.min} : 1.`
		: 'A theme in "themes" has too little contrast.',
	RA019: (found) => `The font ${found.font ? `"${found.font}" ` : ''}in "fonts" has no "regular" cut: ` +
		'every family needs its upright one.',
	RA020: (found, product) => '"provides" names what other add-ons may ask for, but nothing of this add-on runs to answer: ' +
		`it needs ${answeringPlaces(product)}.`
}

// Where code of an add-on runs to answer an offer, in this product: every surface the
// manifest asks for. One the file itself asks for never answers, since something else opens it.
function answeringPlaces (product) {
	const places = surfacesOf(product)
		.filter(([, ask]) => askedByManifest(ask))
		.map(([, ask]) => askPhrase(ask))
	return `${places.slice(0, -1).join(', ')} or ${places.at(-1)}`
}

// What a code says that this base has no words for: a product's SDK can be newer
// than the base it found, and its finding still names the code and its page.
const UNKNOWN = () => 'This version of the SDK has no message for this code; the page below explains it.'

// One finding: its code, the file it is about, and the message and the page that
// explains it. `extra` carries the `field`, `need`, `contrast` or `font` of a manifest
// error, the `surface` whose file is missing, or the `path` of a file the manifest names.
function problemOf (product, code, file, extra = {}) {
	const found = { code, file, ...extra }
	const message = Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : UNKNOWN
	found.message = message(found, product)
	found.url = DOCS + code
	return found
}

// The part of a manifest error that a message and a person need.
function detailsOf (error) {
	const details = {}
	if (error.field) details.field = error.field
	if (error.need) details.need = error.need
	// Which theme missed which threshold, in which mode (RA018).
	if (error.contrast) details.contrast = error.contrast
	// Which font has no upright cut (RA019).
	if (error.font) details.font = error.font
	return details
}

// Can this one path segment be laid down on Windows, the strictest disk there is?
function isSafeSegment (segment) {
	if (segment.length === 0 || UNSAFE.test(segment)) return false
	if (/^\.+$/.test(segment) || /[. ]$/.test(segment)) return false
	return !RESERVED.test(segment.split('.')[0].toLowerCase())
}

function isSafePath (name) {
	const segments = name.split('/')
	return name.length <= MOST_PATH && segments.length <= MOST_DEPTH && segments.every(isSafeSegment)
}

// Judges a folder that is already described, not read:
//
//   text    the text of addon.json, or null if the folder has none
//   files   [{ name, size }], `/` between folders, as the archive would hold them
//
// Answers `{ manifest, problems }`: the manifest as the product reads it (null if
// it is broken) and every problem found, in the order they are found.
function judge ({ text, files }, product) {
	const { CODES } = product.manifest
	const problem = (...args) => problemOf(product, ...args)
	const problems = []
	const names = new Set(files.map((file) => file.name))

	let read = null
	if (text === null) {
		problems.push(names.has('regletto.json')
			? problem(CODES.old, 'regletto.json')
			: problem(CODES.noManifest, 'addon.json'))
	} else if (Buffer.byteLength(text) > MOST_MANIFEST) {
		problems.push(problem(CODES.form, 'addon.json'))
	} else {
		read = product.manifest.read(text, ENGINE, 'en')
		if (!read.ok) {
			problems.push(problem(read.error.code, 'addon.json', detailsOf(read.error)))
		} else if (RESERVED.test(read.manifest.id.split('.')[0])) {
			problems.push(problem(CODES.name, 'addon.json', { field: 'id' }))
		}
	}

	// A surface the manifest asks for needs the file that draws it: the workspace and
	// the worker in every product, and the surfaces only this product has.
	const sound = read?.ok ? read.manifest : null
	for (const [file, ask] of sound ? surfacesOf(product) : []) {
		if (asksFor(sound, ask) && !names.has(file)) problems.push(problem(CODES.noEntry, 'addon.json', missingSurface(file, ask)))
	}
	// And every other file a sound manifest names that only this product knows, the
	// files of a font say: the product would leave out what is not there.
	for (const { field, file } of sound && product.files ? product.files(sound) : []) {
		if (!names.has(file)) problems.push(problem(CODES.noEntry, 'addon.json', { field, path: file }))
	}

	for (const file of files) {
		if (!isSafePath(file.name)) problems.push(problem(CODES.entry, file.name))
	}
	if (files.length > zip.MOST_FILES) problems.push(problem(CODES.tooMany, '.'))
	if (files.reduce((sum, file) => sum + file.size, 0) > zip.MOST_BYTES) problems.push(problem(CODES.tooBig, '.'))

	return { manifest: sound, problems }
}

// The paths .gitattributes marks `export-ignore`: files or folders, relative to
// the add-on's root. A missing or unreadable file marks nothing.
// ponytail: plain paths only, no globs; add them when an add-on needs one.
function exportIgnored (dir) {
	let text
	try { text = fs.readFileSync(path.join(dir, '.gitattributes'), 'utf8') } catch { return new Set() }
	const ignored = new Set()
	for (const line of text.split('\n')) {
		const [pattern, ...attributes] = line.trim().split(/\s+/)
		if (pattern && !pattern.startsWith('#') && attributes.includes('export-ignore')) {
			ignored.add(pattern.replace(/^\/+|\/+$/g, ''))
		}
	}
	return ignored
}

// Every file that would go into the archive, in a stable order.
function filesOf (dir) {
	const found = []
	const ignored = exportIgnored(dir)
	const walk = (relative) => {
		for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
			if (isLeftOut(entry.name)) continue
			const name = relative ? relative + '/' + entry.name : entry.name
			if (ignored.has(name)) continue
			if (entry.isDirectory()) walk(name)
			else if (entry.isFile()) found.push({ name, size: fs.statSync(path.join(dir, name)).size })
		}
	}
	walk('')
	return found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

// The archive, packed the way the products pack one: addon.json at the root.
const pack = (dir, files) => zip.zip(files.map((file) => ({
	name: file.name,
	data: fs.readFileSync(path.join(dir, file.name))
})))

// Checks a real folder. The archive is packed here too, because 32 MB is a limit
// of the archive and not of the folder. So check() is build() without the file at
// the end, and what was checked is what build() writes.
//
// Answers `{ manifest, problems, files, archive }`; there is no archive while
// there are problems.
function check (dir, product) {
	const files = filesOf(dir)
	const file = path.join(dir, 'addon.json')
	const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
	const judged = judge({ text, files }, product)
	if (judged.problems.length) return { ...judged, files }
	const archive = pack(dir, files)
	if (archive.length > MOST_ARCHIVE) judged.problems.push(problemOf(product, product.manifest.CODES.tooLarge, '.'))
	return { ...judged, files, archive }
}

function print (problems) {
	for (const problem of problems) {
		console.log(`${problem.file}: ${problem.code}${problem.field ? ' ' + problem.field : ''}: ${problem.message}`)
		console.log(`  ${problem.url}`)
	}
}

// The folder is the one argument that is not a flag, or the one we stand in.
const folderOf = (args) => path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.')

function main (args, product) {
	const { manifest: sound, problems } = check(folderOf(args), product)
	if (args.includes('--json')) {
		console.log(JSON.stringify({ manifest: sound, problems }))
	} else if (problems.length) {
		print(problems)
		console.log(problems.length === 1 ? '1 problem.' : `${problems.length} problems.`)
	} else {
		console.log(`${sound.id} ${sound.version} is ready to build.`)
	}
	return problems.length ? 1 : 0
}

module.exports = { judge, check, print, main, folderOf, MOST_DEPTH, MOST_PATH, MOST_MANIFEST, MOST_ARCHIVE, RESERVED, UNSAFE }
