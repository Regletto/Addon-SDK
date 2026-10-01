// The VS Code extension for add-ons of Regletto Writing. It checks nothing
// itself: every command runs the SDK the project has in node_modules, and the
// problems are what `regletto check --json` says.

const vscode = require('vscode')
const fs = require('node:fs')
const path = require('node:path')
const { execFile, spawn } = require('node:child_process')

let output
let problems
let follower = null
let logChannel = null

// The folder of the open workspace that holds addon.json.
function folder () {
  const found = (vscode.workspace.workspaceFolders ?? []).find((one) => fs.existsSync(path.join(one.uri.fsPath, 'addon.json')))
  return found?.uri.fsPath ?? null
}

// The SDK of the project, never one of our own: the project's version decides.
function sdkOf (dir) {
  const bin = path.join(dir, 'node_modules', '@regletto', 'addon-sdk', 'bin', 'regletto.js')
  if (fs.existsSync(bin)) return bin
  vscode.window.showWarningMessage('@regletto/addon-sdk is not installed in this project. Run npm install.')
  return null
}

function run (dir, args) {
  const bin = sdkOf(dir)
  if (!bin) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile('node', [bin, ...args], { cwd: dir }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr })
    })
  })
}

// Where a field stands in addon.json, or the first line.
function rangeOf (dir, file, field) {
  if (file !== 'addon.json' || !field) return new vscode.Range(0, 0, 0, 0)
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n')
  const at = lines.findIndex((line) => line.includes(`"${field}"`))
  if (at < 0) return new vscode.Range(0, 0, 0, 0)
  const from = lines[at].indexOf(`"${field}"`)
  return new vscode.Range(at, from, at, from + field.length + 2)
}

async function refresh () {
  const dir = folder()
  if (!dir) return
  const said = await run(dir, ['check', '--json'])
  if (!said) return
  problems.clear()
  let found
  try { found = JSON.parse(said.stdout).problems } catch { return }
  const byFile = new Map()
  for (const one of found) {
    const file = one.file === '.' ? 'addon.json' : one.file
    const shown = new vscode.Diagnostic(rangeOf(dir, file, one.field), one.message, vscode.DiagnosticSeverity.Error)
    shown.code = { value: one.code, target: vscode.Uri.parse(one.url) }
    shown.source = 'regletto'
    byFile.set(file, [...(byFile.get(file) ?? []), shown])
  }
  for (const [file, list] of byFile) problems.set(vscode.Uri.file(path.join(dir, file)), list)
}

async function command (args) {
  const dir = folder()
  if (!dir) return vscode.window.showWarningMessage('No addon.json in this workspace.')
  const said = await run(dir, args)
  if (!said) return
  output.append(said.stdout + said.stderr)
  output.show(true)
  refresh()
  if (said.code !== 0) vscode.window.showErrorMessage(`regletto ${args[0]} found a problem. See Problems.`)
}

function logs () {
  const dir = folder()
  if (!dir) return vscode.window.showWarningMessage('No addon.json in this workspace.')
  const bin = sdkOf(dir)
  if (!bin) return
  logChannel ??= vscode.window.createOutputChannel('Regletto Log')
  const channel = logChannel
  channel.show(true)
  if (follower) return
  follower = spawn('node', [bin, 'logs'], { cwd: dir })
  follower.stdout.on('data', (chunk) => channel.append(String(chunk)))
  follower.stderr.on('data', (chunk) => channel.append(String(chunk)))
  follower.on('exit', () => { follower = null })
}

function activate (context) {
  output = vscode.window.createOutputChannel('Regletto')
  problems = vscode.languages.createDiagnosticCollection('regletto')
  context.subscriptions.push(
    output,
    problems,
    vscode.commands.registerCommand('regletto.build', () => command(['build'])),
    vscode.commands.registerCommand('regletto.dev', () => command(['dev'])),
    vscode.commands.registerCommand('regletto.logs', logs),
    vscode.workspace.onDidSaveTextDocument(refresh)
  )
  refresh()
}

function deactivate () {
  follower?.kill()
  logChannel?.dispose()
}

module.exports = { activate, deactivate }
