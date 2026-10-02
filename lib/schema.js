// The schema of a product's addon.json: the core schema, addon.schema.json beside
// this folder, with what the product adds. A product SDK writes the result into
// its package, so the editor reads one file and follows no reference into
// another package.
//
// What a product adds: its key in `engines`, which is required there; its
// permissions in `needs`; and its own fields, such as a surface only it has.

const CORE = require('../addon.schema.json')

function schemaOf (product) {
	const schema = structuredClone(CORE)
	delete schema.$id
	schema.description = `The manifest of an add-on for ${product.name}. Help for the editor only: regletto check decides. https://regletto.com/developers`

	const { engines, needs } = schema.properties
	engines.required = [product.key]
	engines.properties = {
		[product.key]: { description: `The oldest ${product.name} this add-on runs in, as >=x.y.z.`, ...engines.additionalProperties }
	}
	needs.items.enum.push(...Object.keys(product.schema.needs))
	needs.items.markdownEnumDescriptions.push(...Object.values(product.schema.needs))

	Object.assign(schema.properties, structuredClone(product.schema.properties))
	return schema
}

module.exports = { schemaOf }
