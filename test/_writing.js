// Where the Regletto Writing checkout lies, or an exit 2 (skipped) when there is
// none: the checks that hold the base to the first product need it. It is
// Writing/Program beside Platform, found from here up, so a worktree finds it too.

const fs = require('node:fs')
const path = require('node:path')

// The checkout, or null.
function find () {
	for (let dir = __dirname; dir !== path.dirname(dir); dir = path.dirname(dir)) {
		const there = path.join(dir, 'Writing', 'Program')
		if (fs.existsSync(path.join(there, 'src', 'manifest.js'))) return there
	}
	return null
}

module.exports = function writing () {
	const found = find()
	if (!found) {
		console.log('SKIPPED: no Regletto Writing checkout above this repository')
		process.exit(2)
	}
	return found
}
module.exports.find = find
