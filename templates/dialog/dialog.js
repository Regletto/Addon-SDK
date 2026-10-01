// The dialog: Regletto draws the frame (title, cross, buttons, the veil over the
// window); this file draws what stands between them. It hears the frame's
// buttons with addon.onButton() and ends the dialog with addon.close(value).
// The whole API: https://regletto.com/developers

document.body.style.padding = '18px 22px'

const CHOICES = [
  { id: 'morning', de: 'Morgens', en: 'In the morning' },
  { id: 'evening', de: 'Abends', en: 'In the evening' }
]
let picked = CHOICES[0].id

const drawChoices = () => document.body.replaceChildren(addon.views.list({
  items: CHOICES.map((one) => ({ id: one.id, mark: 'schedule', name: addon.lang === 'de' ? one.de : one.en })),
  item: 'row',
  current: picked,
  onPick: (id) => { picked = id; drawChoices() }
}))

addon.onButton((id) => {
  if (id === 'apply') addon.close({ picked })
  if (id === 'cancel') addon.close(null)
})

drawChoices()
