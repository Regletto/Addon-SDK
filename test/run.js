// Runs every check in test/, or those whose name holds one of the patterns:
//
//   node test/run.js            all
//   node test/run.js check new  check.js and new.js
//
// A check that exits 2 had no Regletto Writing checkout above this repository
// and is counted as skipped, not as green.

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const patterns = process.argv.slice(2)
const all = fs.readdirSync(__dirname)
	.filter((name) => name.endsWith('.js') && name !== 'run.js' && !name.startsWith('_'))
const chosen = patterns.length ? all.filter((name) => patterns.some((pattern) => name.includes(pattern))) : all
if (!chosen.length) {
	console.error(`No check matches ${patterns.join(' ')}.`)
	process.exit(1)
}

const tally = { passed: [], failed: [], skipped: [] }
for (const name of chosen) {
	const run = spawnSync(process.execPath, [path.join(__dirname, name)], { stdio: 'inherit' })
	const group = run.status === 0 ? 'passed' : run.status === 2 ? 'skipped' : 'failed'
	tally[group].push(name)
}
for (const [group, names] of Object.entries(tally)) {
	if (names.length) console.log(`${group.toUpperCase()}: ${names.join(' ')}`)
}
process.exit(tally.failed.length ? 1 : 0)
