function isGroupItem(name) {
  return name.includes('=')
}

function getListNode() {
  return document.querySelector('div.p-channel_sidebar__static_list')
}

function getNodes() {
  const listEl = getListNode()
  const nodes = Array.from(listEl.childNodes)
  const starredItemIndex = nodes.findIndex(x => x.textContent.trim() === 'Starred')
  const starredListBegin = starredItemIndex + 2
  const tmp = nodes.slice(starredListBegin)
  const starredListEnd = tmp.findIndex(x => x.attributes['role'].value.trim() === 'presentation')
  const starred = tmp.slice(0, starredListEnd)
  const preItems = nodes.slice(0, starredListBegin)
  const postItems = nodes.slice(starredListBegin + starredListEnd)
  return {
    starred,
    preItems,
    postItems,
  }
}

function syncList(list) {
  const {starred} = getNodes()

  const starredNames = starred.map(x => x.textContent.trim())

  const syncedList = list.filter(x => isGroupItem(x) || starredNames.includes(x))

  starredNames.forEach(x => {
    if (!syncedList.includes(x)) {
      syncedList.push(x)
    }
  })

  return syncedList
}

async function saveList(list) {
  await browser.storage.local.set({list})
}

function addGroups(list) {
  const {preItems, starred, postItems} = getNodes()
  const sortedList = list
    .map(name => {
      if (isGroupItem(name)) {
        const text = document.createTextNode(name.replace(/=/g, ''))
        const el = document.createElement('DIV')
        el.style.alignItems = 'center'
        el.style.borderTop = '1px dotted currentColor'
        el.style.display = 'flex'
        el.style.fontStyle = 'italic'
        el.style.height = '26px'
        el.style.justifyContent = 'center'
        el.setAttribute('role', 'listitem')
        el.appendChild(text)
        return el
      }

      return starred.find(x => x.textContent.trim() === name)
    })
    .filter(x => x)
  ;[...preItems, ...sortedList, ...postItems].forEach(x => {
    getListNode().appendChild(x)
  })
}

function sendToPopup(list) {
  browser.runtime.onMessage.addListener(({type}) => {
    if (type === 'getList') {
      browser.runtime.sendMessage({type, data: list})
    }
  })
}

async function run() {
  const storedList = await browser.storage.local.get()
  const initialList = storedList.list || []
  const syncedList = syncList(initialList)
  await saveList(syncedList)
  sendToPopup(syncedList)
  addGroups(syncedList)
}

browser.runtime.onMessage.addListener(async function onSave({type, data}) {
  if (type === 'save') {
    browser.runtime.onMessage.removeListener(onSave)
    saveList(data)
    location.reload()
  }
})

window.addEventListener('load', async function onLoad() {
  window.removeEventListener('load', onLoad)
  await run()
})
