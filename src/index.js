function isGroupItem(name) {
  return name.startsWith('=')
}

function getItemName(node) {
  return node.querySelector('.p-channel_sidebar__name').textContent.trim()
}

function getListNode() {
  return document.querySelector('div.p-channel_sidebar__static_list')
}

function getNodes() {
  const listEl = getListNode()
  // console.log('listEl', listEl)
  const nodes = Array.from(listEl.childNodes)
  const starredItemIndex = nodes.findIndex(x => x.textContent.trim() === 'Starred')
  // console.log('starredItemIndex', starredItemIndex)
  const starredListBegin = starredItemIndex + 2
  // console.log('starredListBegin', starredListBegin)
  const tmp = nodes.slice(starredListBegin)
  // console.log('tmp', tmp)
  const starredListEnd = tmp.findIndex(x => x.attributes['role'].value.trim() === 'presentation')
  // console.log('starredListEnd', starredListEnd)
  const starred = tmp.slice(0, starredListEnd)
  // console.log('starred', starred)
  const preItems = nodes.slice(0, starredListBegin)
  const postItems = nodes.slice(starredListBegin + starredListEnd)
  // console.log('preItems', preItems)
  // console.log('postItems', postItems)
  return {
    starred,
    preItems,
    postItems,
  }
}

function syncList(list) {
  const {starred} = getNodes()
  const starredNames = starred.map(getItemName)
  // console.log('starredNames', starredNames)

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
      // console.log('name', name)
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

      // console.log('****', starred.find(x => x.textContent.trim() === name))
      return starred.find(x => getItemName(x) === name)
    })
    .filter(x => x)
  // console.log('sortedList', sortedList)
  // console.log('[...sortedList]', [...preItems, ...sortedList, ...postItems])
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

async function run() {
  // console.log('run')
  const storedList = await browser.storage.local.get()
  const initialList = storedList.list || []
  // console.log('initialList', initialList)
  const syncedList = syncList(initialList)
  // console.log('syncedList', syncedList)
  await saveList(syncedList)
  sendToPopup(syncedList)
  addGroups(syncedList)
  fixScrollOnClick()
}

browser.runtime.onMessage.addListener(async function onSave({type, data}) {
  if (type === 'save') {
    browser.runtime.onMessage.removeListener(onSave)
    // console.log('save', data)
    await saveList(data)
    // console.log('location.reload')
    location.reload()
  }
})

window.addEventListener('load', async function onLoad() {
  window.removeEventListener('load', onLoad)
  await run()
})
