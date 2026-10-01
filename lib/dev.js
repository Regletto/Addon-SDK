// regletto dev: lay this folder into Regletto Writing's add-on folder, as a
// junction under the manifest's id. Writing's test bench does the same
// (tools/demo.js, linkAddons).
//
// **Writing does the rest.** A folder no install wrote is an Entwicklungs-Add-on:
// it is off until switched on, and once on it reloads by itself when a file
// changes. So this links and says where, and that is all.
//
// **--stop takes the junction away and never the folder behind it**: only a link
// that leads to this very folder is removed, and a link is removed as a link.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { parseArgs } = require('node:util')
const { ID_RE } = require('./manifest.js')
const { RESERVED } = require('./check.js')

// Electron's userData: the platform's app data folder plus the product name.
function dataOf (given) {
  if (given) return path.resolve(given)
  const home = os.homedir()
  const base = process.platform === 'win32' ? (process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'))
    : process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support')
      : (process.env.XDG_CONFIG_HOME ?? path.join(home, '.config'))
  return path.join(base, 'Regletto Writing')
}

// The id, if addon.json has one Writing will make a folder out of (usable() in
// Writing's src/addons.js). The rest of the manifest may still be broken: Writing
// then shows the card with its code, which is what one wants to see while working.
function idOf (dir) {
  const file = path.join(dir, 'addon.json')
  if (!fs.existsSync(file)) return { error: 'There is no addon.json in this folder.' }
  let id
  try { id = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')).id } catch {}
  if (typeof id !== 'string' || !ID_RE.test(id) || RESERVED.test(id.split('.')[0])) {
    return { error: 'addon.json has no usable "id". Run regletto check to see why.' }
  }
  return { id }
}

const same = (a, b) => path.relative(path.resolve(a), path.resolve(b)) === ''

// What stands at `link`: nothing, a link to `to`, a link elsewhere, or a folder.
function whatIs (link, to) {
  let stat
  try { stat = fs.lstatSync(link) } catch { return 'nothing' }
  if (!stat.isSymbolicLink()) return 'folder'
  return same(fs.readlinkSync(link), to) ? 'ours' : 'elsewhere'
}

function link (dir, data) {
  const { id, error } = idOf(dir)
  if (error) return { error }
  const into = path.join(data, 'addons')
  const at = path.join(into, id)
  const there = whatIs(at, dir)
  if (there === 'folder') return { error: `${at} is an installed add-on with this id. Remove it in Regletto Writing first.` }
  if (there === 'elsewhere') return { error: `${at} already links to ${fs.readlinkSync(at)}. Run regletto dev --stop in that folder first.` }
  if (there === 'nothing') {
    fs.mkdirSync(into, { recursive: true })
    fs.symlinkSync(dir, at, 'junction')
  }
  return { id, at, already: there === 'ours' }
}

function unlink (dir, data) {
  const { id, error } = idOf(dir)
  if (error) return { error }
  const at = path.join(data, 'addons', id)
  const there = whatIs(at, dir)
  if (there === 'nothing') return { id, at, gone: false }
  if (there !== 'ours') return { error: `${at} is not a link to this folder, so it stays.` }
  // A junction is a directory to Windows, so rmdir takes the link and leaves the
  // target; elsewhere it is a symlink, and unlink does the same.
  if (process.platform === 'win32') fs.rmdirSync(at)
  else fs.unlinkSync(at)
  return { id, at, gone: true }
}

function main (args) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { data: { type: 'string' }, stop: { type: 'boolean' } } })
  const dir = path.resolve(positionals[0] ?? '.')
  const data = dataOf(values.data)
  const said = values.stop ? unlink(dir, data) : link(dir, data)
  if (said.error) {
    console.log(said.error)
    return 1
  }
  if (values.stop) {
    console.log(said.gone ? `${said.at} removed. Your folder is untouched.` : `${said.id} was not linked.`)
    return 0
  }
  console.log(`${said.already ? 'Already linked' : 'Linked'}: ${said.at}`)
  console.log('In Regletto Writing: Add-ons, Installed, Reload, then switch it on. It reloads by itself when you save a file.')
  console.log(`The log: regletto logs${values.data ? ' --data ' + JSON.stringify(values.data) : ''}`)
  return 0
}

module.exports = { link, unlink, dataOf, idOf, main }
