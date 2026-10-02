// regletto new, run with the sample product (test/sample): a template comes out
// with its marks filled in, the SDK of the product as the devDependency, and
// passes regletto check. That every template of a real product does is that
// product's check.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { check } = require('../lib/check.js')
const { slug } = require('../lib/new.js')
const product = require('./sample/product.js')

const BIN = path.join(__dirname, 'sample', 'bin.js')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-new-'))
const regletto = (...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: 'utf8' })

// German umlauts are spelled out, other accents are stripped.
assert.strictEqual(slug('Meine Figuren'), 'meine-figuren')
assert.strictEqual(slug('Größe & Übersicht'), 'groesse-uebersicht')
assert.strictEqual(slug('Café'), 'cafe')
assert.strictEqual(slug('Crème brûlée'), 'creme-brulee', 'an accent inside a word does not split it')

try {
	const target = path.join(root, 'plain')
	const made = regletto('new', target, '--title', 'Café plain', '--publisher', 'acme', '--template', 'plain')
	assert.strictEqual(made.status, 0, made.stdout + made.stderr)
	assert.deepStrictEqual(fs.readdirSync(target).sort(), ['addon.js', 'addon.json', 'package.json'], 'common/ and plain/, and nothing else')
	assert.match(made.stdout, /node_modules[\\/]@regletto[\\/]sample-addon-sdk[\\/]example\. In Regletto Sample: Open\./, 'the example of the product')

	const result = check(target, product)
	assert.deepStrictEqual(result.problems, [], 'a fresh one passes regletto check')
	assert.strictEqual(result.manifest.id, 'acme.cafe-plain')
	assert.strictEqual(result.manifest.title, 'Café plain')

	const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
	assert.strictEqual(pkg.devDependencies['@regletto/sample-addon-sdk'], '^2.3.4', 'the version of the product SDK')
	assert.strictEqual(fs.readFileSync(path.join(target, 'addon.js'), 'utf8'), '// "Café plain"\naddon.log.info("acme.cafe-plain")\n')

	const twice = regletto('new', target, '--title', 'X1', '--publisher', 'acme', '--template', 'plain')
	assert.strictEqual(twice.status, 1, 'a folder that is not empty is refused')
	const wrong = regletto('new', path.join(root, 'x'), '--title', 'X1', '--publisher', 'Acme', '--template', 'plain')
	assert.strictEqual(wrong.status, 1, 'a publisher in capitals is refused')
	const kind = regletto('new', path.join(root, 'y'), '--title', 'X1', '--publisher', 'acme', '--template', 'panel')
	assert.strictEqual(kind.status, 1, 'a kind the product does not have is refused')
	assert.match(kind.stdout, /one of: plain/)
	assert.ok(!fs.existsSync(path.join(root, 'x')) && !fs.existsSync(path.join(root, 'y')), 'and nothing is written')
} finally {
	fs.rmSync(root, { recursive: true, force: true })
}

console.log('new: the template of the product comes out whole and passes regletto check')
