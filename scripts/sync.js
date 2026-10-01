// Pulls what the SDK takes from Regletto Writing, from the checkout beside this
// repository (C:\Dev\Regletto\Writing\Program):
//
//   lib/manifest.js   the one manifest check, byte for byte
//   lib/zip.js        the archive reader and writer, byte for byte
//   example/          the example project, written with Writing's own editor.js
//
//   node scripts/sync.js
//
// The copies are committed, so the package carries them; test/same.js fails
// the day they drift from the checkout. Never edit them here.

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const WRITING = path.join(ROOT, '..', '..', 'Writing', 'Program')
const COPIES = { 'lib/manifest.js': 'src/manifest.js', 'lib/zip.js': 'src/zip.js' }

if (!fs.existsSync(path.join(WRITING, 'src', 'manifest.js'))) {
  console.error(`No Regletto Writing checkout at ${WRITING}.`)
  process.exit(1)
}

for (const [mine, theirs] of Object.entries(COPIES)) {
  fs.copyFileSync(path.join(WRITING, theirs), path.join(ROOT, mine))
  console.log(`${mine} copied from ${theirs}.`)
}

// The example project: German on purpose, it is manuscript text. A name stands
// in several chapters, so mentions() and watch() have something to count.
const editor = require(path.join(WRITING, 'src', 'editor.js'))
const CHAPTERS = [
  ['Der Schnee', [
    'Am Morgen lag Schnee auf dem Hof, und niemand hatte ihn kommen hören. Marie stand in der Tür und sah zu, wie der Wind ihn gegen die Mauer trieb.',
    'Talwyn kam erst gegen Mittag. Er stellte die Kiste ab, klopfte sich den Schnee vom Mantel und sagte nichts.'
  ]],
  ['Die Straße', [
    'Die Salzstraße führte in einem weiten Bogen um den Hügel herum, vorbei an den verlassenen Ställen und dem Brunnen.',
    'Marie kannte jede Biegung. Wer sie nahm, kam einen halben Tag später an als der, der über den Pass ging, und wurde dafür nicht ausgeraubt.'
  ]],
  ['Sarnheim', [
    'Sarnheim lag drei Tage entfernt, und in Sarnheim gab es einen Mann, der Salz kaufte, ohne zu fragen, woher es kam.',
    '„Ihr seid spät", sagte Marie, als Talwyn abstieg. Es war keine Frage und keine Klage.'
  ]]
]

const EXAMPLE = path.join(ROOT, 'example', 'Beispielprojekt')
const BOOK = path.join(EXAMPLE, 'books', 'Die Salzstraße')
fs.rmSync(path.join(ROOT, 'example'), { recursive: true, force: true })
fs.mkdirSync(path.join(BOOK, 'manuscript'), { recursive: true })
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')

// Fixed ids and dates, so a sync without a change in Writing changes no file.
const STAMP = '2026-10-01T00:00:00.000Z'
const tree = CHAPTERS.map(([title, paragraphs], at) => {
  const id = `00000000-0000-4000-8000-00000000000${at + 1}`
  const doc = { blocks: paragraphs.map((t) => ({ runs: [{ t }] })) }
  write(path.join(BOOK, 'manuscript', id + '.json'), editor.write(doc))
  return { type: 'chapter', id, title, words: editor.words(doc) }
})
write(path.join(BOOK, 'manuscript', 'index.json'), { format: 1, tree })
write(path.join(BOOK, 'book.json'), {
  format: 1, title: 'Die Salzstraße', subtitle: '', order: 1, pageFormat: 'hardcover',
  cover: '', typing: {}, created: STAMP, modified: STAMP
})
write(path.join(EXAMPLE, 'project.json'), {
  format: 1, name: 'Beispielprojekt', author: 'Regletto', created: STAMP, modified: STAMP
})
console.log('example/Beispielprojekt written.')
