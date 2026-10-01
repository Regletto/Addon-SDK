// The SDK checks with Writing's files, not with a rebuild of them:
// lib/manifest.js and lib/zip.js are byte for byte the checkout's, and the
// limits lib/check.js writes out are the ones src/addons.js and
// src/addonload.js hold. Fix a failure with `npm run sync`, never by hand.

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const WRITING = require('./_writing.js')()
const check = require('../lib/check.js')

const ROOT = path.join(__dirname, '..')
// Line ends aside: git may check either repository out with CRLF.
const text = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
for (const [mine, theirs] of [['lib/manifest.js', 'src/manifest.js'], ['lib/zip.js', 'src/zip.js']]) {
  assert.strictEqual(text(path.join(ROOT, mine)), text(path.join(WRITING, theirs)),
    `${mine} differs from Writing's ${theirs}. Run npm run sync.`)
}

const source = (file) => fs.readFileSync(path.join(WRITING, 'src', file), 'utf8')
const addons = source('addons.js')
const valueOf = (text, name) => {
  const found = text.match(new RegExp(`^const ${name} = (.+)$`, 'm'))
  assert.ok(found, `Writing has no "const ${name}" any more`)
  return found[1].trim()
}
assert.strictEqual(valueOf(addons, 'RESERVED'), String(check.RESERVED), 'RESERVED drifted from src/addons.js')
assert.strictEqual(valueOf(addons, 'UNSAFE'), String(check.UNSAFE), 'UNSAFE drifted from src/addons.js')
assert.strictEqual(eval(valueOf(addons, 'MOST_DEPTH')), check.MOST_DEPTH, 'MOST_DEPTH drifted from src/addons.js')
assert.strictEqual(eval(valueOf(addons, 'MOST_PATH')), check.MOST_PATH, 'MOST_PATH drifted from src/addons.js')
assert.strictEqual(eval(valueOf(addons, 'MOST_MANIFEST')), check.MOST_MANIFEST, 'MOST_MANIFEST drifted from src/addons.js')
assert.strictEqual(eval(valueOf(source('addonload.js'), 'MOST')), check.MOST_ARCHIVE, 'the 32 MB of src/addonload.js drifted')

console.log('same: lib/manifest.js, lib/zip.js and the limits are Writing\'s')
