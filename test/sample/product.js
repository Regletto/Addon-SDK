// A product that does not exist, to run the base with: what a product SDK hands
// to run() (see lib/cli.js), as small as it gets. It has two surfaces of its own:
// the tray, drawn by tray.js when addon.json has a `tray`, and a lens, lens.js,
// which its file asks for by being there, as Writing's editor.js does.

const path = require('node:path')

module.exports = {
	key: 'sample',
	name: 'Regletto Sample',
	data: 'Regletto Sample',
	package: { name: '@regletto/sample-addon-sdk', version: '2.3.4' },
	manifest: require('./manifest.js'),
	surfaces: {
		'tray.js': { field: 'tray' },
		'lens.js': { itself: true }
	},
	// The sheet a tray may name, as Writing's `fonts` name their files.
	files: (manifest) => (manifest.tray?.sheet ? [{ field: 'tray', file: manifest.tray.sheet }] : []),
	templates: path.join(__dirname, 'templates'),
	kinds: { plain: 'a workspace and nothing else (addon.js)' },
	example: { path: 'example', how: 'In Regletto Sample: Open.' }
}
