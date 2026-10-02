// regletto dev: the junction is laid and taken away, and the project behind it
// stands untouched either way. A folder that is not our link is never touched.
// Runs against a data folder of its own (--data), never against a product's,
// with the sample product (test/sample).
// Also regletto logs: which lines it prints, and from where.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { link, unlink } = require('../lib/dev.js')
const { linesAfter, levelOf } = require('../lib/logs.js')
const product = require('./sample/product.js')

const BIN = path.join(__dirname, 'sample', 'bin.js')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-dev-'))
const project = path.join(root, 'project')
const data = path.join(root, 'data')
const at = path.join(data, 'addons', 'acme.sample')

// Every file and folder of the project with its content, to see it unchanged.
const snapshot = () => fs.readdirSync(project, { recursive: true }).sort().map((name) => [
	name,
	fs.statSync(path.join(project, name)).isFile() ? fs.readFileSync(path.join(project, name), 'utf8') : '/'
])
const regletto = (...args) => spawnSync(process.execPath, [BIN, ...args], { cwd: project, encoding: 'utf8' })

try {
	fs.mkdirSync(path.join(project, 'lib'), { recursive: true })
	fs.writeFileSync(path.join(project, 'addon.json'), JSON.stringify({ id: 'acme.sample' }))
	fs.writeFileSync(path.join(project, 'addon.js'), '// a')
	fs.writeFileSync(path.join(project, 'lib', 'x.js'), '// x')
	const before = snapshot()

	// Laid, and led into the project.
	const laid = regletto('dev', '--data', data)
	assert.strictEqual(laid.status, 0, laid.stdout + laid.stderr)
	assert.ok(fs.lstatSync(at).isSymbolicLink(), 'a junction stands under the id')
	assert.strictEqual(fs.readFileSync(path.join(at, 'lib', 'x.js'), 'utf8'), '// x', 'and leads into the project')
	assert.ok(link(project, data, product).already, 'a second dev finds it laid')

	// Taken away again, and the project is as it was.
	const taken = regletto('dev', '--stop', '--data', data)
	assert.strictEqual(taken.status, 0, taken.stdout + taken.stderr)
	assert.ok(!fs.existsSync(at), 'the junction is gone')
	assert.deepStrictEqual(snapshot(), before, 'the project stands untouched')
	assert.strictEqual(unlink(project, data, product).gone, false, 'a second --stop has nothing to take')

	// An installed add-on of the same id is a folder, and it is left alone both ways.
	fs.mkdirSync(at, { recursive: true })
	fs.writeFileSync(path.join(at, 'addon.json'), '{}')
	assert.match(link(project, data, product).error, /installed add-on/)
	assert.match(unlink(project, data, product).error, /stays/)
	assert.strictEqual(fs.readFileSync(path.join(at, 'addon.json'), 'utf8'), '{}', 'the installed one is untouched')

	// A link to another folder is not ours to take.
	fs.rmSync(at, { recursive: true })
	const other = path.join(root, 'other')
	fs.mkdirSync(other)
	fs.symlinkSync(other, at, 'junction')
	assert.match(link(project, data, product).error, /already links/)
	assert.match(unlink(project, data, product).error, /stays/)
	assert.ok(fs.existsSync(other) && fs.lstatSync(at).isSymbolicLink(), 'both stand')

	// An id Windows cannot make a folder of is never linked.
	fs.writeFileSync(path.join(project, 'addon.json'), JSON.stringify({ id: 'nul.sample' }))
	assert.match(link(project, data, product).error, /no usable "id"/, 'a device name never becomes a folder')
} finally {
	fs.rmSync(root, { recursive: true, force: true })
}

// regletto logs prints from the last line shown, and all of it when that line
// fell out at the front of the file.
const lines = ['t1 INFO  workspace a', 't2 WARN  panel b', 't3 ERROR dialog c']
assert.deepStrictEqual(linesAfter(lines, null), lines)
assert.deepStrictEqual(linesAfter(lines, lines[1]), [lines[2]])
assert.deepStrictEqual(linesAfter(lines.slice(2), 't0 INFO  workspace gone'), [lines[2]])
assert.deepStrictEqual(lines.map(levelOf), ['info', 'warn', 'error'])

console.log('dev: the junction comes and goes, the project and every other folder stand untouched')
