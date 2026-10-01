#!/usr/bin/env node
// The one entry: hands the command to its file in lib/ and exits with its code,
// so a failed check fails a CI step.

const COMMANDS = {
  new: ['../lib/new.js', 'Create an add-on from a template'],
  check: ['../lib/check.js', 'Check addon.json, the files and the limits'],
  build: ['../lib/build.js', 'Check, then write the archive to dist/'],
  dev: ['../lib/dev.js', 'Link this folder into Regletto Writing (--stop takes the link away)'],
  logs: ['../lib/logs.js', 'Show the log of this add-on and follow it (--level warn)']
}

const [command, ...rest] = process.argv.slice(2)

if (!Object.hasOwn(COMMANDS, command)) {
  if (command && command !== 'help' && command !== '--help') console.log(`"${command}" is not a command.\n`)
  console.log('Usage: regletto <command>\n')
  for (const [name, [, said]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(7)} ${said}`)
  console.log('\nMore: https://regletto.com/developers')
  process.exitCode = command && command !== 'help' && command !== '--help' ? 1 : 0
} else {
  Promise.resolve()
    .then(() => require(COMMANDS[command][0]).main(rest))
    .then((code) => { process.exitCode = code })
    .catch((error) => {
      console.error(error?.message ?? error)
      process.exitCode = 1
    })
}
