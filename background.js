const STORAGE_KEYS = {
  PATIENT_DATA: 'patient_data',
  USER_TEMPLATES: 'user_templates',
  SNIPPETS: 'snippets',
  DEPARTMENT: 'current_department',
  HISTORY: 'operation_history',
  ENABLED_SITES: 'enabled_sites',
  ORDER_DRAFTS: 'order_drafts',
  FOLLOWUP_TEMPLATES: 'followup_templates'
};

const DEFAULT_SNIPPETS = {
  内科: [
    { id: '1', name: '一般查体', content: '患者神志清楚，精神可，自主体位，查体合作。全身皮肤黏膜无黄染、皮疹及出血点，浅表淋巴结未触及肿大。双肺呼吸音清，未闻及干湿性啰音。心率齐，各瓣膜听诊区未闻及病理性杂音。腹平软，无压痛及反跳痛，肝脾肋下未触及。' },
    { id: '2', name: '主诉模板', content: '患者诉____，病程____，无____，有____。' },
    { id: '3', name: '常见诊断', content: '初步诊断：1.____；2.____' },
    { id: '4', name: '复查建议', content: '建议门诊复查，不适随诊。' },
    { id: '5', name: '用药指导', content: '遵医嘱用药，切勿自行增减剂量。' }
  ],
  外科: [
    { id: '1', name: '术后常规', content: '术后安返病房，生命体征平稳，伤口敷料干洁，无渗血渗液。' },
    { id: '2', name: '伤口检查', content: '伤口愈合良好，无红肿、渗液，缝线在位。' },
    { id: '3', name: '拆线医嘱', content: '术后7-9天拆线，保持伤口干燥清洁。' },
    { id: '4', name: '骨科查体', content: '患肢肿胀消退，肢端血运、感觉、活动正常。' }
  ],
  儿科: [
    { id: '1', name: '小儿查体', content: '患儿神志清楚，精神反应可，呼吸平稳，皮肤无黄染，前囟平软，双肺呼吸音清，心律齐，腹软，肠鸣音正常。' },
    { id: '2', name: '发热模板', content: '患儿体温____℃，伴____，无抽搐，纳眠可，二便调。' },
    { id: '3', name: '疫苗接种', content: '按计划接种疫苗，接种后观察30分钟。' }
  ],
  妇产科: [
    { id: '1', name: '产科常规', content: '宫内妊娠，胎心胎动正常，宫高腹围与孕周相符。' },
    { id: '2', name: '妇科查体', content: '外阴发育正常，阴道通畅，宫颈光滑，宫体前位，大小正常，双附件区未扪及异常。' },
    { id: '3', name: '孕期指导', content: '定期产检，注意胎动，均衡营养，适当活动。' }
  ]
};

const DEFAULT_FOLLOWUP_TEMPLATES = [
  {
    id: 'gen_checkup',
    name: '常规复诊',
    content: `【复诊注意事项】
1. 复诊时间：____年____月____日
2. 复诊前准备：
   - 携带既往病历资料
   - 空腹（如需抽血检查）
   - 记录近期症状变化
3. 需复查项目：
   - ☐ 血常规
   - ☐ 肝肾功能
   - ☐ 心电图
   - ☐ 影像学检查
4. 日常注意：
   - 规律作息，避免劳累
   - 遵医嘱按时服药
   - 如有不适及时就诊`
  },
  {
    id: 'hypertension',
    name: '高血压随访',
    content: `【高血压患者随访】
复诊时间：____年____月____日
需复查项目：
☐ 血压监测记录
☐ 血脂四项
☐ 肝肾功能
☐ 心电图
☐ 尿常规
日常管理：
- 每日早晚测量血压并记录
- 低盐低脂饮食，每日盐摄入量<5g
- 适度运动，每周不少于150分钟
- 戒烟限酒，保持心理平衡
如有血压持续>140/90mmHg或出现头痛、胸闷等症状请及时就诊。`
  },
  {
    id: 'diabetes',
    name: '糖尿病随访',
    content: `【糖尿病患者随访】
复诊时间：____年____月____日
需复查项目：
☐ 空腹血糖
☐ 糖化血红蛋白
☐ 肝肾功能
☐ 血脂
☐ 尿微量白蛋白
☐ 眼底检查
日常管理：
- 每日监测血糖（空腹+三餐后2小时）
- 严格糖尿病饮食，控制总热量
- 规律运动，避免空腹运动
- 注意足部护理，定期检查
- 随身携带糖果防止低血糖
血糖控制目标：空腹<7.0mmol/L，餐后2h<10.0mmol/L`
  },
  {
    id: 'post_surgery',
    name: '术后随访',
    content: `【术后随访】
复诊时间：____年____月____日
手术名称：____
需复查项目：
☐ 伤口检查
☐ 影像学复查
☐ 相关实验室检查
☐ 功能评估
注意事项：
- 保持伤口清洁干燥，避免感染
- 适当功能锻炼，循序渐进
- 加强营养，促进愈合
- 如出现伤口红肿渗液、发热、剧烈疼痛等请及时就诊`
  }
];

const DEFAULT_ENABLED_SITES = [
  'his.',
  'hospital.',
  'medical.',
  'med.',
  'clin.',
  '门诊',
  'his系统',
  '医院信息'
];

async function initStorage() {
  const stored = await chrome.storage.local.get(null);
  
  if (!stored[STORAGE_KEYS.SNIPPETS]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SNIPPETS]: DEFAULT_SNIPPETS });
  }
  if (!stored[STORAGE_KEYS.FOLLOWUP_TEMPLATES]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.FOLLOWUP_TEMPLATES]: DEFAULT_FOLLOWUP_TEMPLATES });
  }
  if (!stored[STORAGE_KEYS.DEPARTMENT]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.DEPARTMENT]: '内科' });
  }
  if (!stored[STORAGE_KEYS.HISTORY]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] });
  }
  if (!stored[STORAGE_KEYS.ENABLED_SITES]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ENABLED_SITES]: DEFAULT_ENABLED_SITES });
  }
  if (!stored[STORAGE_KEYS.USER_TEMPLATES]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_TEMPLATES]: [] });
  }
  if (!stored[STORAGE_KEYS.ORDER_DRAFTS]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ORDER_DRAFTS]: [] });
  }
}

async function addHistory(action, detail) {
  const { [STORAGE_KEYS.HISTORY]: history = [] } = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
  const entry = {
    id: Date.now().toString(),
    action,
    detail,
    timestamp: new Date().toISOString()
  };
  history.unshift(entry);
  const trimmed = history.slice(0, 200);
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: trimmed });
}

async function isSiteEnabled(url) {
  const { [STORAGE_KEYS.ENABLED_SITES]: enabledSites = [] } = await chrome.storage.local.get(STORAGE_KEYS.ENABLED_SITES);
  if (!url) return false;
  return enabledSites.some(site => url.toLowerCase().includes(site.toLowerCase()));
}

chrome.runtime.onInstalled.addListener(async () => {
  await initStorage();
  await addHistory('系统', '插件已安装/更新');
});

chrome.runtime.onStartup.addListener(async () => {
  await initStorage();
});

chrome.action.onClicked.addListener(async (tab) => {
  const enabled = await isSiteEnabled(tab.url);
  if (!enabled && tab.url && tab.url.startsWith('http')) {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '智慧医疗助手',
      message: '当前页面不在院内系统列表中，部分功能可能受限。'
    });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-sidebar') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.type) {
        case 'GET_STORAGE': {
          const data = await chrome.storage.local.get(request.key);
          sendResponse({ success: true, data: data[request.key] });
          break;
        }
        case 'SET_STORAGE': {
          await chrome.storage.local.set({ [request.key]: request.value });
          sendResponse({ success: true });
          break;
        }
        case 'GET_ALL_STORAGE': {
          const data = await chrome.storage.local.get(null);
          sendResponse({ success: true, data });
          break;
        }
        case 'ADD_HISTORY': {
          await addHistory(request.action, request.detail);
          sendResponse({ success: true });
          break;
        }
        case 'IS_SITE_ENABLED': {
          const enabled = await isSiteEnabled(request.url);
          sendResponse({ success: true, enabled });
          break;
        }
        case 'CAPTURE_SCREENSHOT': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            try {
              const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
              sendResponse({ success: true, dataUrl });
            } catch (e) {
              sendResponse({ success: false, error: e.message });
            }
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
          break;
        }
        case 'COPY_TO_CLIPBOARD': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (text) => {
                navigator.clipboard.writeText(text).then(() => true).catch(() => false);
              },
              args: [request.text]
            });
            sendResponse({ success: true });
          }
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  })();
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    const enabled = await isSiteEnabled(tab.url);
    if (enabled) {
      chrome.action.setBadgeText({ tabId, text: '医' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
    }
  }
});
