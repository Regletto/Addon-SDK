// regletto check and build, run with the sample product (test/sample):
//
//   * a sound add-on passes, and what the product's own check says comes through
//     with its code and the product's name in the message,
//   * one folder per code the base raises itself fails with exactly that code,
//   * build writes an archive that lib/zip.js reads back whole, with only what
//     runs in it,
//   * the command exits non-zero on a problem, so it serves in a CI.
//
// That a real product's add-ons pass is that product's check: Writing's lives
// in its checkout, test/sdk.js.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { judge, check } = require('../lib/check.js')
const { build } = require('../lib/build.js')
const { unzip } = require('../lib/zip.js')
const product = require('./sample/product.js')

const BIN = path.join(__dirname, 'sample', 'bin.js')
const SOUND = {
	id: 'acme.sample',
	title: 'Sample',
	version: '1.0.0',
	engines: { sample: '>=1.0.0' },
	needs: [{ need: 'workspace', why: 'Shows the tray in a workspace of its own.' }],
	tray: {}
}
const ENTRIES = [{ name: 'addon.js', size: 1 }, { name: 'tray.js', size: 1 }]

const codesOf = (result) => result.problems.map((problem) => problem.code)
const judged = (manifest, files = ENTRIES) => judge({ text: JSON.stringify(manifest), files }, product)
const codesWith = (change, files) => {
	const manifest = structuredClone(SOUND)
	change(manifest)
	return codesOf(judged(manifest, files))
}

// Sound, and the product's own verdicts come through as they are.
assert.deepStrictEqual(codesWith(() => {}), [], 'a sound add-on with its files passes')
assert.deepStrictEqual(codesOf(judge({ text: '{ "id": ', files: ENTRIES }, product)), ['RA001'])
assert.deepStrictEqual(codesWith((manifest) => { manifest.colour = 'red' }), ['RA004'])
const other = judged({ ...SOUND, engines: { other: '>=1.0.0' } }).problems
assert.deepStrictEqual(other.map((problem) => problem.code), ['RA008'])
assert.strictEqual(other[0].message, '"engines" has no entry for Regletto Sample, "sample".', 'the message names the product')
// Standard v2: a permission without its reason, the old form of `needs` among them.
const reasonless = judged({ ...SOUND, needs: ['workspace'] }).problems
assert.deepStrictEqual(reasonless.map((problem) => problem.code), ['RA016'])
assert.match(reasonless[0].message, /"why"/, 'the message of RA016 does not name what is missing')
// Standard v2: `settings` as a bare list of rows, the form before; the sample has no
// settings, so the product's verdict is handed in.
const listed = { ...product, manifest: { ...product.manifest, read: () => ({ ok: false, error: { code: 'RA017', field: 'settings' } }) } }
const bare = judge({ text: JSON.stringify(SOUND), files: ENTRIES }, listed).problems
assert.deepStrictEqual(bare.map((problem) => [problem.code, problem.field]), [['RA017', 'settings']])
assert.match(bare[0].message, /"rows"/, 'the message of RA017 does not name the form the rows stand in now')
// Standard v2: a theme with too little contrast, said with the theme, the mode and the pair.
const contrast = { theme: 'sage', mode: 'dark', fg: 'dim', bg: 'page', ratio: 1.57, min: 4.5 }
const pale = { ...product, manifest: { ...product.manifest, read: () => ({ ok: false, error: { code: 'RA018', field: 'themes', contrast } }) } }
const weak = judge({ text: JSON.stringify(SOUND), files: ENTRIES }, pale).problems
assert.deepStrictEqual(weak.map((problem) => [problem.code, problem.field, problem.contrast]), [['RA018', 'themes', contrast]])
assert.strictEqual(weak[0].message, 'The theme "sage" in "themes" has too little contrast in dark mode: dim on page is 1.57 : 1, and it needs 4.5 : 1.',
	'the message of RA018 does not say which theme missed what')
// Standard v2: a font without its upright cut, said with the font.
const upright = { ...product, manifest: { ...product.manifest, read: () => ({ ok: false, error: { code: 'RA019', field: 'fonts', font: 'serif' } }) } }
const bareFont = judge({ text: JSON.stringify(SOUND), files: ENTRIES }, upright).problems
assert.deepStrictEqual(bareFont.map((problem) => [problem.code, problem.field, problem.font]), [['RA019', 'fonts', 'serif']])
assert.strictEqual(bareFont[0].message, 'The font "serif" in "fonts" has no "regular" cut: every family needs its upright one.',
	'the message of RA019 does not name the font')
// A file the manifest names that only the product knows (Writing's font files): there,
// nothing; missing, RA011 with the path.
assert.deepStrictEqual(codesWith((manifest) => { manifest.tray = { sheet: 'tray.css' } }, [...ENTRIES, { name: 'tray.css', size: 1 }]), [])
const unnamed = judged({ ...SOUND, tray: { sheet: 'tray.css' } }).problems
assert.deepStrictEqual(unnamed.map((problem) => [problem.code, problem.field, problem.path]), [['RA011', 'tray', 'tray.css']])
assert.strictEqual(unnamed[0].message, '"tray" names tray.css, but there is no such file.', 'the message of RA011 does not name the file')
// A code this base has no words for, from a product newer than the base: the
// finding names the code and its page, and nothing dies on it.
const newer = { ...product, manifest: { ...product.manifest, read: () => ({ ok: false, error: { code: 'RA999', field: 'needs' } }) } }
const unknown = judge({ text: JSON.stringify(SOUND), files: ENTRIES }, newer).problems
assert.deepStrictEqual(unknown.map((problem) => [problem.code, problem.field]), [['RA999', 'needs']])
assert.match(unknown[0].message, /no message for this code/, 'a code without words does not say so')
assert.strictEqual(unknown[0].url, 'https://regletto.com/developers/errors/RA999')

// What the base finds itself.
assert.deepStrictEqual(codesWith((manifest) => { manifest.id = 'nul.sample' }), ['RA006'])
assert.deepStrictEqual(codesOf(judge({ text: null, files: [{ name: 'regletto.json', size: 2 }] }, product)), ['RA009'])
assert.deepStrictEqual(codesOf(judge({ text: null, files: [] }, product)), ['RA010'])
assert.deepStrictEqual(codesWith(() => {}, [{ name: 'tray.js', size: 1 }]), ['RA011'], 'needs workspace, no addon.js')
const tray = judged(SOUND, [{ name: 'addon.js', size: 1 }]).problems
assert.deepStrictEqual(tray.map((problem) => problem.code), ['RA011'], 'a surface of the product, without its file')
assert.strictEqual(tray[0].message, '"tray" is set, but there is no tray.js.')
assert.deepStrictEqual(codesWith((manifest) => { delete manifest.tray }, [{ name: 'addon.js', size: 1 }]), [], 'no tray, no tray.js needed')
// The worker is a surface of every product: `"worker": true` asks for worker.js.
const worker = judged({ ...SOUND, worker: true }).problems
assert.deepStrictEqual(worker.map((problem) => [problem.code, problem.field]), [['RA011', 'worker']], 'a worker without worker.js')
assert.strictEqual(worker[0].message, '"worker" is set, but there is no worker.js.')
assert.deepStrictEqual(codesOf(judged({ ...SOUND, worker: true }, [...ENTRIES, { name: 'worker.js', size: 1 }])), [], 'a worker with its worker.js')

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
assert.deepStrictEqual(codesWith(() => {}, [...ENTRIES, { name: 'Café menu.md', size: 1 }]), [], 'a space and an accent are fine')

// RA013 and RA014: too many files, too many bytes.
const many = Array.from({ length: 10000 }, (_, at) => ({ name: `f${at}.js`, size: 1 }))
assert.deepStrictEqual(codesWith(() => {}, [...ENTRIES, ...many]), ['RA013'])
assert.deepStrictEqual(codesWith(() => {}, [...ENTRIES, { name: 'big.bin', size: 256 * 1024 * 1024 }]), ['RA014'])

// An addon.json over 64 KB is refused unread.
const huge = judge({ text: ' '.repeat(64 * 1024 + 1), files: ENTRIES }, product)
assert.deepStrictEqual(codesOf(huge), ['RA002'], 'an addon.json over 64 KB')

// Every problem links its page and says what is wrong and where.
for (const problem of judge({ text: null, files: [] }, product).problems) {
	assert.strictEqual(problem.url, `https://regletto.com/developers/errors/${problem.code}`, 'every problem links its page')
	assert.ok(problem.file && problem.message, 'and names its file and says what is wrong')
}

// A real folder: build, then read it back.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-check-'))
try {
	fs.writeFileSync(path.join(dir, 'addon.json'), JSON.stringify(SOUND))
	fs.writeFileSync(path.join(dir, 'addon.js'), '// a')
	fs.writeFileSync(path.join(dir, 'tray.js'), '// t')
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
	assert.ok(!check(dir, product).files.some((file) => file.name === 'notes.md' || file.name.startsWith('drafts/')), 'export-ignore leaves files out')

	const made = build(dir, product)
	assert.deepStrictEqual(made.problems, [])
	assert.strictEqual(path.basename(made.out), 'acme.sample-1.0.0.zip')
	const back = unzip(fs.readFileSync(made.out))
	assert.ok(!back.error, `the archive reads back: ${JSON.stringify(back.error)}`)
	assert.deepStrictEqual(
		[...back.files.keys()].sort(),
		['addon.js', 'addon.json', 'lib/Café menu.md', 'tray.js'],
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

	// No command, or a wrong one, prints the usage with the product's name.
	const help = run()
	assert.strictEqual(help.status, 0)
	assert.match(help.stdout, /for Regletto Sample/)
	assert.match(help.stdout, /Link this folder into Regletto Sample/)
	assert.strictEqual(run('publish').status, 1, 'a command that does not exist exits 1')
} finally {
	fs.rmSync(dir, { recursive: true, force: true })
}

console.log('check: every code falls as itself, the product speaks through, the archive reads back')
