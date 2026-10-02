// Pulls the one file the base takes from Regletto Writing, the first product.
// For maintainers: it needs the private Writing checkout beside this repository
// (Writing/Program), so users of the package never run it.
//
//   node scripts/sync.js        (or: npm run sync)
//
// What it writes:
//
//   lib/zip.js   the archive reader and writer, the same in every product
//
// It differs from Writing's only in its indentation (tabs here, two spaces there,
// see scripts/tabs.js). It is committed so the package carries it, and
// test/same.js fails the day it drifts from the checkout. Never edit it here;
// change it in Writing and sync.
//
// The manifest check is not copied: it is each product's own, and its SDK hands
// it in (lib/cli.js).

const fs = require('node:fs')
const path = require('node:path')
const tabbed = require('./tabs.js')

const ROOT = path.join(__dirname, '..')
const WRITING = require('../test/_writing.js').find()

if (!WRITING) {
	console.error('No Regletto Writing checkout above this repository.')
	process.exit(1)
}

fs.writeFileSync(path.join(ROOT, 'lib', 'zip.js'), tabbed(fs.readFileSync(path.join(WRITING, 'src', 'zip.js'), 'utf8')))
console.log('lib/zip.js copied from src/zip.js.')
