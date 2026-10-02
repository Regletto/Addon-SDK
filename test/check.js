// regletto check and build:
//
//   * Writing's own probe add-on (test/probe in the Writing checkout) passes,
//   * one folder per error code the SDK can raise fails with exactly that code,
//   * build writes an archive that Writing's own reader (src/zip.js of the
//     checkout) reads back whole, with only what runs in it,
//   * the command exits non-zero on a problem, so it serves in a CI.
//
// RA005 and RA007 are Writing's alone: the SDK knows no version of Writing to
// compare `engines` with, and no catalog entry to compare the id with.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const WRITING = require('./_writing.js')()
const { judge, check } = require('../lib/check.js')
const { build } = require('../lib/build.js')

const BIN = path.join(__dirname, '..', 'bin', 'regletto.js')
const PROBE = path.join(WRITING, 'test', 'probe')
const probe = JSON.parse(fs.readFileSync(path.join(PROBE, 'addon.json'), 'utf8'))
const ENTRIES = [{ name: 'addon.js', size: 1 }, { name: 'panel.js', size: 1 }]

const codesOf = (result) => result.problems.map((problem) => problem.code)

// The codes judge() finds in the probe's manifest after `change`, with `files`
// beside it.
const codesWith = (change, files = ENTRIES) => {
	const manifest = structuredClone(probe)
	change(manifest)
	return codesOf(judge({ text: JSON.stringify(manifest), files }))
}

// The probe folder itself.
const own = check(PROBE)
assert.deepStrictEqual(own.problems, [], 'Writing\'s probe passes regletto check')
assert.strictEqual(own.manifest.id, 'regletto.probe')

// One manifest or folder per code.
assert.deepStrictEqual(codesWith(() => {}), [], 'the probe\'s manifest with its entries is sound')
assert.deepStrictEqual(codesOf(judge({ text: '{ "id": ', files: ENTRIES })), ['RA001'])
assert.deepStrictEqual(codesWith((manifest) => { manifest.version = '1.0' }), ['RA002'])
assert.deepStrictEqual(codesWith((manifest) => { delete manifest.author }), ['RA003'])
assert.deepStrictEqual(codesWith((manifest) => { manifest.colour = 'red' }), ['RA004'])
assert.deepStrictEqual(codesWith((manifest) => { manifest.id = 'nul.probe' }), ['RA006'])
assert.deepStrictEqual(codesWith((manifest) => { manifest.engines = { other: '>=1.0.0' } }), ['RA008'])
assert.deepStrictEqual(codesOf(judge({ text: null, files: [{ name: 'regletto.json', size: 2 }] })), ['RA009'])
assert.deepStrictEqual(codesOf(judge({ text: null, files: [] })), ['RA010'])
assert.deepStrictEqual(codesWith(() => {}, [{ name: 'panel.js', size: 1 }]), ['RA011'], 'needs workspace, no addon.js')
assert.deepStrictEqual(codesWith(() => {}, [{ name: 'addon.js', size: 1 }]), ['RA011'], 'panel, no panel.js')

// RA012: a path that cannot be laid down.
const REFUSED_PATHS = [
	'nul/x.js',                 // a device name
	'a:b.js',                   // a character Windows refuses
	'x.',                       // a dot at the end
	'lib\\x.js',                // a backslash
	'a/b/c/d/e/f/g/h/i.js',     // nine folders deep
	'x'.repeat(121),            // longer than 120
	'rtl‮evil.js'          // a right-to-left override
]
for (const name of REFUSED_PATHS) {
	assert.deepStrictEqual(codesWith(() => {}, [...ENTRIES, { name, size: 1 }]), ['RA012'], `${JSON.stringify(name)} is refused`)
}
assert.deepStrictEqual(
	codesWith(() => {}, [...ENTRIES, { name: 'Café menu.md', size: 1 }]),
	[],
	'a space and an accent are fine'
)

// RA013 and RA014: too many files, too many bytes.
const many = Array.from({ length: 10000 }, (_, at) => ({ name: `f${at}.js`, size: 1 }))
assert.deepStrictEqual(codesWith(() => {}, [...ENTRIES, ...many]), ['RA013'])
assert.deepStrictEqual(codesWith(() => {}, [...ENTRIES, { name: 'big.bin', size: 256 * 1024 * 1024 }]), ['RA014'])

// An addon.json over 64 KB is refused unread.
const huge = judge({ text: ' '.repeat(64 * 1024 + 1), files: ENTRIES })
assert.strictEqual(huge.problems[0].code, 'RA002', 'an addon.json over 64 KB')

// Every problem links its page and says what is wrong and where.
for (const problem of judge({ text: null, files: [] }).problems) {
	assert.strictEqual(problem.url, `https://regletto.com/developers/errors/${problem.code}`, 'every problem links its page')
	assert.ok(problem.file && problem.message, 'and names its file and says what is wrong')
}

// A real folder: build, then read it back through Writing's own reader.
const unzip = require(path.join(WRITING, 'src', 'zip.js')).unzip
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-check-'))
try {
	fs.cpSync(PROBE, dir, { recursive: true })
	fs.mkdirSync(path.join(dir, 'lib'))
	fs.writeFileSync(path.join(dir, 'lib', 'Café menu.md'), 'Hello')
	// What is there to build with and stays out of the archive.
	for (const left of ['package.json', 'jsconfig.json', '.gitignore']) fs.writeFileSync(path.join(dir, left), '{}')
	for (const left of ['node_modules/x', 'dist', '.git']) fs.mkdirSync(path.join(dir, left), { recursive: true })
	fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'index.js'), '')

	// What .gitattributes marks export-ignore is left out, a file or a folder.
	fs.mkdirSync(path.join(dir, 'drafts'))
	fs.writeFileSync(path.join(dir, 'drafts', 'a.md'), 'x')
	fs.writeFileSync(path.join(dir, 'notes.md'), 'x')
	fs.writeFileSync(path.join(dir, '.gitattributes'), '# comment\nnotes.md export-ignore\ndrafts/ export-ignore\r\n')
	assert.ok(!check(dir).files.some((file) => file.name === 'notes.md' || file.name.startsWith('drafts/')), 'export-ignore leaves files out')

	const made = build(dir)
	assert.deepStrictEqual(made.problems, [])
	assert.strictEqual(path.basename(made.out), 'regletto.probe-1.0.0.zip')
	const back = unzip(fs.readFileSync(made.out))
	assert.ok(!back.error, `Writing reads the archive: ${JSON.stringify(back.error)}`)
	assert.deepStrictEqual(
		[...back.files.keys()].sort(),
		['addon.js', 'addon.json', 'dialog.js', 'lib/Café menu.md', 'overlay.js', 'panel.js'],
		'only what runs, and nothing to build with'
	)
	for (const [name, body] of back.files) {
		assert.ok(body.equals(fs.readFileSync(path.join(dir, name))), `${name} comes back as it was`)
	}

	// The command line: 0 when sound, 1 with a problem, and nothing built then.
	const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' })
	const sound = run('check')
	assert.strictEqual(sound.status, 0, sound.stdout + sound.stderr)
	fs.rmSync(path.join(dir, 'addon.js'))
	fs.rmSync(path.join(dir, 'dist'), { recursive: true })
	const broken = run('build')
	assert.strictEqual(broken.status, 1, 'a problem exits 1')
	assert.match(broken.stdout, /addon\.json: RA011 needs: /)
	assert.ok(!fs.existsSync(path.join(dir, 'dist')), 'and nothing is built')
	const json = JSON.parse(run('check', '--json').stdout)
	assert.deepStrictEqual(json.problems.map((problem) => problem.code), ['RA011'], '--json says the same')
} finally {
	fs.rmSync(dir, { recursive: true, force: true })
}

console.log('check: the probe passes, every code falls as itself, the archive reads back in Writing')
