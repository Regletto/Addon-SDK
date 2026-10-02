// regletto check: is this folder an add-on Regletto Writing will take?
//
// Two parts judge it:
//
//   * addon.json itself, judged by lib/manifest.js. That file is Regletto
//     Writing's own (scripts/sync.js copies it here), so the verdict is the one
//     Writing would give.
//   * Everything around the manifest, which is this file: the files a surface
//     needs, the names a path may have, the limits an archive is held to.
//     Writing keeps these rules in its add-on installer, which needs Electron
//     and cannot be shared. They are written out below instead, and
//     test/same.js reads them out of Writing and fails when they drift.
//
// judge() is pure, so a test can hand it any folder it can imagine, including
// names Windows will not let one create. check() reads a real folder into it.

const fs = require('node:fs')
const path = require('node:path')
const manifest = require('./manifest.js')
const zip = require('./zip.js')

const { CODES } = manifest

// Writing compares `engines` with its own version. The SDK has no version of
// Writing to compare with, so it asks as if it were the newest: RA005 is
// Writing's to say, when it loads the add-on.
const ENGINE = '999999.0.0'

// The limits of an add-on, as Writing holds them.
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

// What each code says. The codes themselves are listed in lib/manifest.js.
const MESSAGES = {
	RA001: () => 'addon.json is not valid JSON.',
	RA002: (found) => found.field
		? `"${found.field}" does not have the required form.`
		: 'addon.json does not have the required form.',
	RA003: (found) => `"${found.field}" is missing.`,
	RA004: (found) => found.field
		? `"${found.field}" is not a field of addon.json.`
		: 'addon.json has a field that does not exist.',
	RA005: (found) => `Needs Regletto Writing ${found.need} or later.`,
	RA006: () => 'The publisher in "id" is a name Windows keeps for a device (con, nul, com1 and so on).',
	RA008: () => '"engines" has no entry for Regletto Writing, "writing".',
	RA009: () => 'This folder has regletto.json, the manifest of an older version. ' +
		'It is called addon.json now, with "id" and "engines".',
	RA010: () => 'There is no addon.json in this folder.',
	RA011: (found) => found.field === 'panel'
		? '"panel" is set, but there is no panel.js.'
		: '"needs" has "workspace", but there is no addon.js.',
	RA012: () => 'This path cannot be used in an add-on: a character Windows does not allow, a device name, ' +
		'a dot or space at the end, more than 8 folders deep or longer than 120 characters.',
	RA013: () => 'More than 10 000 files.',
	RA014: () => 'More than 256 MB unpacked.',
	RA015: () => 'The archive is larger than 32 MB.'
}

// One finding: its code, the file it is about, and the message and the page that
// explains it. `extra` carries the `field` or `need` of a manifest error.
function problemOf (code, file, extra = {}) {
	const found = { code, file, ...extra }
	found.message = MESSAGES[code](found)
	found.url = DOCS + code
	return found
}

// The part of a manifest error that a message and a person need.
function detailsOf (error) {
	const details = {}
	if (error.field) details.field = error.field
	if (error.need) details.need = error.need
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
// Answers `{ manifest, problems }`: the manifest as Writing reads it (null if it
// is broken) and every problem found, in the order they are found.
function judge ({ text, files }) {
	const problems = []
	const names = new Set(files.map((file) => file.name))

	let read = null
	if (text === null) {
		problems.push(names.has('regletto.json')
			? problemOf(CODES.old, 'regletto.json')
			: problemOf(CODES.noManifest, 'addon.json'))
	} else if (Buffer.byteLength(text) > MOST_MANIFEST) {
		problems.push(problemOf(CODES.form, 'addon.json'))
	} else {
		read = manifest.read(text, ENGINE, 'en')
		if (!read.ok) {
			problems.push(problemOf(read.error.code, 'addon.json', detailsOf(read.error)))
		} else if (RESERVED.test(read.manifest.id.split('.')[0])) {
			problems.push(problemOf(CODES.name, 'addon.json', { field: 'id' }))
		}
	}

	// A surface the manifest asks for needs the file that draws it.
	const sound = read?.ok ? read.manifest : null
	if (sound?.needs.includes('workspace') && !names.has('addon.js')) {
		problems.push(problemOf(CODES.noEntry, 'addon.json', { field: 'needs' }))
	}
	if (sound?.panel && !names.has('panel.js')) {
		problems.push(problemOf(CODES.noEntry, 'addon.json', { field: 'panel' }))
	}

	for (const file of files) {
		if (!isSafePath(file.name)) problems.push(problemOf(CODES.entry, file.name))
	}
	if (files.length > zip.MOST_FILES) problems.push(problemOf(CODES.tooMany, '.'))
	if (files.reduce((sum, file) => sum + file.size, 0) > zip.MOST_BYTES) problems.push(problemOf(CODES.tooBig, '.'))

	return { manifest: sound, problems }
}

// Every file that would go into the archive, in a stable order.
function filesOf (dir) {
	const found = []
	const walk = (relative) => {
		for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
			if (isLeftOut(entry.name)) continue
			const name = relative ? relative + '/' + entry.name : entry.name
			if (entry.isDirectory()) walk(name)
			else if (entry.isFile()) found.push({ name, size: fs.statSync(path.join(dir, name)).size })
		}
	}
	walk('')
	return found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

// The archive, packed the way Writing's own writer packs it: addon.json at the root.
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
function check (dir) {
	const files = filesOf(dir)
	const file = path.join(dir, 'addon.json')
	const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
	const judged = judge({ text, files })
	if (judged.problems.length) return { ...judged, files }
	const archive = pack(dir, files)
	if (archive.length > MOST_ARCHIVE) judged.problems.push(problemOf(CODES.tooLarge, '.'))
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

function main (args) {
	const { manifest: sound, problems } = check(folderOf(args))
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
