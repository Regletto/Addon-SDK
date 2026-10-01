// regletto new: a new add-on from one of three templates, each one runnable and
// as small as it gets. Modelled on Writing's own probe (test/probe/), the add-on
// Writing's checks drive through the whole chain.
//
//   regletto new [folder] [--title …] [--publisher …] [--template workspace|panel|dialog]
//
// It asks only what it cannot know: the title, the publisher, the product and the
// template. Whatever came as a flag is not asked.

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline/promises')
const { parseArgs } = require('node:util')
const { meaningfulTitle, ID_RE } = require('./manifest.js')
const { RESERVED } = require('./check.js')

const TEMPLATES = path.join(__dirname, '..', 'templates')
const KINDS = {
  workspace: 'a workspace behind its own icon in the rail (addon.js)',
  panel: 'a panel in the side column (panel.js)',
  dialog: 'a panel that opens a dialog (panel.js, dialog.js)'
}
const PRODUCTS = ['writing']
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/

// `Mein Add-on` becomes `mein-add-on`, the half of the id after the publisher.
const slug = (title) => title.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')

const ASK = {
  title: { question: 'Title of the add-on: ', ok: meaningfulTitle, wrong: 'A title is 1 to 40 characters on one line, with a letter or a digit in it.' },
  publisher: {
    question: 'Publisher, lower case (your name in the store, the part before the dot in the id): ',
    ok: (v) => NAME_RE.test(v) && !RESERVED.test(v),
    wrong: 'A publisher is 2 to 64 of a to z, 0 to 9 and -, starting with a letter or digit, and no device name such as con or nul.'
  },
  product: { question: `Product (${PRODUCTS.join(', ')}): `, ok: (v) => PRODUCTS.includes(v), wrong: `The product is one of: ${PRODUCTS.join(', ')}.` },
  template: {
    question: `Template:\n${Object.entries(KINDS).map(([kind, said]) => `  ${kind.padEnd(10)} ${said}`).join('\n')}\nWhich one: `,
    ok: (v) => Object.hasOwn(KINDS, v),
    wrong: `The template is one of: ${Object.keys(KINDS).join(', ')}.`
  }
}

// What came as a flag is checked; what did not is asked until it fits.
async function settle (values) {
  const out = { ...values }
  // One product so far, so there is nothing to choose.
  if (out.product === undefined && PRODUCTS.length === 1) out.product = PRODUCTS[0]
  let lines = null
  try {
    for (const [key, ask] of Object.entries(ASK)) {
      if (out[key] !== undefined) {
        if (!ask.ok(out[key])) return { error: `--${key}: ${ask.wrong}` }
        continue
      }
      if (!process.stdin.isTTY) return { error: `--${key} is missing, and there is nobody to ask.` }
      lines ??= readline.createInterface({ input: process.stdin, output: process.stdout })
      for (;;) {
        const said = (await lines.question(ask.question)).trim()
        if (ask.ok(said)) { out[key] = said; break }
        console.log(ask.wrong)
      }
    }
  } finally {
    lines?.close()
  }
  return out
}

// Every {{key}} becomes the value as a JSON string, which is valid in JSON and in JavaScript.
const fill = (text, values) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => JSON.stringify(values[key]))

function write (kind, target, values) {
  for (const from of [path.join(TEMPLATES, 'common'), path.join(TEMPLATES, kind)]) {
    for (const name of fs.readdirSync(from)) {
      // npm leaves a .gitignore out of a package, so it travels without its dot.
      const to = path.join(target, name === 'gitignore' ? '.gitignore' : name)
      fs.writeFileSync(to, fill(fs.readFileSync(path.join(from, name), 'utf8'), values))
    }
  }
}

async function create (args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { title: { type: 'string' }, publisher: { type: 'string' }, product: { type: 'string' }, template: { type: 'string' } }
  })
  const said = await settle(values)
  if (said.error) return said
  const name = slug(said.title).length >= 2 ? slug(said.title) : 'addon'
  const id = `${said.publisher}.${name}`
  if (!ID_RE.test(id)) return { error: `"${id}" cannot be an id: 64 characters at most, and the name after the dot not "part".` }
  const target = path.resolve(positionals[0] ?? name)
  if (fs.existsSync(target) && fs.readdirSync(target).length) return { error: `${target} is not empty.` }
  fs.mkdirSync(target, { recursive: true })
  const sdk = '^' + require('../package.json').version
  write(said.template, target, { id, name, title: said.title, author: said.publisher, sdk })
  return { id, target, template: said.template }
}

async function main (args) {
  const made = await create(args)
  if (made.error) {
    console.log(made.error)
    return 1
  }
  const example = path.join('node_modules', '@regletto', 'addon-sdk', 'example', 'Beispielprojekt')
  console.log(`\n${made.id} created in ${made.target}, from the ${made.template} template.\n`)
  console.log(`  cd ${JSON.stringify(path.relative(process.cwd(), made.target) || '.')}`)
  console.log('  npm install')
  console.log('  npm run dev\n')
  console.log(`A project to test with: ${example}. In Regletto Writing: Projects, Add project.`)
  console.log('The API: https://regletto.com/developers')
  return 0
}

module.exports = { create, slug, main }
