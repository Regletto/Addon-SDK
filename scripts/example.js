// Writes the example project, example/Example Project: six volumes to try an
// add-on against, three books and three binders, each kind with few, a medium
// number and very many words.
//
//   books     Small Book (about 300 words), Medium Book (12 000),
//             Large Book (80 000, in five parts)
//   binders   Small Binder (about 300 words), Medium Binder (12 000),
//             Large Binder (80 000, in four parts)
//
// A binder is what Writing calls a "Mappe": a book without typesetting, in the
// same folder, marked by `"kind": "binder"` in its book.json.
//
// The text is made up of building blocks: sentences with names, places and
// things filled in. A few names come back all the time, so mentions() and
// watch() have something to count. Everything is seeded, so running the sync
// twice writes the same files.

const fs = require('node:fs')
const path = require('node:path')

const PROJECT = 'Example Project'

const VOLUMES = [
	{ kind: 'book', title: 'Small Book', words: 300, chapters: 2 },
	{ kind: 'book', title: 'Medium Book', words: 12000, chapters: 8 },
	{ kind: 'book', title: 'Large Book', words: 80000, chapters: 50, parts: 5 },
	{ kind: 'binder', title: 'Small Binder', words: 300, chapters: 3 },
	{ kind: 'binder', title: 'Medium Binder', words: 12000, chapters: 20 },
	{ kind: 'binder', title: 'Large Binder', words: 80000, chapters: 40, parts: 4 }
]

// Fixed dates, so a sync without a change writes no different file.
const STAMP = '2026-10-01T00:00:00.000Z'

const NAMES = ['Mary', 'Tom', 'Alice', 'Robert', 'Emma', 'Jack']
const WHERE = [
	'at the harbour', 'in the stable', 'in the yard', 'up on the pass', 'down at the mill', 'by the lighthouse',
	'behind the wall', 'in Saltmere', 'at the well', 'under the bridge'
]
const THINGS = [
	'the crate', 'the letter', 'the rope', 'the lantern', 'the key', 'the book', 'the coat', 'the map',
	'the barrel', 'the sack of salt'
]
const TIMES = ['early morning', 'late afternoon', 'deep night', 'a grey noon', 'a clear evening']
const SPEECH = [
	'That will not be enough', 'I do not know', 'Wait until tomorrow', 'It was never my decision',
	'Nobody asked us', 'It has grown late', 'You should have come sooner', 'Say nothing more'
]

// Sentences that need nothing filled in.
const PLAIN = [
	'Snow lay on the yard in the morning, and nobody had heard it come.',
	'The wind turned, and with it the mood in the house.',
	'Outside the rain fell against the shutters, steady and unhurried.',
	'The lamplight trembled as someone opened the door.',
	'The road ran in a wide arc around the hill.',
	'It smelled of wet wood, of salt and of old paper.',
	'For a while nobody said anything, and that was worse than any word.',
	'Far below in the valley a bell struck, then again, then no more.',
	'The water stood high that year, higher than anyone could remember.',
	'On the table lay bread, a knife and a note nobody wanted to touch.',
	'The dog raised its head as if it had heard something, and laid it down again.',
	'The night was cold, but the stars stood clear above the roofs.',
	'Whoever waits long enough learns to read the silence.',
	'The fire crackled in the stove, and the shadows wandered across the wall.',
	'The way was longer than it had looked on the map.',
	'Someone had closed the shutters without giving a reason.'
]

// Sentences with names, places and things. {n} and {m} are two different names,
// {w} a place ({W} the same with a capital), {t} a thing with its article, {s}
// and {r} two different things said, {z} a time.
const TEMPLATES = [
	'{n} put {t} down {w} and waited.',
	'{n} searched for {t} for a long time {w}, without success.',
	'{W}, it was said, {n} had last seen {t}.',
	'“{s},” said {n}, and looked at {m}.',
	'{m} did not answer. {n} asked again, more quietly this time.',
	'It was {z}, and {w} nothing stirred.',
	'The next day {n} set off with {t} under one arm, without saying goodbye.',
	'{n} had never wanted any of this, and yet {n} now stood {w}.',
	'Whoever found {t}, said {n}, was to tell {m}.',
	'{m} arrived {w} when {n} had already left.',
	'“{s},” said {m}. “{r},” {n} replied.'
]

const TITLE_HEADS = [
	'The Letter', 'The Crate', 'The Rope', 'The Lantern', 'The Key', 'The Book', 'The Coat', 'The Map',
	'The Barrel', 'The Visit', 'The Return', 'The Promise', 'The Farewell', 'The Arrival', 'The Secret',
	'The Winter', 'The Night', 'The Salt', 'The Wind', 'The Debt'
]
const TITLE_PLACES = [
	'at the Harbour', 'in the Stable', 'in the Yard', 'on the Pass', 'at the Mill', 'by the Lighthouse',
	'behind the Wall', 'in Saltmere', 'at the Well', 'under the Bridge', 'in the Rain', 'at Night'
]
const PART_NAMES = ['One', 'Two', 'Three', 'Four', 'Five']

// A small seeded generator (mulberry32), so the same seed gives the same text.
function seeded (seed) {
	let state = seed
	return () => {
		state = (state + 0x6D2B79F5) | 0
		let t = Math.imul(state ^ (state >>> 15), 1 | state)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const upperFirst = (text) => text[0].toUpperCase() + text.slice(1)

// A source of paragraphs for one volume.
function writerFor (seed) {
	const random = seeded(seed)
	const one = (list) => list[Math.floor(random() * list.length)]
	// Another entry of the list than `not`.
	const other = (list, not) => {
		let found = one(list)
		while (found === not) found = one(list)
		return found
	}

	// Never the same sentence form twice in a row.
	let previous = null
	function sentence () {
		let form
		do form = random() < 0.3 ? one(PLAIN) : one(TEMPLATES)
		while (form === previous)
		previous = form

		const n = one(NAMES)
		const w = one(WHERE)
		const s = one(SPEECH)
		const values = {
			n,
			m: other(NAMES, n),
			w,
			W: upperFirst(w),
			t: one(THINGS),
			s,
			r: other(SPEECH, s),
			z: one(TIMES)
		}
		return form.replace(/\{(\w)\}/g, (_, key) => values[key])
	}

	// 3 to 6 sentences, and the number of words it holds.
	function paragraph () {
		const text = Array.from({ length: 3 + Math.floor(random() * 4) }, sentence).join(' ')
		return { text, words: text.split(/\s+/).length }
	}

	return { paragraph }
}

// "The Letter at the Harbour": a title that does not repeat inside a volume.
function titleOf (at, used) {
	for (let step = at; ; step++) {
		const head = TITLE_HEADS[step % TITLE_HEADS.length]
		const place = TITLE_PLACES[(step * 5 + Math.floor(step / TITLE_HEADS.length)) % TITLE_PLACES.length]
		const title = `${head} ${place}`
		if (!used.has(title)) {
			used.add(title)
			return title
		}
	}
}

// A chapter id is a number in a fixed uuid, volume first: stable and readable.
const idOf = (volume, number) =>
	`00000000-0000-4000-8000-${String(volume).padStart(2, '0')}${String(number).padStart(10, '0')}`

// Writes one volume: its book.json, its chapters and the index. Answers its words.
function writeVolume (booksDir, volume, order, editor) {
	const dir = path.join(booksDir, volume.title)
	const write = (file, data) => fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, '\t') + '\n')
	fs.mkdirSync(path.join(dir, 'manuscript'), { recursive: true })

	// A binder's file is shorter: no subtitle, no cover, and A4 where a book has a trade size.
	write('book.json', volume.kind === 'binder'
		? { format: 1, kind: 'binder', title: volume.title, order, pageFormat: 'a4', created: STAMP, modified: STAMP }
		: {
			format: 1,
			title: volume.title,
			subtitle: '',
			order,
			pageFormat: 'hardcover',
			cover: null,
			created: STAMP,
			modified: STAMP
		})

	const text = writerFor(order * 7919)
	const used = new Set()
	const perChapter = volume.words / volume.chapters
	let total = 0

	const chapters = Array.from({ length: volume.chapters }, (_, at) => {
		const id = idOf(order, at + 1)
		const blocks = []
		for (let words = 0; words < perChapter;) {
			const { text: paragraph, words: count } = text.paragraph()
			blocks.push({ runs: [{ t: paragraph }] })
			words += count
		}
		const doc = { blocks }
		write(path.join('manuscript', id + '.json'), editor.write(doc))
		const words = editor.words(doc)
		total += words
		return { type: 'chapter', id, title: titleOf(at, used), words }
	})

	// A volume in parts puts its chapters into sections, as evenly as it can.
	let tree = chapters
	if (volume.parts) {
		const size = Math.ceil(chapters.length / volume.parts)
		tree = Array.from({ length: volume.parts }, (_, part) => ({
			type: 'section',
			id: idOf(order, 1000 + part),
			title: `Part ${PART_NAMES[part]}`,
			items: chapters.slice(part * size, (part + 1) * size)
		}))
	}
	write(path.join('manuscript', 'index.json'), { format: 1, tree })
	return total
}

// `editor` is Writing's own editor.js, which knows how a chapter is stored and
// how its words are counted.
module.exports = function writeExample (root, editor) {
	const project = path.join(root, 'example', PROJECT)
	fs.rmSync(path.join(root, 'example'), { recursive: true, force: true })
	fs.mkdirSync(project, { recursive: true })
	const info = { format: 1, name: PROJECT, author: 'Regletto', created: STAMP, modified: STAMP }
	fs.writeFileSync(path.join(project, 'project.json'), JSON.stringify(info, null, '\t') + '\n')
	VOLUMES.forEach((volume, at) => {
		const words = writeVolume(path.join(project, 'books'), volume, at + 1, editor)
		console.log(`  ${volume.kind.padEnd(6)} ${volume.title}: ${words} words`)
	})
}
