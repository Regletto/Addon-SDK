// The base holds what every product does the same to the first product's files,
// not to a rebuild of them:
//
//   * lib/zip.js is Writing's src/zip.js, and differs from it in its indentation
//     only (tabs here, see scripts/tabs.js);
//   * the limits lib/check.js writes out are the ones src/addons.js and
//     src/addonload.js hold in Writing.
//
// Fix a failure of the first with `npm run sync`, never by hand.

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const WRITING = require('./_writing.js')()
const tabbed = require('../scripts/tabs.js')
const check = require('../lib/check.js')

const ROOT = path.join(__dirname, '..')

// The copy. Line ends aside: git may check either repository out with CRLF.
assert.strictEqual(
	tabbed(fs.readFileSync(path.join(ROOT, 'lib', 'zip.js'), 'utf8')),
	tabbed(fs.readFileSync(path.join(WRITING, 'src', 'zip.js'), 'utf8')),
	'lib/zip.js differs from Writing\'s src/zip.js. Run npm run sync.'
)

// The limits. Each is a line `const NAME = value` in Writing's source.
const source = (file) => fs.readFileSync(path.join(WRITING, 'src', file), 'utf8')
const addons = source('addons.js')
const valueOf = (text, name) => {
	const found = text.match(new RegExp(`^const ${name} = (.+)$`, 'm'))
	assert.ok(found, `Writing has no "const ${name}" any more`)
	return found[1].trim()
}

assert.strictEqual(valueOf(addons, 'RESERVED'), String(check.RESERVED), 'RESERVED drifted from src/addons.js')
assert.strictEqual(valueOf(addons, 'UNSAFE'), String(check.UNSAFE), 'UNSAFE drifted from src/addons.js')
for (const name of ['MOST_DEPTH', 'MOST_PATH', 'MOST_MANIFEST']) {
	assert.strictEqual(eval(valueOf(addons, name)), check[name], `${name} drifted from src/addons.js`)
}
assert.strictEqual(eval(valueOf(source('addonload.js'), 'MOST')), check.MOST_ARCHIVE, 'the 32 MB of src/addonload.js drifted')

console.log('same: lib/zip.js and the limits are Writing\'s')
