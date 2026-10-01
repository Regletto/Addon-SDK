// regletto build: check, then write the archive to dist/<id>-<version>.zip.
//
// Nothing is bundled, translated or signed: what lies in the archive is what
// runs (Notion › Add-on-Plattform › Verworfen). The archive is the one check()
// packed, so what was checked is what is written.

const fs = require('node:fs')
const path = require('node:path')
const { check, print, folderOf } = require('./check.js')

function build (dir) {
  const said = check(dir)
  if (said.problems.length) return said
  const out = path.join(dir, 'dist', `${said.manifest.id}-${said.manifest.version}.zip`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, said.archive)
  return { ...said, out }
}

function main (args) {
  const said = build(folderOf(args))
  if (said.problems.length) {
    print(said.problems)
    console.log('Nothing was built.')
    return 1
  }
  console.log(`${path.relative(process.cwd(), said.out)} written, ${said.files.length} files, ${(said.archive.length / 1024).toFixed(1)} KB.`)
  console.log('Drag it into the Regletto Writing window to install it.')
  return 0
}

module.exports = { build, main }
