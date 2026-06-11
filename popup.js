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
    chrome.storage.local.get(key, (data) => resolve(data[key]));
  });
}

function openPanel(panel, modal = null) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TOGGLE_SIDEBAR',
        panel,
        modal,
        force: true
      });
    }
  });
  window.close();
}

function renderEnabled() {
  document.getElementById('header').classList.remove('warn');
  document.getElementById('headerSubtitle').textContent = '医生门诊辅助工具';
  document.getElementById('siteAlert').style.display = 'none';
  document.getElementById('statusDot').classList.remove('off');
  document.getElementById('statusText').textContent = '院内系统已启用';

  const actions = document.getElementById('actions');
  actions.innerHTML = `
    <button class="btn btn-primary" data-action="summary">
      <span class="icon ic-1">📋</span>
      <span class="btn-text"><span>患者摘要</span><span class="desc">查看结构化门诊信息</span></span>
    </button>
    <button class="btn" data-action="order">
      <span class="icon ic-2">💊</span>
      <span class="btn-text"><span>医嘱草稿</span><span class="desc">编辑医嘱并快速插入</span></span>
    </button>
    <button class="btn" data-action="checkup">
      <span class="icon ic-3">🔬</span>
      <span class="btn-text"><span>检查提醒</span><span class="desc">智能推荐 & 缺失项提醒</span></span>
    </button>
    <button class="btn" data-action="followup">
      <span class="icon ic-4">📅</span>
      <span class="btn-text"><span>随访模板</span><span class="desc">生成结构化随访内容</span></span>
    </button>
    <button class="btn" data-action="snippet">
      <span class="icon ic-5">⚡</span>
      <span class="btn-text"><span>快捷片段</span><span class="desc">常用病历短语一键插入</span></span>
    </button>
    <button class="btn" data-action="capture">
      <span class="icon ic-1">📷</span>
      <span class="btn-text"><span>隐私遮挡截图</span><span class="desc">手动框选涂黑隐私区域</span></span>
    </button>
    <button class="btn" data-action="refresh">
      <span class="icon ic-2">🔄</span>
      <span class="btn-text"><span>重新识别页面</span><span class="desc">刷新患者信息提取</span></span>
    </button>
    <button class="btn" data-action="history">
      <span class="icon ic-4">📜</span>
      <span class="btn-text"><span>操作历史</span><span class="desc">查看最近操作记录</span></span>
    </button>
    <button class="btn" data-action="settings">
      <span class="icon ic-5">⚙️</span>
      <span class="btn-text"><span>设置 / 科室 / 导入导出</span><span class="desc">切换科室、配置白名单</span></span>
    </button>
  `;

  actions.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'summary':
        case 'order':
        case 'checkup':
        case 'followup':
        case 'snippet':
          openPanel(action);
          break;
        case 'capture':
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 'DIRECT_CAPTURE' });
            }
          });
          window.close();
          break;
        case 'refresh':
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 'DIRECT_REFRESH' });
            }
          });
          openPanel('summary');
          break;
        case 'history':
          openPanel(null, 'HISTORY');
          break;
        case 'settings':
          openPanel(null, 'SETTINGS');
          break;
      }
    });
  });
}

function renderDisabled() {
  document.getElementById('header').classList.add('warn');
  document.getElementById('headerSubtitle').textContent = '当前页面非院内系统';
  document.getElementById('siteAlert').style.display = 'block';
  document.getElementById('statusDot').classList.add('off');
  document.getElementById('statusText').textContent = '功能已限制';

  const actions = document.getElementById('actions');
  actions.innerHTML = `
    <button class="btn btn-warn" data-action="settings">
      <span class="icon ic-6">⚙️</span>
      <span class="btn-text"><span>配置白名单</span><span class="desc">添加启用站点，解锁全部功能</span></span>
    </button>
    <button class="btn" data-action="settings_view">
      <span class="icon ic-5">📋</span>
      <span class="btn-text"><span>查看已有配置</span><span class="desc">导入导出、历史记录等</span></span>
    </button>
  `;

  actions.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      openPanel(null, 'SETTINGS');
    });
  });
}

async function checkSiteEnabled() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url || (!tab.url.startsWith('http') && !tab.url.startsWith('file'))) {
        resolve(false);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'CHECK_SITE_ENABLED' }, (resp) => {
        if (resp && resp.success) {
          resolve(resp.enabled);
        } else {
          chrome.storage.local.get('enabled_sites', (d) => {
            const sites = d.enabled_sites || [];
            resolve(sites.some(s => tab.url.toLowerCase().includes(s.toLowerCase())));
          });
        }
      });
    });
  });
}

async function init() {
  const dept = await getStorage('current_department');
  if (dept) document.getElementById('currentDept').textContent = dept;

  const enabled = await checkSiteEnabled();
  if (enabled) {
    renderEnabled();
  } else {
    renderDisabled();
  }
}

init();
