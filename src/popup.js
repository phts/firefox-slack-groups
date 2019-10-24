function send(type, data) {
  browser.tabs.query({active: true, currentWindow: true}, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {type, data})
  })
}

function fetchList() {
  browser.runtime.onMessage.addListener(function handle({type, data}) {
    if (type === 'getList') {
      browser.runtime.onMessage.removeListener(handle)
      document.getElementById('list').value = data.join('\n')
    }
  })
  send('getList')
}

fetchList()

document.getElementById('save').addEventListener('click', () => {
  send('save', document.getElementById('list').value.split('\n'))
  window.close()
})
