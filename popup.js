function sendToActiveTab(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          resolve(response);
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (data) => {
      resolve(data[key]);
    });
  });
}

async function init() {
  const currentDept = await getStorage('current_department');
  if (currentDept) {
    document.getElementById('currentDept').textContent = currentDept;
  }

  document.getElementById('openSidebar').addEventListener('click', async () => {
    await sendToActiveTab({ type: 'TOGGLE_SIDEBAR' });
    window.close();
  });

  document.getElementById('captureBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        source: 'med-assist-sidebar',
        type: 'CAPTURE_PRIVACY_SCREENSHOT'
      });
    }
    window.close();
  });

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await sendToActiveTab({ type: 'TOGGLE_SIDEBAR' });
    setTimeout(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          source: 'med-assist-sidebar',
          type: 'REFRESH_DATA'
        });
      }
    }, 300);
    window.close();
  });

  document.getElementById('historyBtn').addEventListener('click', async () => {
    await sendToActiveTab({ type: 'TOGGLE_SIDEBAR' });
    setTimeout(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          source: 'med-assist-sidebar',
          type: 'OPEN_HISTORY'
        });
      }
    }, 300);
    window.close();
  });

  document.getElementById('settingsBtn').addEventListener('click', async () => {
    await sendToActiveTab({ type: 'TOGGLE_SIDEBAR' });
    setTimeout(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          source: 'med-assist-sidebar',
          type: 'OPEN_SETTINGS'
        });
      }
    }, 300);
    window.close();
  });
}

init();
