// regletto check and build:
//
//   * Writing's own probe (test/probe/) passes,
//   * one folder per error code the SDK can raise fails with exactly that code,
//   * build writes an archive that Writing's reader (src/zip.js of the checkout)
//     reads back whole, with only what runs in it,
//   * the command exits non-zero on a problem, so it serves in a CI.
//
// RA005 and RA007 are Writing's alone: the SDK knows no version of Writing to
// compare `engines` with, and no catalog entry to compare the id with.

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const WRITING = require('./_writing.js')()
const { judge, check } = require('../lib/check.js')
const { build } = require('../lib/build.js')

const BIN = path.join(__dirname, '..', 'bin', 'regletto.js')
const probe = JSON.parse(fs.readFileSync(path.join(WRITING, 'test', 'probe', 'addon.json'), 'utf8'))
const ENTRIES = [{ name: 'addon.js', size: 1 }, { name: 'panel.js', size: 1 }]

// The probe folder itself.
const own = check(path.join(WRITING, 'test', 'probe'))
assert.deepStrictEqual(own.problems, [], 'Writing\'s probe passes regletto check')
assert.strictEqual(own.manifest.id, 'regletto.probe')

const codesOf = (said) => said.problems.map((one) => one.code)
const withManifest = (change, files = ENTRIES) => {
  const copy = structuredClone(probe)
  change(copy)
  return codesOf(judge({ text: JSON.stringify(copy), files }))
}

assert.deepStrictEqual(withManifest(() => {}), [], 'the probe\'s manifest with its entries is sound')
assert.deepStrictEqual(codesOf(judge({ text: '{ "id": ', files: ENTRIES })), ['RA001'])
assert.deepStrictEqual(withManifest((m) => { m.version = '1.0' }), ['RA002'])
assert.deepStrictEqual(withManifest((m) => { delete m.author }), ['RA003'])
assert.deepStrictEqual(withManifest((m) => { m.colour = 'red' }), ['RA004'])
assert.deepStrictEqual(withManifest((m) => { m.id = 'nul.probe' }), ['RA006'])
assert.deepStrictEqual(withManifest((m) => { m.engines = { other: '>=1.0.0' } }), ['RA008'])
assert.deepStrictEqual(codesOf(judge({ text: null, files: [{ name: 'regletto.json', size: 2 }] })), ['RA009'])
assert.deepStrictEqual(codesOf(judge({ text: null, files: [] })), ['RA010'])
assert.deepStrictEqual(withManifest(() => {}, [{ name: 'panel.js', size: 1 }]), ['RA011'], 'needs workspace, no addon.js')
assert.deepStrictEqual(withManifest(() => {}, [{ name: 'addon.js', size: 1 }]), ['RA011'], 'panel, no panel.js')
for (const name of ['nul/x.js', 'a:b.js', 'x.', 'lib\\x.js', 'a/b/c/d/e/f/g/h/i.js', 'x'.repeat(121), 'rtl‮evil.js']) {
  assert.deepStrictEqual(withManifest(() => {}, [...ENTRIES, { name, size: 1 }]), ['RA012'], `${JSON.stringify(name)} is refused`)
}
assert.deepStrictEqual(withManifest(() => {}, [...ENTRIES, { name: 'Anleitung für Autoren.md', size: 1 }]), [], 'a space and an umlaut are fine')
const many = Array.from({ length: 10000 }, (_, at) => ({ name: `f${at}.js`, size: 1 }))
assert.deepStrictEqual(withManifest(() => {}, [...ENTRIES, ...many]), ['RA013'])
assert.deepStrictEqual(withManifest(() => {}, [...ENTRIES, { name: 'big.bin', size: 256 * 1024 * 1024 }]), ['RA014'])
assert.ok(judge({ text: ' '.repeat(64 * 1024 + 1), files: ENTRIES }).problems[0].code === 'RA002', 'an addon.json over 64 KB')
for (const one of judge({ text: null, files: [] }).problems) {
  assert.strictEqual(one.url, `https://regletto.com/developers/errors/${one.code}`, 'every problem links its page')
  assert.ok(one.file && one.message, 'and names its file and says what is wrong')
}

// A real folder: build, then read it back through Writing's own reader.
const unzip = require(path.join(WRITING, 'src', 'zip.js')).unzip
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regletto-check-'))
try {
  fs.cpSync(path.join(WRITING, 'test', 'probe'), dir, { recursive: true })
  fs.mkdirSync(path.join(dir, 'lib'))
  fs.writeFileSync(path.join(dir, 'lib', 'Anleitung für Autoren.md'), 'Hallo')
  for (const left of ['package.json', 'jsconfig.json', '.gitignore']) fs.writeFileSync(path.join(dir, left), '{}')
  for (const left of ['node_modules/x', 'dist', '.git']) fs.mkdirSync(path.join(dir, left), { recursive: true })
  fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'index.js'), '')

  const made = build(dir)
  assert.deepStrictEqual(made.problems, [])
  assert.strictEqual(path.basename(made.out), 'regletto.probe-1.0.0.zip')
  const back = unzip(fs.readFileSync(made.out))
  assert.ok(!back.error, `Writing reads the archive: ${JSON.stringify(back.error)}`)
  assert.deepStrictEqual([...back.files.keys()].sort(),
    ['addon.js', 'addon.json', 'dialog.js', 'lib/Anleitung für Autoren.md', 'overlay.js', 'panel.js'],
    'only what runs, and nothing to build with')
  for (const [name, body] of back.files) assert.ok(body.equals(fs.readFileSync(path.join(dir, name))), `${name} comes back as it was`)

  // The command line: 0 when sound, 1 with a problem, and nothing built then.
  const ok = spawnSync(process.execPath, [BIN, 'check'], { cwd: dir, encoding: 'utf8' })
  assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr)
  fs.rmSync(path.join(dir, 'addon.js'))
  fs.rmSync(path.join(dir, 'dist'), { recursive: true })
  const broken = spawnSync(process.execPath, [BIN, 'build'], { cwd: dir, encoding: 'utf8' })
  assert.strictEqual(broken.status, 1, 'a problem exits 1')
  assert.match(broken.stdout, /addon\.json: RA011 needs: /)
  assert.ok(!fs.existsSync(path.join(dir, 'dist')), 'and nothing is built')
  const json = JSON.parse(spawnSync(process.execPath, [BIN, 'check', '--json'], { cwd: dir, encoding: 'utf8' }).stdout)
  assert.deepStrictEqual(json.problems.map((one) => one.code), ['RA011'], '--json says the same')
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log('check: the probe passes, every code falls as itself, the archive reads back in Writing')
