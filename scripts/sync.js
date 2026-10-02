// Pulls what the SDK takes from Regletto Writing. For maintainers: it needs the
// private Writing checkout beside this repository (Writing/Program), so users of
// the package never run it.
//
//   node scripts/sync.js        (or: npm run sync)
//
// What it writes:
//
//   lib/manifest.js   the one manifest check, the file Writing itself runs
//   lib/zip.js        the archive reader and writer
//   example/          the example project: three books and three binders, see
//                     scripts/example.js
//
// The two lib files differ from Writing's only in their indentation (tabs here,
// two spaces there, see scripts/tabs.js). They are committed so the package
// carries them, and test/same.js fails the day they drift from the checkout.
// Never edit them here; change them in Writing and sync.

const fs = require('node:fs')
const path = require('node:path')
const tabbed = require('./tabs.js')
const writeExample = require('./example.js')

const ROOT = path.join(__dirname, '..')
const WRITING = path.join(ROOT, '..', '..', 'Writing', 'Program')
const COPIES = { 'lib/manifest.js': 'src/manifest.js', 'lib/zip.js': 'src/zip.js' }

if (!fs.existsSync(path.join(WRITING, 'src', 'manifest.js'))) {
	console.error(`No Regletto Writing checkout at ${WRITING}.`)
	process.exit(1)
}

for (const [mine, theirs] of Object.entries(COPIES)) {
	const source = fs.readFileSync(path.join(WRITING, theirs), 'utf8')
	fs.writeFileSync(path.join(ROOT, mine), tabbed(source))
	console.log(`${mine} copied from ${theirs}.`)
}

// The example project is written with Writing's own editor.js, which knows how a
// chapter is stored and how its words are counted.
console.log('example/Example Project:')
writeExample(ROOT, require(path.join(WRITING, 'src', 'editor.js')))
