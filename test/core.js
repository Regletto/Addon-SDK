// The base knows no product. Not one file the package ships names one: every
// product word comes from the product SDK that runs it. A product's name is
// therefore never written here, only `product.name`.
//
// The words checked are the products there are. A new product adds its own.

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const PRODUCT_WORDS = /writing/i

// Every file the package ships, from the `files` of package.json.
const shipped = []
const walk = (name) => {
	const at = path.join(ROOT, name)
	if (fs.statSync(at).isDirectory()) for (const entry of fs.readdirSync(at)) walk(path.join(name, entry))
	else shipped.push(name)
}
const pkg = require('../package.json')
pkg.files.forEach(walk)
assert.ok(shipped.length > 5, `the package ships ${shipped.length} files`)

for (const name of shipped) {
	fs.readFileSync(path.join(ROOT, name), 'utf8').split('\n').forEach((line, at) => {
		assert.ok(!PRODUCT_WORDS.test(line), `${name}:${at + 1} names a product: ${line.trim()}`)
	})
}
assert.ok(!PRODUCT_WORDS.test(pkg.description), 'package.json: the description names a product')
assert.ok(!pkg.bin, 'the base has no bin: the command is the product SDK\'s')

console.log(`core: ${shipped.length} files ship, and none of them names a product`)
