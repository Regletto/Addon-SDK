// The VS Code extension finds the product SDK of the project: the package the
// project names that carries bin/regletto.js, never the base, never the SDK of
// a product the project does not name. Runs without VS Code: `vscode` is a
// stand-in that only counts its warnings.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const warnings = []
const STAND_IN = path.join(__dirname, 'vscode-stand-in')
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
	return request === 'vscode' ? STAND_IN : resolve.call(this, request, ...rest)
}
require.cache[STAND_IN] = { id: STAND_IN, filename: STAND_IN, loaded: true, exports: { window: { showWarningMessage: (text) => warnings.push(text) } } }
const { sdkOf } = require('../vscode/extension.js')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-vscode-'))
const sdk = (name, withBin) => {
	const dir = path.join(root, 'node_modules', '@regletto', name)
	fs.mkdirSync(path.join(dir, 'bin'), { recursive: true })
	if (withBin) fs.writeFileSync(path.join(dir, 'bin', 'regletto.js'), '')
	return path.join(dir, 'bin', 'regletto.js')
}
const name = (devDependencies) => fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ devDependencies }))

try {
	sdk('addon-sdk', false)
	const writing = sdk('writing-addon-sdk', true)
	sdk('other-addon-sdk', true)

	name({ '@regletto/writing-addon-sdk': '^1.0.0' })
	assert.strictEqual(sdkOf(root), writing, 'the product SDK the project names')

	name({ '@regletto/addon-sdk': '^1.0.0' })
	assert.strictEqual(sdkOf(root), null, 'the base alone is no SDK to run, and another product\'s is not taken')
	assert.strictEqual(warnings.length, 1, 'and the author hears what to install')
} finally {
	fs.rmSync(root, { recursive: true, force: true })
}

console.log('vscode: the extension runs the SDK of the product the project names')
