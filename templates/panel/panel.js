// The panel: what stands in the side column once the author has laid it into
// the rail. 180 to 400 px wide, so one column of parts and not a layout.
// The whole API: https://regletto.com/developers

const say = (de, en) => (addon.lang === 'de' ? de : en)

// The page refuses a style attribute, so styles go through the CSSOM or a .css file.
document.body.style.padding = '12px'

// The chapter tree of the open book. A section carries its chapters in `items`.
const chaptersOf = (tree) => tree.flatMap((node) => (node.type === 'section' ? chaptersOf(node.items ?? []) : [node]))

async function draw () {
	let words = null
	try {
		const { tree } = await addon.writing.tree()
		words = chaptersOf(tree).reduce((sum, chapter) => sum + (chapter.words ?? 0), 0)
	} catch (error) {
		// Without an open book, tree() refuses: a refusal is a thrown error, never empty data.
		addon.log.info(error)
	}
	document.body.replaceChildren(addon.views.line(
		addon.views.mark('view_sidebar'),
		addon.views.stack(
			addon.views.name(words === null ? say('Kein Buch offen', 'No book open') : words.toLocaleString(addon.lang)),
			addon.views.say(say('Wörter im Buch', 'words in the book'))
		)
	))
}

addon.writing.onBook(draw)
addon.onLang(draw)
draw()
