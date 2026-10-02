// The workspace: the surface behind this add-on's icon in the rail.
// Regletto draws the frame around it (title, side column, buttons) from what
// addon.workspace() says; this file draws what stands inside.
// The whole API: https://regletto.com/developers

const say = (de, en) => (addon.lang === 'de' ? de : en)

addon.workspace({
	title: {{title}},
	sidebar: [{ id: 'chapters', label: { de: 'Kapitel', en: 'Chapters' }, icon: 'account_tree' }],
	buttons: [{ id: 'refresh', label: { de: 'Neu lesen', en: 'Read again' }, icon: 'refresh' }]
}).catch((error) => addon.log.error(error))

// A press in the frame arrives here, with the id this file gave it.
addon.onPick((id) => {
	addon.log.debug('picked', id)
	if (id === 'refresh') draw()
})

// The chapter tree of the open book. A section carries its chapters in `items`.
const chaptersOf = (tree) => tree.flatMap((node) => (node.type === 'section' ? chaptersOf(node.items ?? []) : [node]))

async function draw () {
	try {
		const { tree, open } = await addon.writing.tree()
		const items = chaptersOf(tree).map((chapter) => ({
			id: chapter.id, mark: 'description', name: chapter.title, tally: chapter.words
		}))
		document.body.replaceChildren(addon.views.list({ items, item: 'row', current: open }))
	} catch (error) {
		// Without an open book, tree() refuses: a refusal is a thrown error, never empty data.
		addon.log.info(error)
		document.body.replaceChildren(addon.views.say(
			say('Öffne ein Buch, dann stehen hier seine Kapitel.', 'Open a book to see its chapters here.')
		))
	}
}

addon.writing.onBook(draw)
addon.onLang(draw)
draw()
