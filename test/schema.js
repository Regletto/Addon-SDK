// addon.schema.json follows lib/manifest.js and does not replace it: the same
// manifests, sound ones and one broken one per code, go to both, and this fails
// where they disagree.
//
// The validator below knows the keywords the schema uses and no others, and it
// throws on one it does not know, so the schema cannot grow a rule this check
// silently skips. Annotations (description and the like) are read past.
//
// What the schema cannot say, and so is left out of the examples: that a
// `default` lies among its options or between min and max, that row ids are
// unique, and the files beside the manifest. regletto check says those.

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const WRITING = require('./_writing.js')()
const { judge } = require('../lib/check.js')

const ROOT = path.join(__dirname, '..')
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'addon.schema.json'), 'utf8'))

// --- A validator for exactly the keywords addon.schema.json uses ---

const ANNOTATIONS = new Set([
	'$schema', '$id', '$defs', 'title', 'description', 'markdownDescription', 'markdownEnumDescriptions'
])

const typeOf = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v
const isType = (v, type) => type === 'number' ? typeof v === 'number' : typeOf(v) === type
const isObject = (v) => typeOf(v) === 'object'
const resolve = (ref) => ref.slice(2).split('/').reduce((at, key) => at[key], schema)

// One function per keyword: does the value `v` keep the `rule`? `s` is the
// schema the keyword stands in. A keyword about objects, arrays or strings is
// kept by every value of another kind.
const KEYWORDS = {
	type: (rule, v) => isType(v, rule),
	const: (rule, v) => v === rule,
	enum: (rule, v) => rule.includes(v),
	pattern: (rule, v) => typeof v !== 'string' || new RegExp(rule, 'u').test(v),
	minLength: (rule, v) => typeof v !== 'string' || [...v].length >= rule,
	maxLength: (rule, v) => typeof v !== 'string' || [...v].length <= rule,
	required: (rule, v) => !isObject(v) || rule.every((key) => Object.hasOwn(v, key)),
	properties: (rule, v) => !isObject(v) ||
		Object.entries(rule).every(([key, sub]) => !Object.hasOwn(v, key) || valid(sub, v[key])),
	additionalProperties: (rule, v, s) => !isObject(v) ||
		Object.keys(v).filter((key) => !Object.hasOwn(s.properties ?? {}, key))
			.every((key) => rule === false ? false : rule === true ? true : valid(rule, v[key])),
	propertyNames: (rule, v) => !isObject(v) || Object.keys(v).every((key) => valid(rule, key)),
	minProperties: (rule, v) => !isObject(v) || Object.keys(v).length >= rule,
	items: (rule, v) => !Array.isArray(v) || v.every((one) => valid(rule, one)),
	minItems: (rule, v) => !Array.isArray(v) || v.length >= rule,
	maxItems: (rule, v) => !Array.isArray(v) || v.length <= rule,
	oneOf: (rule, v) => rule.filter((sub) => valid(sub, v)).length === 1
}

function valid (s, v) {
	if (s.$ref) return valid(resolve(s.$ref), v) && valid({ ...s, $ref: undefined }, v)
	for (const [key, rule] of Object.entries(s)) {
		if (rule === undefined || ANNOTATIONS.has(key)) continue
		if (!Object.hasOwn(KEYWORDS, key)) throw new Error(`the schema uses "${key}", which this check does not know`)
		if (!KEYWORDS[key](rule, v, s)) return false
	}
	return true
}

// --- The manifests ---

const probe = JSON.parse(fs.readFileSync(path.join(WRITING, 'test', 'probe', 'addon.json'), 'utf8'))
// Writing's own first add-on, if it is checked out beside the program.
const goalAddon = path.join(WRITING, '..', 'Addons', 'Schreibziel', 'addon.json')
const ENTRIES = [{ name: 'addon.js', size: 1 }, { name: 'panel.js', size: 1 }]

const segment = (options) => ({ id: 'a', type: 'segment', label: 'A', options, default: 'x' })

// [name, change]: the probe's manifest after `change`. A name that starts with an
// error code is a manifest that must fall with exactly that code.
const cases = [
	['the probe', () => {}],
	['no settings, no panel', (m) => { delete m.settings; delete m.panel }],
	['a $schema', (m) => { m.$schema = './node_modules/@regletto/addon-sdk/addon.schema.json' }],

	// Titles.
	['a plain title', (m) => { m.title = 'Probe' }],
	['title of 40', (m) => { m.title = 'x'.repeat(40) }],
	['an emoji counts once', (m) => { m.title = 'x'.repeat(39) + '\u{1F600}' }],
	['RA002 title of 41', (m) => { m.title = 'x'.repeat(41) }],
	['RA002 title of blanks', (m) => { m.title = '   ' }],
	['RA002 title of signs only', (m) => { m.title = '…' }],
	['RA002 an empty language map', (m) => { m.title = {} }],
	['RA002 a language key of three', (m) => { m.title = { deu: 'Probe' } }],
	['RA002 a control character', (m) => { m.description = 'a\u0007b' }],
	['RA002 a right-to-left override', (m) => { m.author = 'a‮b' }],

	// The other required fields.
	['RA002 version', (m) => { m.version = '1.0' }],
	['RA002 id without publisher', (m) => { m.id = 'probe' }],
	['RA002 id ending .part', (m) => { m.id = 'regletto.part' }],
	['RA002 id in capitals', (m) => { m.id = 'Regletto.probe' }],
	['RA002 icon', (m) => { m.icon = 'Science' }],
	['RA002 old need', (m) => { m.needs = ['read'] }],
	['RA002 engines without >=', (m) => { m.engines = { writing: '0.9.0' } }],

	// Settings.
	['RA002 settings empty', (m) => { m.settings = [] }],
	['RA002 a row of an unknown type', (m) => { m.settings[0].type = 'path' }],
	['RA002 a row with an unknown key', (m) => { m.settings[0].colour = 'red' }],
	['RA002 a switch with a number', (m) => { m.settings[0].default = 1 }],
	['RA002 a number without max', (m) => { delete m.settings[1].max }],
	['RA002 a segment of one option', (m) => { m.settings[0] = segment([{ value: 'x', label: 'X' }]) }],
	['a segment of two', (m) => { m.settings[0] = segment([{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]) }],
	['a text row', (m) => { m.settings[0] = { id: 'a', type: 'text', label: 'A', default: '' } }],

	// The panel.
	['RA002 panel without about', (m) => { delete m.panel.about }],
	['RA002 panel with more', (m) => { m.panel.order = 1 }],

	// The other codes.
	['RA003 no author', (m) => { delete m.author }],
	['RA003 no needs', (m) => { delete m.needs }],
	['RA004 a field that does not exist', (m) => { m.colour = 'red' }],
	['RA004 the old name', (m) => { m.name = 'probe' }],
	['RA006 a device as publisher', (m) => { m.id = 'nul.probe' }],
	['RA008 no writing in engines', (m) => { m.engines = { other: '>=1.0.0' } }],
	['another product beside writing', (m) => { m.engines.other = '>=1.0.0' }]
]

const examples = cases.map(([name, change]) => {
	const manifest = structuredClone(probe)
	change(manifest)
	return [name, manifest]
})
if (fs.existsSync(goalAddon)) examples.push(['Schreibziel', JSON.parse(fs.readFileSync(goalAddon, 'utf8'))])

// Each template's addon.json, with its {{marks}} filled in.
const SAMPLE = { id: 'acme.sample', title: 'Sample', author: 'acme' }
for (const kind of ['workspace', 'panel', 'dialog']) {
	const text = fs.readFileSync(path.join(ROOT, 'templates', kind, 'addon.json'), 'utf8')
		.replace(/\{\{(\w+)\}\}/g, (_, key) => JSON.stringify(SAMPLE[key]))
	examples.push([`the ${kind} template`, JSON.parse(text)])
}

// --- The comparison ---

let disagree = 0
for (const [name, manifest] of examples) {
	const sdk = judge({ text: JSON.stringify(manifest), files: ENTRIES }).problems
	const ide = valid(schema, manifest)
	const expected = name.match(/^RA\d+/)?.[0]
	if (expected) assert.deepStrictEqual(sdk.map((problem) => problem.code), [expected], `${name}: regletto check says ${expected}`)
	else assert.deepStrictEqual(sdk, [], `${name}: regletto check takes it`)
	if (ide !== (sdk.length === 0)) {
		disagree++
		const schemaSays = ide ? 'sound' : 'broken'
		const checkSays = sdk.length ? sdk[0].code : 'sound'
		console.error(`DISAGREE ${name}: the schema says ${schemaSays}, regletto check ${checkSays}`)
	}
}
assert.strictEqual(disagree, 0, `${disagree} manifests are judged differently by the schema and by regletto check`)

console.log(`schema: ${examples.length} manifests, the schema and regletto check agree on each`)
