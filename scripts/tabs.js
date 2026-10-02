// Regletto Writing indents with two spaces, this repository with tabs. The files
// copied from Writing are converted on the way in (scripts/sync.js), and
// test/same.js converts Writing's side the same way before it compares. Nothing
// but leading whitespace and line ends changes.

module.exports = (text) => text
	.replace(/\r\n/g, '\n')
	.replace(/^(?: {2})+/gm, (spaces) => '\t'.repeat(spaces.length / 2))
