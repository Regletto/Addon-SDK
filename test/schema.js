// schemaOf(): the schema of a product is the core schema with the product's
// part laid in, and the core stays as it was. Whether a product's schema agrees
// with that product's manifest check is the product's test (Writing:
// test/sdk-schema.js in its checkout), since only the product has the check.

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { schemaOf } = require('../lib/cli.js')
const product = require('./sample/product.js')

const file = path.join(__dirname, '..', 'addon.schema.json')
const core = JSON.parse(fs.readFileSync(file, 'utf8'))
const made = schemaOf(product)

assert.deepStrictEqual(made.properties.engines.required, ['sample'], 'engines asks for the product')
assert.match(made.properties.engines.properties.sample.description, /Regletto Sample/)
assert.strictEqual(made.properties.engines.properties.sample.pattern, core.properties.engines.additionalProperties.pattern)
assert.deepStrictEqual(made.properties.needs.items.enum, ['workspace', 'sample:poke'], 'the core permission and the product\'s')
assert.strictEqual(made.properties.needs.items.markdownEnumDescriptions.length, 2, 'each with its line')
assert.deepStrictEqual(made.properties.tray, product.schema.properties.tray, 'the product\'s own field')
assert.strictEqual(made.additionalProperties, false, 'and nothing else is allowed')
assert.match(made.description, /Regletto Sample/)
assert.ok(!('$id' in made), 'the product\'s schema does not claim the core\'s address')
assert.deepStrictEqual(made.$defs, core.$defs, 'the shared definitions come along, so every $ref resolves in the one file')

// The core is untouched: by schemaOf(), and in what it says.
assert.deepStrictEqual(require('../addon.schema.json'), core, 'schemaOf() leaves the core as it was')
assert.deepStrictEqual(core.properties.needs.items.enum, ['workspace'])
assert.ok(!core.properties.engines.required, 'the core asks for no product in engines')

console.log('schema: a product\'s schema is the core with its part, and the core stays the core')
