// The command line every product SDK shares. A product SDK has a bin of its own,
// named `regletto`, which hands its product and the arguments to run():
//
//   require('@regletto/addon-sdk').run(require('../product.js'), process.argv.slice(2))
//
// So the commands are the same in every product, and what differs between them
// is all in the product. A product is a plain object:
//
//   key        its key in `engines` and the prefix of its permissions
//   name       its full name as a person reads it, `"Regletto <Product>"`
//   data       the folder of its data inside the platform's app data folder
//   package    the product SDK's own package.json (its name and version)
//   manifest   the product's own manifest check: read(text, version, lang),
//              CODES, NAME_RE, ID_RE and meaningfulTitle
//   surfaces   each surface only this product has, by the file at the root that
//              draws it, with what asks for it: a field of addon.json `{ field }`,
//              a permission in `needs` `{ need }`, or the file itself `{ itself: true }`,
//              which nothing in addon.json asks for, so the check never says it is
//              missing: `{ 'panel.js': { field: 'panel' } }`.
//              The workspace and the worker are the base's, in every product
//   files      optional: files(manifest) answers the other files a sound manifest
//              names, `[{ field, file }]`, the files of a font say; each must be there
//   templates  the folder of its templates: common/ and one folder per kind
//   kinds      each kind with one line on what it makes
//   example    optional: `{ path, how }`, a project to test with inside the
//              package and how to open it in the product

const COMMANDS = {
	new: [() => require('./new.js'), 'Create an add-on from a template'],
	check: [() => require('./check.js'), 'Check addon.json, the files and the limits'],
	build: [() => require('./build.js'), 'Check, then write the archive to dist/'],
	dev: [() => require('./dev.js'), (product) => `Link this folder into ${product.name} (--stop takes the link away)`],
	logs: [() => require('./logs.js'), 'Show the log of this add-on and follow it (--level warn)']
}

function usage (product) {
	console.log(`Usage: regletto <command>, for ${product.name}\n`)
	for (const [name, [, about]] of Object.entries(COMMANDS)) {
		console.log(`  ${name.padEnd(7)} ${typeof about === 'function' ? about(product) : about}`)
	}
	console.log('\nMore: https://regletto.com/developers')
}

// Runs one command and sets the exit code from what it answers, so a failed
// check fails a CI step.
function run (product, [command, ...rest]) {
	if (!Object.hasOwn(COMMANDS, command)) {
		// No command or a plain request for help is not a mistake; anything else is.
		const asksForHelp = !command || command === 'help' || command === '--help'
		if (!asksForHelp) console.log(`"${command}" is not a command.\n`)
		usage(product)
		process.exitCode = asksForHelp ? 0 : 1
		return
	}
	Promise.resolve()
		.then(() => COMMANDS[command][0]().main(rest, product))
		.then((code) => { process.exitCode = code })
		.catch((error) => {
			console.error(error?.message ?? error)
			process.exitCode = 1
		})
}

module.exports = { run }
