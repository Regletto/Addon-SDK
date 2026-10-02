// regletto logs: print the add-on's log and follow it.
//
// Writing writes `<userData>/logs/addons/<id>.log`, one entry per line:
//
//   2026-10-01T17:04:12.345Z WARN  workspace the words the add-on wrote
//
// The file is replaced whole on every write (a .tmp file and a rename) and loses
// its oldest lines at the front once it is full. So it is polled rather than
// watched, read whole, and printed from the last line already shown.

const fs = require('node:fs')
const path = require('node:path')
const { parseArgs } = require('node:util')
const { dataOf, idOf } = require('./dev.js')

const LEVELS = ['debug', 'info', 'warn', 'error']

// The level of a log line: its second word, in lower case.
const levelOf = (line) => (line.split(' ')[1] ?? '').toLowerCase()

// The lines after `last`. All of them if `last` is null or has fallen out at the
// front of the file.
function linesAfter (lines, last) {
	if (last === null) return lines
	const at = lines.lastIndexOf(last)
	return at < 0 ? lines : lines.slice(at + 1)
}

// The lines of the log file, none if it is not there (yet).
function readLines (file) {
	try {
		return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
	} catch {
		return []
	}
}

function main (args) {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: { data: { type: 'string' }, level: { type: 'string' } }
	})
	const least = LEVELS.indexOf(values.level ?? 'debug')
	if (least < 0) {
		console.log(`--level is one of ${LEVELS.join(', ')}.`)
		return 1
	}
	const { id, error } = idOf(path.resolve(positionals[0] ?? '.'))
	if (error) {
		console.log(error)
		return 1
	}
	const file = path.join(dataOf(values.data), 'logs', 'addons', id + '.log')
	if (!fs.existsSync(file)) console.log(`No log yet at ${file}. Waiting for the first line.`)

	let last = null
	const show = () => {
		const lines = readLines(file)
		for (const line of linesAfter(lines, last)) {
			if (LEVELS.indexOf(levelOf(line)) >= least) console.log(line)
		}
		if (lines.length) last = lines[lines.length - 1]
	}
	show()
	fs.watchFile(file, { interval: 300 }, show)
	// Runs until Ctrl+C.
	return new Promise(() => {})
}

module.exports = { main, linesAfter, levelOf }
