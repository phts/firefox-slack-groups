const isGroupItem = name => name.startsWith('=')
const getItemName = node => node.querySelector('.p-channel_sidebar__name').textContent.trim()
const getListNode = () => document.querySelector('div.p-channel_sidebar__static_list')
const isStarredTitleItem = node => node.textContent.trim() === 'Starred'

function getNodes() {
  const listEl = getListNode()
  console.debug('listEl', listEl)
  const nodes = Array.from(listEl.childNodes)
  const starredItemIndex = nodes.findIndex(isStarredTitleItem)
  console.debug('starredItemIndex', starredItemIndex)
  const starredListBegin = starredItemIndex + 2
  console.debug('starredListBegin', starredListBegin)
  const tmp = nodes.slice(starredListBegin)
  console.debug('tmp', tmp)
  const starredListEnd = tmp.findIndex(x => x.attributes['role'].value.trim() === 'presentation')
  console.debug('starredListEnd', starredListEnd)
  const starred = tmp.slice(0, starredListEnd)
  console.debug('starred', starred)
  const preItems = nodes.slice(0, starredListBegin)
  const postItems = nodes.slice(starredListBegin + starredListEnd)
  console.debug('preItems', preItems)
  console.debug('postItems', postItems)
  return {
    starred,
    preItems,
    postItems,
  }
}

function syncList(list) {
  const {starred} = getNodes()
  const starredNames = starred.map(getItemName)
  console.debug('starredNames', starredNames)

  const syncedList = list.filter(x => isGroupItem(x) || starredNames.includes(x))
  starredNames.forEach(x => {
    if (!syncedList.includes(x)) {
      syncedList.push(x)
    }
  })

  return syncedList
}

async function readStorage() {
  const storage = await browser.storage.local.get()
  if (typeof storage !== 'object') {
    return {list: undefined, history: []}
  }
  const list = storage.list
  const history = storage.history || []
  return {list, history}
}

async function writeStorage(storage) {
  await browser.storage.local.set(storage)
}

async function saveList(value, opts = {}) {
  const storage = await readStorage()
  const list = {value, timestamp: Date.now()}
  const history = storage.history
  if (storage.list) {
    if (
      !opts.backupOnlyWhenChanged ||
      JSON.stringify(value) !== JSON.stringify(storage.list.value)
    ) {
      history.unshift(storage.list)
    }
    if (history.length > 10) {
      delete history[10]
    }
  }
  const newStorage = {list, history}
  await writeStorage(newStorage)
  return newStorage
}

function addGroups(list) {
  const {preItems, starred, postItems} = getNodes()
  const sortedList = list
    .map(name => {
      console.debug('name', name)
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
        el.setAttribute('data-group', '')
        el.appendChild(text)
        return el
      }

      console.debug('****', starred.find(x => getItemName(x) === name))
      return starred.find(x => getItemName(x) === name)
    })
    .filter(x => x)
  console.debug('sortedList', sortedList)
  console.debug('[...sortedList]', [...preItems, ...sortedList, ...postItems])
  ;[...preItems, ...sortedList, ...postItems].forEach(x => {
    getListNode().appendChild(x)
  })
}

function clearGroups() {
  const els = getListNode().querySelectorAll('[data-group]')
  for (const el of els) {
    el.remove()
  }
}

function connectToPopup(storage) {
  browser.runtime.onMessage.addListener(async function onMessage({type, data}) {
    if (type === 'getState') {
      console.debug('getState', data)
      browser.runtime.sendMessage({type, data: storage})
    }
    if (type === 'save') {
      browser.runtime.onMessage.removeListener(onMessage)
      console.debug('save', data)
      await saveList(data)
      console.debug('location.reload')
      location.reload()
    }
    if (type === 'restore') {
      browser.runtime.onMessage.removeListener(onMessage)
      console.debug('restore', data)
      console.debug('restore', storage.history[data])
      await saveList(storage.history[data].value, {backupOnlyWhenChanged: true})
      location.reload()
    }
  })
}

function fixScrollOnClick() {
  const node = document.querySelector('.c-scrollbar__hider')
  let scrollTop
  node.addEventListener('mousedown', function() {
    scrollTop = this.scrollTop

    function onScroll(ev) {
      ev.preventDefault()
      this.scrollTop = scrollTop
    }
    node.addEventListener('scroll', onScroll)

    function onWheel() {
      node.removeEventListener('scroll', onScroll)
    }
    node.addEventListener('wheel', onWheel)

    setTimeout(() => {
      node.removeEventListener('scroll', onScroll)
      node.removeEventListener('wheel', onWheel)
    }, 1000)
  })
}

async function rebuildGroups() {
  console.debug('rebuildGroups')
  clearGroups()
  const storage = await readStorage()
  addGroups(storage.list.value)
  startObserver()
}

function startObserver() {
  console.debug('startObserver')
  new MutationObserver((mutations, observer) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        console.debug('observer', mutation)
        if (Array.prototype.find.call(mutation.addedNodes, isStarredTitleItem)) {
          observer.disconnect()
          setTimeout(rebuildGroups, 500)
        }
      }
    }
  }).observe(getListNode(), {
    childList: true,
  })
}

async function run() {
  console.debug('run')
  const storage = await readStorage()
  const initialList = (storage.list || {}).value || []
  console.debug('initialList', initialList)
  const syncedList = syncList(initialList)
  console.debug('syncedList', syncedList)
  const newStorage = await saveList(syncedList, {backupOnlyWhenChanged: true})
  connectToPopup(newStorage)
  addGroups(newStorage.list.value)
  fixScrollOnClick()
  startObserver()
}

let haveRun = false
window.addEventListener('load', async function onLoad() {
  console.debug('onLoad')
  haveRun = true
  window.removeEventListener('load', onLoad)
  await run()
})

setTimeout(async () => {
  console.debug('haveRun', haveRun)
  if (!haveRun) {
    await run()
  }
}, 10000)
