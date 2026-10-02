// regletto new: each template, freshly made, passes regletto check and carries
// $schema, the declarations and the SDK as a devDependency. That the schema
// takes each template's addon.json is test/schema.js.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { check } = require('../lib/check.js')
const { slug } = require('../lib/new.js')

const BIN = path.join(__dirname, '..', 'bin', 'regletto.js')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-new-'))
const regletto = (...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: 'utf8' })

// German umlauts are spelled out, other accents are stripped.
assert.strictEqual(slug('Meine Figuren'), 'meine-figuren')
assert.strictEqual(slug('Größe & Übersicht'), 'groesse-uebersicht')
assert.strictEqual(slug('Café'), 'cafe')
assert.strictEqual(slug('Crème brûlée'), 'creme-brulee', 'an accent inside a word does not split it')

// The files each template must produce, and no others.
const FILES = {
	workspace: ['.gitignore', 'addon.js', 'addon.json', 'jsconfig.json', 'package.json'],
	panel: ['.gitignore', 'addon.json', 'jsconfig.json', 'package.json', 'panel.js'],
	dialog: ['.gitignore', 'addon.json', 'dialog.js', 'jsconfig.json', 'package.json', 'panel.js']
}
// Files that are there to build with and stay out of the archive.
const BUILD_ONLY = ['.gitignore', 'jsconfig.json', 'package.json']

try {
	for (const [kind, files] of Object.entries(FILES)) {
		const target = path.join(root, kind)
		const made = regletto('new', target, '--title', `Café ${kind}`, '--publisher', 'acme', '--template', kind)
		assert.strictEqual(made.status, 0, made.stdout + made.stderr)
		assert.deepStrictEqual(fs.readdirSync(target).sort(), files, `${kind}: these files and no others`)

		const result = check(target)
		assert.deepStrictEqual(result.problems, [], `${kind}: a fresh one passes regletto check`)
		assert.strictEqual(result.manifest.id, `acme.cafe-${kind}`)
		assert.strictEqual(result.manifest.title, `Café ${kind}`)
		assert.deepStrictEqual(
			result.files.map((file) => file.name),
			files.filter((name) => !BUILD_ONLY.includes(name)),
			`${kind}: only what runs would go into the archive`
		)

		const manifest = JSON.parse(fs.readFileSync(path.join(target, 'addon.json'), 'utf8'))
		assert.strictEqual(manifest.$schema, './node_modules/@regletto/addon-sdk/addon.schema.json')

		const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
		assert.strictEqual(pkg.devDependencies['@regletto/addon-sdk'], '^' + require('../package.json').version)
		assert.deepStrictEqual(Object.keys(pkg.scripts), ['check', 'build', 'dev', 'logs'])

		const jsconfig = JSON.parse(fs.readFileSync(path.join(target, 'jsconfig.json'), 'utf8'))
		assert.ok(jsconfig.include.includes('node_modules/@regletto/addon-sdk/addon.d.ts'))
		assert.ok(jsconfig.include.includes('node_modules/@regletto/addon-sdk/writing.d.ts'))

		for (const name of files.filter((file) => file.endsWith('.js'))) {
			const syntax = spawnSync(process.execPath, ['--check', path.join(target, name)], { encoding: 'utf8' })
			assert.strictEqual(syntax.status, 0, `${kind}/${name}: ${syntax.stderr}`)
		}
	}

	const twice = regletto('new', path.join(root, 'panel'), '--title', 'X1', '--publisher', 'acme', '--template', 'panel')
	assert.strictEqual(twice.status, 1, 'a folder that is not empty is refused')
	const wrong = regletto('new', path.join(root, 'x'), '--title', 'X1', '--publisher', 'Acme', '--template', 'panel')
	assert.strictEqual(wrong.status, 1, 'a publisher in capitals is refused')
	assert.ok(!fs.existsSync(path.join(root, 'x')), 'and nothing is written')
} finally {
	fs.rmSync(root, { recursive: true, force: true })
}

console.log('new: every template comes out whole and passes regletto check')
