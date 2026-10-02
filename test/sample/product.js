// A product that does not exist, to run the base with: what a product SDK hands
// to run() (see lib/cli.js), as small as it gets. It has one surface of its own,
// `tray`, drawn by tray.js.

const path = require('node:path')

module.exports = {
	key: 'sample',
	name: 'Regletto Sample',
	data: 'Regletto Sample',
	package: { name: '@regletto/sample-addon-sdk', version: '2.3.4' },
	manifest: require('./manifest.js'),
	surfaces: { tray: 'tray.js' },
	templates: path.join(__dirname, 'templates'),
	kinds: { plain: 'a workspace and nothing else (addon.js)' },
	example: { path: 'example', how: 'In Regletto Sample: Open.' },
	schema: {
		needs: { 'sample:poke': 'Poke the sample.' },
		properties: { tray: { description: 'A tray. Needs tray.js.', type: 'object' } }
	}
}
