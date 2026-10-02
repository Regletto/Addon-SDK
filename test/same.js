// The SDK checks with Writing's files, not with a rebuild of them:
//
//   * lib/manifest.js and lib/zip.js are the checkout's files, and differ from
//     them in their indentation only (tabs here, see scripts/tabs.js);
//   * the limits lib/check.js writes out are the ones src/addons.js and
//     src/addonload.js hold in Writing.
//
// Fix a failure with `npm run sync`, never by hand.

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const WRITING = require('./_writing.js')()
const tabbed = require('../scripts/tabs.js')
const check = require('../lib/check.js')

const ROOT = path.join(__dirname, '..')

// The copies. Line ends aside: git may check either repository out with CRLF.
for (const [mine, theirs] of [['lib/manifest.js', 'src/manifest.js'], ['lib/zip.js', 'src/zip.js']]) {
	assert.strictEqual(
		tabbed(fs.readFileSync(path.join(ROOT, mine), 'utf8')),
		tabbed(fs.readFileSync(path.join(WRITING, theirs), 'utf8')),
		`${mine} differs from Writing's ${theirs}. Run npm run sync.`
	)
}

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

console.log('same: lib/manifest.js, lib/zip.js and the limits are Writing\'s')
