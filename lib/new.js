// regletto new: a new add-on from one of the product's templates, each one
// runnable and as small as it gets.
//
//   regletto new [folder] [--title …] [--publisher …] [--template <kind>]
//
// It asks only what it cannot know: the title, the publisher and the template.
// Whatever came as a flag is not asked. The product is the one whose SDK runs.
// The templates are the files in the product's templates/, common/ and one folder
// per kind, with {{key}} marks that are filled in (see fill()).

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline/promises')
const { parseArgs } = require('node:util')
const { RESERVED } = require('./check.js')

// `Mein Add-on` becomes `mein-add-on`, the half of the id after the publisher.
// German umlauts are spelled out first (ä to ae), since that is what a German
// title is expected to become; other accents are stripped (é to e).
const slug = (title) => title.toLowerCase()
	.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
	.normalize('NFKD')
	.replace(/\p{M}/gu, '')
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-+|-+$/g, '')
	.slice(0, 40)
	.replace(/-+$/, '')

// The three things asked for, in the order they are asked. `ok` judges an answer,
// `wrong` says what a right one looks like.
const questionsOf = ({ manifest, kinds }) => ({
	title: {
		question: 'Title of the add-on: ',
		ok: manifest.meaningfulTitle,
		wrong: 'A title is 1 to 40 characters on one line, with a letter or a digit in it.'
	},
	publisher: {
		question: 'Publisher, lower case (your name in the store, the part before the dot in the id): ',
		ok: (value) => manifest.NAME_RE.test(value) && !RESERVED.test(value),
		wrong: 'A publisher is 2 to 64 of a to z, 0 to 9 and -, starting with a letter or digit, ' +
			'and no device name such as con or nul.'
	},
	template: {
		question: `Template:\n${Object.entries(kinds).map(([kind, about]) => `  ${kind.padEnd(10)} ${about}`).join('\n')}\nWhich one: `,
		ok: (value) => Object.hasOwn(kinds, value),
		wrong: `The template is one of: ${Object.keys(kinds).join(', ')}.`
	}
})

// Completes the answers. What came as a flag is checked, what did not is asked
// until it fits. Answers `{ title, publisher, template }` or `{ error }`.
async function collect (flags, product) {
	const answers = { ...flags }
	let prompt = null
	try {
		for (const [key, ask] of Object.entries(questionsOf(product))) {
			if (answers[key] !== undefined) {
				if (!ask.ok(answers[key])) return { error: `--${key}: ${ask.wrong}` }
				continue
			}
			if (!process.stdin.isTTY) return { error: `--${key} is missing, and there is nobody to ask.` }
			prompt ??= readline.createInterface({ input: process.stdin, output: process.stdout })
			for (;;) {
				const answer = (await prompt.question(ask.question)).trim()
				if (ask.ok(answer)) {
					answers[key] = answer
					break
				}
				console.log(ask.wrong)
			}
		}
	} finally {
		prompt?.close()
	}
	return answers
}

// Every {{key}} becomes the value as a JSON string, which is valid in JSON and in
// JavaScript alike.
const fill = (text, values) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => JSON.stringify(values[key]))

// Writes the files of templates/common and templates/<kind> into `target`.
function write (templates, kind, target, values) {
	for (const from of [path.join(templates, 'common'), path.join(templates, kind)]) {
		for (const name of fs.readdirSync(from)) {
			// npm leaves a .gitignore out of a package, so it travels without its dot.
			const to = path.join(target, name === 'gitignore' ? '.gitignore' : name)
			fs.writeFileSync(to, fill(fs.readFileSync(path.join(from, name), 'utf8'), values))
		}
	}
}

// Answers `{ id, target, template }` of the add-on made, or `{ error }`.
async function create (args, product) {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: {
			title: { type: 'string' },
			publisher: { type: 'string' },
			template: { type: 'string' }
		}
	})
	const answers = await collect(values, product)
	if (answers.error) return answers

	const titleSlug = slug(answers.title)
	const name = titleSlug.length >= 2 ? titleSlug : 'addon'
	const id = `${answers.publisher}.${name}`
	if (!product.manifest.ID_RE.test(id)) return { error: `"${id}" cannot be an id: 64 characters at most, and the name after the dot not "part".` }

	const target = path.resolve(positionals[0] ?? name)
	if (fs.existsSync(target) && fs.readdirSync(target).length) return { error: `${target} is not empty.` }
	fs.mkdirSync(target, { recursive: true })

	const sdk = '^' + product.package.version
	write(product.templates, answers.template, target, { id, name, title: answers.title, author: answers.publisher, sdk })
	return { id, target, template: answers.template }
}

async function main (args, product) {
	const made = await create(args, product)
	if (made.error) {
		console.log(made.error)
		return 1
	}
	console.log(`\n${made.id} created in ${made.target}, from the ${made.template} template.\n`)
	console.log('Next, inside the new folder (npm install gives the editor its hints):')
	console.log(`  cd ${JSON.stringify(path.relative(process.cwd(), made.target) || '.')}`)
	console.log('  npm install')
	console.log('  npm run dev\n')
	if (product.example) {
		const example = path.join('node_modules', ...product.package.name.split('/'), product.example.path)
		console.log(`A project to test with: ${example}. ${product.example.how}`)
	}
	console.log('The API: https://regletto.com/developers')
	return 0
}

module.exports = { create, slug, main }
