// regletto check: is this folder an add-on Regletto Writing will take?
//
// **The manifest is judged by lib/manifest.js, which is Writing's own file**
// (scripts/sync.js copies it, test/same.js holds it to the checkout). What this
// file adds is what lies around the manifest: the files a surface needs and the
// limits Writing holds an archive to. Those rules are written out below because
// Writing keeps them inside src/addons.js, which needs Electron; test/same.js
// reads them out of that file and fails when they drift.
//
// judge() is pure, so a check can hand it any folder it can imagine, including
// names Windows will not let one create. check() reads a real folder into it.

const fs = require('node:fs')
const path = require('node:path')
const manifest = require('./manifest.js')
const zip = require('./zip.js')

const { CODES } = manifest

// Writing compares `engines` against its own version. The SDK has no version of
// Writing to compare with, so it asks as the newest one: RA005 is Writing's to say.
const ENGINE = '999999.0.0'

// The limits of src/addons.js and src/addonload.js in Writing.
const MOST_DEPTH = 8
const MOST_PATH = 120
const MOST_MANIFEST = 64 * 1024
const MOST_ARCHIVE = 32 * 1024 * 1024
const RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/
const UNSAFE = /[\\/<>:"|?*]|\p{Cc}|\p{Cf}/u

// What never goes into an archive: it is there to build, not to run.
const LEFT_OUT = new Set(['node_modules', 'dist', 'package.json', 'package-lock.json', 'jsconfig.json'])
const leftOut = (name) => name.startsWith('.') || LEFT_OUT.has(name)

const DOCS = 'https://regletto.com/developers/errors/'

const SAY = {
  RA001: () => 'addon.json is not valid JSON.',
  RA002: (p) => p.field ? `"${p.field}" does not have the required form.` : 'addon.json does not have the required form.',
  RA003: (p) => `"${p.field}" is missing.`,
  RA004: (p) => p.field ? `"${p.field}" is not a field of addon.json.` : 'addon.json has a field that does not exist.',
  RA005: (p) => `Needs Regletto Writing ${p.need} or later.`,
  RA006: () => 'The publisher in "id" is a name Windows keeps for a device (con, nul, com1 and so on).',
  RA008: () => '"engines" has no entry for Regletto Writing, "writing".',
  RA009: () => 'This folder has regletto.json, the manifest of an older version. It is called addon.json now, with "id" and "engines".',
  RA010: () => 'There is no addon.json in this folder.',
  RA011: (p) => p.field === 'panel' ? '"panel" is set, but there is no panel.js.' : '"needs" has "workspace", but there is no addon.js.',
  RA012: () => 'This path cannot be used in an add-on: a character Windows does not allow, a device name, a dot or space at the end, more than 8 folders deep or longer than 120 characters.',
  RA013: () => 'More than 10 000 files.',
  RA014: () => 'More than 256 MB unpacked.',
  RA015: () => 'The archive is larger than 32 MB.'
}

const problem = (code, file, extra = {}) => {
  const said = { code, file, ...extra }
  said.message = SAY[code](said)
  said.url = DOCS + code
  return said
}

function safeSegment (part) {
  if (part.length === 0 || UNSAFE.test(part)) return false
  if (/^\.+$/.test(part) || /[. ]$/.test(part)) return false
  return !RESERVED.test(part.split('.')[0].toLowerCase())
}

const safePath = (name) => name.length <= MOST_PATH && name.split('/').length <= MOST_DEPTH &&
  name.split('/').every(safeSegment)

// files: [{ name, size }] with `/` between folders, and the text of addon.json
// (or null) beside them. Answers the manifest as Writing reads it, and every
// problem found.
function judge ({ text, files }) {
  const problems = []
  const names = new Set(files.map((one) => one.name))

  let read = null
  if (text === null) {
    problems.push(names.has('regletto.json') ? problem(CODES.old, 'regletto.json') : problem(CODES.noManifest, 'addon.json'))
  } else if (Buffer.byteLength(text) > MOST_MANIFEST) {
    problems.push(problem(CODES.form, 'addon.json'))
  } else {
    read = manifest.read(text, ENGINE, 'en')
    if (!read.ok) problems.push(problem(read.error.code, 'addon.json', pickOf(read.error)))
    else if (RESERVED.test(read.manifest.id.split('.')[0])) problems.push(problem(CODES.name, 'addon.json', { field: 'id' }))
  }

  const sound = read?.ok ? read.manifest : null
  if (sound?.needs.includes('workspace') && !names.has('addon.js')) {
    problems.push(problem(CODES.noEntry, 'addon.json', { field: 'needs' }))
  }
  if (sound?.panel && !names.has('panel.js')) {
    problems.push(problem(CODES.noEntry, 'addon.json', { field: 'panel' }))
  }

  for (const one of files) {
    if (!safePath(one.name)) problems.push(problem(CODES.entry, one.name))
  }
  if (files.length > zip.MOST_FILES) problems.push(problem(CODES.tooMany, '.'))
  if (files.reduce((sum, one) => sum + one.size, 0) > zip.MOST_BYTES) problems.push(problem(CODES.tooBig, '.'))

  return { manifest: sound, problems }
}

const pickOf = (error) => {
  const out = {}
  if (error.field) out.field = error.field
  if (error.need) out.need = error.need
  return out
}

// Every file that would go into the archive, in a stable order.
function filesOf (dir) {
  const found = []
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (leftOut(entry.name)) continue
      const name = rel ? rel + '/' + entry.name : entry.name
      if (entry.isDirectory()) walk(name)
      else if (entry.isFile()) found.push({ name, size: fs.statSync(path.join(dir, name)).size })
    }
  }
  walk('')
  return found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

// The archive, packed the way Writing's own writer packs: addon.json at the root.
const pack = (dir, files) => zip.zip(files.map((one) => ({ name: one.name, data: fs.readFileSync(path.join(dir, one.name)) })))

// **The archive is packed here too**, because 32 MB is a limit of the archive and
// not of the folder. check() is then build() without the file at the end.
function check (dir) {
  const files = filesOf(dir)
  const file = path.join(dir, 'addon.json')
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  const judged = judge({ text, files })
  if (judged.problems.length) return { ...judged, files }
  const archive = pack(dir, files)
  if (archive.length > MOST_ARCHIVE) judged.problems.push(problem(CODES.tooLarge, '.'))
  return { ...judged, files, archive }
}

function print (problems) {
  for (const one of problems) {
    console.log(`${one.file}: ${one.code}${one.field ? ' ' + one.field : ''}: ${one.message}`)
    console.log(`  ${one.url}`)
  }
}

// The folder is the one argument that is not a flag, or the one we stand in.
const folderOf = (args) => path.resolve(args.find((one) => !one.startsWith('--')) ?? '.')

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
