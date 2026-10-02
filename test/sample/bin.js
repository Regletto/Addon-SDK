#!/usr/bin/env node
// The bin of the sample product, as a product SDK writes it.
require('../../lib/cli.js').run(require('./product.js'), process.argv.slice(2))
