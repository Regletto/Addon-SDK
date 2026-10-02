// The panel that opens the dialog. addon.dialog() only opens while the author
// presses something, so the way in is a button on this surface.
// The whole API: https://regletto.com/developers

const say = (de, en) => (addon.lang === 'de' ? de : en)

document.body.style.padding = '12px'

async function draw () {
	// The add-on's own note, kept with the project. null until something was written.
	const kept = await addon.store.read().catch(() => null)
	const button = document.createElement('button')
	button.type = 'button'
	button.textContent = say('Auswählen', 'Choose')
	button.addEventListener('click', choose)
	document.body.replaceChildren(addon.views.stack(
		addon.views.say(kept
			? say(`Gewählt: ${kept.picked}`, `Chosen: ${kept.picked}`)
			: say('Noch nichts gewählt.', 'Nothing chosen yet.')),
		button
	))
}

async function choose () {
	// Answers what dialog.js hands addon.close(), and null for the cross, Esc or a click beside it.
	const answer = await addon.dialog({
		title: {{title}},
		buttons: [
			{ id: 'cancel', label: { de: 'Abbrechen', en: 'Cancel' } },
			{ id: 'apply', label: { de: 'Übernehmen', en: 'Apply' }, primary: true }
		],
		size: { width: 480, height: 320 }
	})
	if (answer) {
		await addon.store.write(answer)
		draw()
	}
}

addon.onLang(draw)
draw()
