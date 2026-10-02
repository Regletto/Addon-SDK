// Where the Regletto Writing checkout lies beside this repository, or an exit 2
// (skipped) when it does not: the checks that hold the SDK to Writing need it.

const fs = require('node:fs')
const path = require('node:path')

const WRITING = path.join(__dirname, '..', '..', '..', 'Writing', 'Program')

module.exports = function writing () {
	if (!fs.existsSync(path.join(WRITING, 'src', 'manifest.js'))) {
		console.log(`SKIPPED: no Regletto Writing checkout at ${WRITING}`)
		process.exit(2)
	}
	return WRITING
}
