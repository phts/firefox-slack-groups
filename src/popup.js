function send(type, data) {
  browser.tabs.query({active: true, currentWindow: true}, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {type, data})
  })
}

function createOptionElement(text, attrs = {}) {
  const el = document.createElement('option')
  el.innerText = text
  for (const k in attrs) {
    el[k] = attrs[k]
  }
  return el
}

function createRestoreItems(data) {
  const restoreEls = data.history.map((h, i) => {
    const dt = new Date(h.timestamp)
    return createOptionElement(
      `${h.value.length} items (${dt.toLocaleDateString()} ${dt.toLocaleTimeString()})`,
      {value: i}
    )
  })
  const currentEl = createOptionElement(`${data.list.value.length} items (Current)`, {
    disabled: true,
  })
  return [currentEl].concat(restoreEls)
}

function updateListElement(data) {
  document.getElementById('list').value = data.list.value.join('\n')
}

function updateRestoreElement(data) {
  const options = createRestoreItems(data)
  const el = document.getElementById('restore')
  options.forEach(opt => {
    el.appendChild(opt)
  })
  el.addEventListener('change', function onRestoreChange(e) {
    el.removeEventListener('change', onRestoreChange)
    send('restore', e.target.value)
    window.close()
  })
}

function showError() {
  document.getElementById('init-error-msg').style.display = 'block'
  document.getElementById('list').style.display = 'none'
}

function fetchState() {
  function handle({type, data}) {
    if (type === 'getState') {
      clearTimeout(errorTimer)

      browser.runtime.onMessage.removeListener(handle)
      updateListElement(data)
      updateRestoreElement(data)
    }
  }

  const errorTimer = setTimeout(() => {
    browser.runtime.onMessage.removeListener(handle)
    showError()
  }, 500)

  browser.runtime.onMessage.addListener(handle)
  send('getState')
}

fetchState()

document.getElementById('save').addEventListener('click', () => {
  send('save', document.getElementById('list').value.split('\n'))
  window.close()
})
