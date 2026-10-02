// The VS Code extension for add-ons of Regletto Writing.
//
// It checks nothing itself. Every command runs the SDK that the project has in
// node_modules, and the problems shown are what `regletto check --json` says. So
// the version of the SDK in the project decides, never one bundled here.

const vscode = require('vscode')
const fs = require('node:fs')
const path = require('node:path')
const { execFile, spawn } = require('node:child_process')

// Set in activate(), used by the commands.
let output          // the "Regletto" output channel: what a command printed
let problems        // the diagnostics shown in the Problems panel
let follower = null // the running `regletto logs`, if the log is being followed
let logChannel = null

// The folder of the open workspace that holds addon.json, or null.
function addonFolder () {
	const folders = vscode.workspace.workspaceFolders ?? []
	const found = folders.find((folder) => fs.existsSync(path.join(folder.uri.fsPath, 'addon.json')))
	return found?.uri.fsPath ?? null
}

// The command line tool of the SDK in this project, or null (with a hint).
function sdkOf (dir) {
	const bin = path.join(dir, 'node_modules', '@regletto', 'addon-sdk', 'bin', 'regletto.js')
	if (fs.existsSync(bin)) return bin
	vscode.window.showWarningMessage('@regletto/addon-sdk is not installed in this project. Run npm install.')
	return null
}

// Runs `regletto <args>` in `dir`. Resolves to `{ code, stdout, stderr }`, or to
// null if the project has no SDK.
function runSdk (dir, args) {
	const bin = sdkOf(dir)
	if (!bin) return Promise.resolve(null)
	return new Promise((resolve) => {
		execFile('node', [bin, ...args], { cwd: dir }, (error, stdout, stderr) => {
			resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr })
		})
	})
}

// Where a field stands in addon.json, or the first line when that is not known.
function rangeOf (dir, file, field) {
	if (file !== 'addon.json' || !field) return new vscode.Range(0, 0, 0, 0)
	const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n')
	const at = lines.findIndex((line) => line.includes(`"${field}"`))
	if (at < 0) return new vscode.Range(0, 0, 0, 0)
	const from = lines[at].indexOf(`"${field}"`)
	return new vscode.Range(at, from, at, from + field.length + 2)
}

// Runs `regletto check` and shows what it finds as problems, at the file and the
// field. Runs on activation and whenever a document is saved.
async function refresh () {
	const dir = addonFolder()
	if (!dir) return
	const result = await runSdk(dir, ['check', '--json'])
	if (!result) return
	problems.clear()

	let found
	try {
		found = JSON.parse(result.stdout).problems
	} catch {
		return
	}

	const byFile = new Map()
	for (const problem of found) {
		// A problem about the whole folder ('.') is shown on addon.json.
		const file = problem.file === '.' ? 'addon.json' : problem.file
		const diagnostic = new vscode.Diagnostic(rangeOf(dir, file, problem.field), problem.message, vscode.DiagnosticSeverity.Error)
		diagnostic.code = { value: problem.code, target: vscode.Uri.parse(problem.url) }
		diagnostic.source = 'regletto'
		byFile.set(file, [...(byFile.get(file) ?? []), diagnostic])
	}
	for (const [file, diagnostics] of byFile) problems.set(vscode.Uri.file(path.join(dir, file)), diagnostics)
}

// Runs a one-shot command (`build`, `dev`) and shows what it printed.
async function runCommand (args) {
	const dir = addonFolder()
	if (!dir) return vscode.window.showWarningMessage('No addon.json in this workspace.')
	const result = await runSdk(dir, args)
	if (!result) return
	output.append(result.stdout + result.stderr)
	output.show(true)
	refresh()
	if (result.code !== 0) vscode.window.showErrorMessage(`regletto ${args[0]} found a problem. See Problems.`)
}

// Follows the add-on's log in an output channel of its own.
function showLog () {
	const dir = addonFolder()
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
		vscode.commands.registerCommand('regletto.build', () => runCommand(['build'])),
		vscode.commands.registerCommand('regletto.dev', () => runCommand(['dev'])),
		vscode.commands.registerCommand('regletto.logs', showLog),
		vscode.workspace.onDidSaveTextDocument(refresh)
	)
	refresh()
}

function deactivate () {
	follower?.kill()
	logChannel?.dispose()
}

module.exports = { activate, deactivate }
