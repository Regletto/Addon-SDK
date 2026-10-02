// A stand-in for a product's manifest check, so the base is tested without any
// real product. It reads only what the checks of the base ask about, in the shape
// every product answers: `{ ok, manifest }` or `{ ok: false, error: { code, field } }`.

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/
const ID_RE = /^(?=.{5,64}$)(?!.*\.part$)[a-z0-9][a-z0-9-]{1,63}\.[a-z0-9][a-z0-9-]{1,63}$/
const meaningfulTitle = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 40 && /[\p{L}\p{N}]/u.test(v)

const CODES = {
	noJson: 'RA001', form: 'RA002', missing: 'RA003', unknown: 'RA004', engine: 'RA005', name: 'RA006',
	mismatch: 'RA007', product: 'RA008', old: 'RA009', noManifest: 'RA010', noEntry: 'RA011', entry: 'RA012',
	tooMany: 'RA013', tooBig: 'RA014', tooLarge: 'RA015'
}

const FIELDS = ['$schema', 'id', 'title', 'version', 'engines', 'needs', 'tray']
const REQUIRED = ['id', 'title', 'version', 'engines', 'needs']

function read (text) {
	let parsed
	try {
		parsed = JSON.parse(text)
	} catch {
		return { ok: false, error: { code: CODES.noJson } }
	}
	const unknown = Object.keys(parsed).find((field) => !FIELDS.includes(field))
	if (unknown) return { ok: false, error: { code: CODES.unknown, field: unknown } }
	const missing = REQUIRED.find((field) => !Object.hasOwn(parsed, field))
	if (missing) return { ok: false, error: { code: CODES.missing, field: missing } }
	if (!ID_RE.test(parsed.id)) return { ok: false, error: { code: CODES.form, field: 'id' } }
	if (!Object.hasOwn(parsed.engines, 'sample')) return { ok: false, error: { code: CODES.product, field: 'engines' } }
	return { ok: true, manifest: parsed }
}

module.exports = { read, meaningfulTitle, NAME_RE, ID_RE, CODES }
