// regletto dev: lay this folder into the product's add-on folder, as a junction
// (a symlink off Windows) under the manifest's id.
//
// The product does the rest. A folder that no install wrote is a development
// add-on: it is off until switched on, and once on it reloads by itself when a
// file changes. So this command links and says where, and that is all.
//
// `--stop` takes the link away and never the folder behind it: only a link that
// leads to this very folder is removed, and a link is removed as a link.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { parseArgs } = require('node:util')
const { RESERVED } = require('./check.js')

// Where the product keeps its data: the platform's app data folder plus the
// product's folder, which is what Electron calls `userData`. `given` overrides it
// (--data), so a test or a second installation can point somewhere else.
function dataOf (product, given) {
	if (given) return path.resolve(given)
	const home = os.homedir()
	let base
	if (process.platform === 'win32') base = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
	else if (process.platform === 'darwin') base = path.join(home, 'Library', 'Application Support')
	else base = process.env.XDG_CONFIG_HOME ?? path.join(home, '.config')
	return path.join(base, product.data)
}

// The id of the add-on in `dir`, if addon.json has one that the product will make
// a folder out of. The rest of the manifest may still be broken: the product then
// shows the card with its error code, which is what one wants to see while working.
//
// Answers `{ id }` or `{ error }`.
function idOf (dir, product) {
	const file = path.join(dir, 'addon.json')
	if (!fs.existsSync(file)) return { error: 'There is no addon.json in this folder.' }
	let id
	try {
		id = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')).id
	} catch {
		// Not JSON: the same answer as an id that is not usable.
	}
	if (typeof id !== 'string' || !product.manifest.ID_RE.test(id) || RESERVED.test(id.split('.')[0])) {
		return { error: 'addon.json has no usable "id". Run regletto check to see why.' }
	}
	return { id }
}

const isSame = (a, b) => path.relative(path.resolve(a), path.resolve(b)) === ''

// What stands at `link`: 'nothing', a link to `target` ('ours'), a link to
// somewhere else ('elsewhere'), or a real folder ('folder').
function stateOf (link, target) {
	let stat
	try {
		stat = fs.lstatSync(link)
	} catch {
		return 'nothing'
	}
	if (!stat.isSymbolicLink()) return 'folder'
	return isSame(fs.readlinkSync(link), target) ? 'ours' : 'elsewhere'
}

// Links `dir` into `data/addons/<id>`. Answers `{ id, at, already }`, where
// `already` says the link was there, or `{ error }`.
function link (dir, data, product) {
	const { id, error } = idOf(dir, product)
	if (error) return { error }
	const into = path.join(data, 'addons')
	const at = path.join(into, id)
	const state = stateOf(at, dir)
	if (state === 'folder') {
		return { error: `${at} is an installed add-on with this id. Remove it in ${product.name} first.` }
	}
	if (state === 'elsewhere') {
		return { error: `${at} already links to ${fs.readlinkSync(at)}. Run regletto dev --stop in that folder first.` }
	}
	if (state === 'nothing') {
		fs.mkdirSync(into, { recursive: true })
		fs.symlinkSync(dir, at, 'junction')
	}
	return { id, at, already: state === 'ours' }
}

// Takes the link away again. Answers `{ id, at, gone }`, where `gone` is false if
// there was nothing to take, or `{ error }`.
function unlink (dir, data, product) {
	const { id, error } = idOf(dir, product)
	if (error) return { error }
	const at = path.join(data, 'addons', id)
	const state = stateOf(at, dir)
	if (state === 'nothing') return { id, at, gone: false }
	if (state !== 'ours') return { error: `${at} is not a link to this folder, so it stays.` }
	// A junction is a directory to Windows, so rmdir takes the link and leaves the
	// target. Elsewhere it is a symlink, and unlink does the same.
	if (process.platform === 'win32') fs.rmdirSync(at)
	else fs.unlinkSync(at)
	return { id, at, gone: true }
}

function main (args, product) {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: { data: { type: 'string' }, stop: { type: 'boolean' } }
	})
	const dir = path.resolve(positionals[0] ?? '.')
	const data = dataOf(product, values.data)
	const result = values.stop ? unlink(dir, data, product) : link(dir, data, product)
	if (result.error) {
		console.log(result.error)
		return 1
	}
	if (values.stop) {
		console.log(result.gone ? `${result.at} removed. Your folder is untouched.` : `${result.id} was not linked.`)
		return 0
	}
	console.log(`${result.already ? 'Already linked' : 'Linked'}: ${result.at}`)
	console.log(`In ${product.name}: Add-ons, Installed, Reload, then switch it on. It reloads by itself when you save a file.`)
	console.log(`The log: regletto logs${values.data ? ' --data ' + JSON.stringify(values.data) : ''}`)
	return 0
}

module.exports = { link, unlink, dataOf, idOf, main }
