// regletto build: check, then write the archive to dist/<id>-<version>.zip.
//
// Nothing is bundled, translated or signed: what lies in the archive is what
// runs. The archive is the one check() packed, so what was checked is what is
// written.

const fs = require('node:fs')
const path = require('node:path')
const { check, print, folderOf } = require('./check.js')

// Answers what check() answers, plus `out`, the path of the archive. If there are
// problems nothing is written.
function build (dir, product) {
	const result = check(dir, product)
	if (result.problems.length) return result
	const out = path.join(dir, 'dist', `${result.manifest.id}-${result.manifest.version}.zip`)
	fs.mkdirSync(path.dirname(out), { recursive: true })
	fs.writeFileSync(out, result.archive)
	return { ...result, out }
}

function main (args, product) {
	const result = build(folderOf(args), product)
	if (result.problems.length) {
		print(result.problems)
		console.log('Nothing was built.')
		return 1
	}
	const kilobytes = (result.archive.length / 1024).toFixed(1)
	console.log(`${path.relative(process.cwd(), result.out)} written, ${result.files.length} files, ${kilobytes} KB.`)
	console.log(`Drag it into the ${product.name} window to install it.`)
	return 0
}

module.exports = { build, main }
