(function () {
  'use strict';

  let sidebarIframe = null;
  let sidebarContainer = null;
  let isSidebarVisible = false;
  let siteEnabled = false;
  let lastEditableElement = null;
  let lastEditableInfo = null;

  const PRIVACY_PATTERNS = [
    /身份证[号号码]?[：:\s]*[0-9X]{15,19}/gi,
    /身份证号?[：:\s]*\d{17}[\dXx]/g,
    /电话[号号码]?[：:\s]*1[3-9]\d{9}/g,
    /手[机机][：:\s]*1[3-9]\d{9}/g,
    /手机号?[：:\s]*1[3-9]\d{9}/g,
    /住址[：:\s]*[\u4e00-\u9fa50-9\s\-_]{5,}/g,
    /地址[：:\s]*[\u4e00-\u9fa50-9\s\-_]{5,}/g,
    /邮箱?[：:\s]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /姓名[：:\s]*[\u4e00-\u9fa5]{2,4}/g,
    /病人姓名[：:\s]*[\u4e00-\u9fa5]{2,4}/g,
    /患者姓名[：:\s]*[\u4e00-\u9fa5]{2,4}/g,
    /医保号[：:\s]*[A-Za-z0-9]{6,}/g,
    /病案号[：:\s]*[0-9A-Za-z\-]{4,}/g,
    /住院号[：:\s]*[0-9A-Za-z\-]{4,}/g
  ];

  const ABNORMAL_FLAGS = ['↑', '↓', 'H', 'L', 'High', 'Low', '偏高', '偏低', '异常', 'HIGH', 'LOW', '*', '！', '!'];

  const LABEL_KEYWORDS = {
    name: ['姓名', '患者姓名', '病人姓名', 'Name', 'Patient Name'],
    gender: ['性别', 'Gender', 'Sex'],
    age: ['年龄', 'Age'],
    idCard: ['身份证号', '身份证', 'ID号', 'ID Card'],
    phone: ['电话', '手机', '联系电话', 'Phone', 'Tel', 'Mobile'],
    department: ['科室', '就诊科室', 'Department'],
    doctor: ['医生', '主治医生', '接诊医生', 'Doctor'],
    diagnosis: ['诊断', '初步诊断', '出院诊断', '主诉诊断', 'Diagnosis'],
    medication: ['用药', '处方', '药品', '医嘱用药', 'Medication', 'Prescription'],
    labResult: ['检验', '检查报告', '化验', 'Lab', 'Test'],
    visitDate: ['就诊日期', '就诊时间', '日期', 'Date']
  };

  function createFloatingButton() {
    if (document.getElementById('med-assist-float-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'med-assist-float-btn';
    btn.innerHTML = '医';
    btn.title = '智慧医疗助手 (Ctrl+Shift+M)';
    btn.style.cssText = `
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      z-index: 2147483646;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
      transition: all 0.3s ease;
      user-select: none;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-50%) scale(1.1)';
      btn.style.boxShadow = '0 6px 24px rgba(37, 99, 235, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(-50%) scale(1)';
      btn.style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.4)';
    });
    btn.addEventListener('click', () => {
      toggleSidebar();
    });
    document.body.appendChild(btn);
  }

  function createSidebar() {
    if (sidebarContainer) return;

    sidebarContainer = document.createElement('div');
    sidebarContainer.id = 'med-assist-sidebar-container';
    sidebarContainer.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 0;
      height: 100vh;
      z-index: 2147483647;
      transition: width 0.3s ease;
      overflow: hidden;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
    `;

    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = 'med-assist-sidebar-iframe';
    sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
    sidebarIframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: white;
      display: block;
    `;
    sidebarIframe.onload = () => {
      extractAndSendPageData();
    };

    sidebarContainer.appendChild(sidebarIframe);
    document.body.appendChild(sidebarContainer);
  }

  function trackEditableFocus(e) {
    const target = e.target;
    if (!target) return;
    const tag = target.tagName && target.tagName.toLowerCase();
    const isInput = tag === 'textarea' || tag === 'input';
    const isContentEditable = target.isContentEditable;
    if (isInput || isContentEditable) {
      lastEditableElement = target;
      lastEditableInfo = {
        tag,
        isContentEditable,
        id: target.id,
        name: target.name,
        className: target.className
      };
    }
  }

  function setupEditableTracking() {
    document.addEventListener('focusin', trackEditableFocus, true);
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const tag = target.tagName && target.tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input' || target.isContentEditable) {
        trackEditableFocus(e);
      }
    }, true);
  }

  function toggleSidebar(options = {}) {
    const { force = false, action = 'toggle', panel = null, modal = null } = options;

    if (!siteEnabled && !force) {
      return;
    }

    if (!sidebarContainer) {
      createSidebar();
    }

    let shouldOpen;
    if (action === 'open') {
      shouldOpen = true;
    } else if (action === 'close') {
      shouldOpen = false;
    } else {
      shouldOpen = !isSidebarVisible;
    }

    isSidebarVisible = shouldOpen;

    if (shouldOpen) {
      sidebarContainer.style.width = '420px';
      setTimeout(() => {
        sendMessageToSidebar({
          type: 'SIDEBAR_OPENED',
          siteEnabled,
          panel,
          modal
        });
      }, 50);
    } else {
      sidebarContainer.style.width = '0';
      sendMessageToSidebar({ type: 'SIDEBAR_CLOSED' });
    }
  }

  function sendMessageToSidebar(msg) {
    if (sidebarIframe && sidebarIframe.contentWindow) {
      sidebarIframe.contentWindow.postMessage({ source: 'med-assist-content', ...msg }, '*');
    }
  }

  function sendMessageToBackground(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        resolve(response);
      });
    });
  }

  function getTextByKeywords(keywords) {
    const results = [];
    const text = document.body.innerText || '';
    const allElements = document.querySelectorAll('*');

    for (const el of allElements) {
      if (el.children.length > 0) continue;
      const elText = (el.innerText || el.textContent || '').trim();
      if (!elText) continue;

      for (const keyword of keywords) {
        if (elText.includes(keyword)) {
          let value = elText.replace(new RegExp(keyword + '[：:]*\\s*'), '').trim();
          value = value.split(/[\n\r，,；;]/)[0].trim();
          if (value && value.length < 100 && value !== keyword) {
            if (!results.includes(value)) {
              results.push(value);
            }
          }
          break;
        }
      }
    }

    const patterns = keywords.map(k => new RegExp(k + '[：:]*\\s*([^\\n\\r，,；;]{1,50})', 'g'));
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const val = match[1].trim();
        if (val && val.length > 0 && val.length < 100 && !results.includes(val)) {
          results.push(val);
        }
      }
    }

    return results;
  }

  function extractPatientBasic() {
    const basic = {
      name: getTextByKeywords(LABEL_KEYWORDS.name)[0] || '',
      gender: getTextByKeywords(LABEL_KEYWORDS.gender)[0] || '',
      age: getTextByKeywords(LABEL_KEYWORDS.age)[0] || '',
      idCard: getTextByKeywords(LABEL_KEYWORDS.idCard)[0] || '',
      phone: getTextByKeywords(LABEL_KEYWORDS.phone)[0] || '',
      department: getTextByKeywords(LABEL_KEYWORDS.department)[0] || '',
      doctor: getTextByKeywords(LABEL_KEYWORDS.doctor)[0] || '',
      visitDate: getTextByKeywords(LABEL_KEYWORDS.visitDate)[0] || ''
    };
    return basic;
  }

  function extractDiagnosis() {
    const diagnoses = [];
    const text = document.body.innerText || '';

    const diagnosisKeywords = LABEL_KEYWORDS.diagnosis;
    for (const keyword of diagnosisKeywords) {
      const pattern = new RegExp(keyword + '[：:\\s]*([^\\n\\r。.]{2,200})', 'g');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let val = match[1].trim();
        val = val.split(/[。.；;]/)[0].trim();
        if (val && val.length > 1 && val.length < 200) {
          val = val.replace(/^\d+[、.．)]\s*/g, '');
          if (!diagnoses.some(d => d.text === val)) {
            diagnoses.push({
              text: val,
              date: new Date().toISOString().split('T')[0]
            });
          }
        }
      }
    }
    return diagnoses.slice(0, 10);
  }

  function extractMedications() {
    const medications = [];
    const text = document.body.innerText || '';

    const drugPatterns = [
      /([\u4e00-\u9fa5A-Za-z]{2,15}(?:片|胶囊|颗粒|注射液|注射剂|糖浆|散|丸|膏|栓|贴|喷雾剂))[^，,；;。.\n\r]{0,30}/g,
      /([\u4e00-\u9fa5A-Za-z]{2,15})[：:\s]?\d+(?:mg|g|ml|μg|IU|万单位)[^，,；;。.\n\r]{0,20}/g,
      /口服[：:\s]*([\u4e00-\u9fa5A-Za-z0-9]{2,30})/g,
      /静(?:脉)?(?:滴注|推注)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9]{2,30})/g,
      /肌注[：:\s]*([\u4e00-\u9fa5A-Za-z0-9]{2,30})/g
    ];

    for (const pattern of drugPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let val = (match[1] || match[0]).trim();
        val = val.replace(/\s+/g, ' ');
        if (val && val.length > 1 && val.length < 100) {
          if (!medications.some(m => m.name === val)) {
            medications.push({
              name: val,
              dosage: '',
              frequency: '',
              date: new Date().toISOString().split('T')[0]
            });
          }
        }
      }
    }

    const medTexts = getTextByKeywords(LABEL_KEYWORDS.medication);
    for (const medText of medTexts) {
      if (!medications.some(m => medText.includes(m.name))) {
        medications.push({
          name: medText,
          dosage: '',
          frequency: '',
          date: new Date().toISOString().split('T')[0]
        });
      }
    }

    return medications.slice(0, 20);
  }

  function extractLabResults() {
    const results = [];
    const rows = document.querySelectorAll('tr');

    for (const row of rows) {
      const cells = row.querySelectorAll('td, th');
      if (cells.length < 3) continue;

      const cellTexts = Array.from(cells).map(c => (c.innerText || c.textContent || '').trim());

      let itemName = '';
      let value = '';
      let reference = '';
      let unit = '';
      let isAbnormal = false;

      for (let i = 0; i < cellTexts.length; i++) {
        const ct = cellTexts[i];
        if (!itemName && ct.length > 1 && ct.length < 30 && !/^\d/.test(ct)) {
          itemName = ct;
          continue;
        }
        if (itemName && !value && /^[\d\.\-]+/.test(ct)) {
          value = ct.match(/^[\d\.\-]+/)[0];
          if (ct.includes('↑') || ct.includes('↓') || ct.includes('H') || ct.includes('L') ||
              ct.includes('偏高') || ct.includes('偏低') || ct.includes('*') || ct.includes('！') ||
              ct.includes('High') || ct.includes('Low')) {
            isAbnormal = true;
          }
          const unitMatch = ct.match(/[\d\.\-]+\s*([A-Za-z\u4e00-\u9fa5%/]+)/);
          if (unitMatch) unit = unitMatch[1];
          continue;
        }
        if (itemName && value && !reference && (ct.includes('-') || ct.includes('~') || ct.includes('—'))) {
          reference = ct;
          break;
        }
      }

      if (itemName && value && !results.some(r => r.item === itemName)) {
        results.push({
          item: itemName,
          value,
          unit,
          reference,
          abnormal: isAbnormal
        });
      }
    }

    const text = document.body.innerText || '';
    const abnormalPattern = /([\u4e00-\u9fa5A-Za-z]{2,20})[\s：:]*([\d.]+)\s*([↑↓HL]|偏高|偏低|异常)/g;
    let match;
    while ((match = abnormalPattern.exec(text)) !== null) {
      const item = match[1].trim();
      if (item && item.length < 20 && !results.some(r => r.item === item)) {
        results.push({
          item,
          value: match[2],
          unit: '',
          reference: '',
          abnormal: true
        });
      }
    }

    return results;
  }

  function extractAndSendPageData() {
    const data = {
      url: location.href,
      title: document.title,
      patient: extractPatientBasic(),
      diagnosis: extractDiagnosis(),
      medications: extractMedications(),
      labResults: extractLabResults(),
      extractTime: new Date().toISOString()
    };
    sendMessageToSidebar({ type: 'PAGE_DATA', data });
  }

  function isElementStillValid(el) {
    if (!el) return false;
    if (!document.body.contains(el)) return false;
    const tag = el.tagName && el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'input') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function findNearestEditable() {
    const active = document.activeElement;
    if (active && (active.tagName.toLowerCase() === 'textarea' || active.tagName.toLowerCase() === 'input' || active.isContentEditable)) {
      return active;
    }
    if (isElementStillValid(lastEditableElement)) {
      return lastEditableElement;
    }
    return null;
  }

  function insertTextAtCursor(text) {
    let target = findNearestEditable();
    if (!target) return { success: false, reason: 'no_editable' };

    try {
      if (!target.isConnected) {
        target = findNearestEditable();
        if (!target) return { success: false, reason: 'no_editable' };
      }

      const tag = target.tagName.toLowerCase();

      if (tag === 'textarea' || tag === 'input') {
        target.focus();
        const start = target.selectionStart !== undefined ? target.selectionStart : target.value.length;
        const end = target.selectionEnd !== undefined ? target.selectionEnd : target.value.length;
        const before = target.value.substring(0, start);
        const after = target.value.substring(end);
        target.value = before + text + after;
        target.selectionStart = target.selectionEnd = start + text.length;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        lastEditableElement = target;
        return { success: true };
      }

      if (target.isContentEditable) {
        target.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (!target.contains(range.startContainer)) {
            range.selectNodeContents(target);
            range.collapse(false);
          }
          range.deleteContents();
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          target.appendChild(document.createTextNode(text));
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        lastEditableElement = target;
        return { success: true };
      }

      return { success: false, reason: 'unsupported_type' };
    } catch (e) {
      return { success: false, reason: 'error', message: e.message };
    }
  }

  async function captureScreenshotWithPrivacy() {
    const response = await sendMessageToBackground({ type: 'CAPTURE_SCREENSHOT' });
    if (!response || !response.success) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);z-index:2147483648;';
        const instruction = document.createElement('div');
        instruction.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#2563eb;color:white;padding:12px 24px;border-radius:8px;z-index:2147483649;font-size:14px;';
        instruction.textContent = '点击隐私区域进行遮挡，完成后按ESC键或点击空白处结束';
        overlay.appendChild(instruction);
        document.body.appendChild(overlay);

        const blockedAreas = [];
        const selectMode = { selecting: false, startX: 0, startY: 0, currentRect: null };

        const onMouseDown = (e) => {
          if (e.target === overlay || e.target === instruction) {
            selectMode.selecting = true;
            selectMode.startX = e.clientX;
            selectMode.startY = e.clientY;
            selectMode.currentRect = document.createElement('div');
            selectMode.currentRect.style.cssText = 'position:fixed;background:#000;border:2px dashed #2563eb;pointer-events:none;z-index:2147483650;';
            document.body.appendChild(selectMode.currentRect);
          }
        };

        const onMouseMove = (e) => {
          if (!selectMode.selecting) return;
          const x = Math.min(e.clientX, selectMode.startX);
          const y = Math.min(e.clientY, selectMode.startY);
          const w = Math.abs(e.clientX - selectMode.startX);
          const h = Math.abs(e.clientY - selectMode.startY);
          selectMode.currentRect.style.left = x + 'px';
          selectMode.currentRect.style.top = y + 'px';
          selectMode.currentRect.style.width = w + 'px';
          selectMode.currentRect.style.height = h + 'px';
        };

        const onMouseUp = (e) => {
          if (!selectMode.selecting) return;
          selectMode.selecting = false;
          const x = Math.min(e.clientX, selectMode.startX);
          const y = Math.min(e.clientY, selectMode.startY);
          const w = Math.abs(e.clientX - selectMode.startX);
          const h = Math.abs(e.clientY - selectMode.startY);
          if (w > 10 && h > 10) {
            const scaleX = canvas.width / window.innerWidth;
            const scaleY = canvas.height / window.innerHeight;
            blockedAreas.push({
              x: x * scaleX,
              y: y * scaleY,
              w: w * scaleX,
              h: h * scaleY
            });
            if (selectMode.currentRect) {
              selectMode.currentRect.style.background = '#000';
              selectMode.currentRect.style.border = 'none';
            }
          } else if (selectMode.currentRect) {
            selectMode.currentRect.remove();
          }
          selectMode.currentRect = null;
        };

        const cleanup = () => {
          document.removeEventListener('mousedown', onMouseDown);
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.removeEventListener('keydown', onKeyDown);
          document.querySelectorAll('[style*="z-index:2147483650"], [style*="z-index:2147483649"], [style*="z-index:2147483648"]').forEach(el => {
            if (el !== overlay && el !== instruction) el.remove();
          });
          overlay.remove();

          ctx.fillStyle = '#000';
          for (const area of blockedAreas) {
            ctx.fillRect(area.x, area.y, area.w, area.h);
          }
          resolve(canvas.toDataURL('image/png'));
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') cleanup();
        };

        overlay.addEventListener('dblclick', cleanup);
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
      };
      img.src = response.dataUrl;
    });
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'med-assist-sidebar') return;

    switch (msg.type) {
      case 'REFRESH_DATA':
        extractAndSendPageData();
        break;
      case 'INSERT_TEXT': {
        const result = insertTextAtCursor(msg.text);
        if (result.success) {
          sendMessageToBackground({ type: 'ADD_HISTORY', action: '插入文本', detail: msg.text.substring(0, 50) });
          sendMessageToSidebar({ type: 'INSERT_RESULT', success: true });
        } else {
          sendMessageToSidebar({ type: 'INSERT_RESULT', success: false, reason: result.reason, fallbackText: msg.text });
        }
        break;
      }
      case 'COPY_TEXT':
        navigator.clipboard.writeText(msg.text).then(() => {
          sendMessageToSidebar({ type: 'COPY_SUCCESS' });
          sendMessageToBackground({ type: 'ADD_HISTORY', action: '复制文本', detail: msg.text.substring(0, 50) });
        }).catch(() => {
          sendMessageToSidebar({ type: 'COPY_FAILED' });
        });
        break;
      case 'CAPTURE_PRIVACY_SCREENSHOT':
        captureScreenshotWithPrivacy().then((dataUrl) => {
          if (dataUrl) {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `医疗截图_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            a.click();
            sendMessageToSidebar({ type: 'SCREENSHOT_SUCCESS' });
            sendMessageToBackground({ type: 'ADD_HISTORY', action: '截图', detail: '隐私遮挡截图已保存' });
          }
        });
        break;
      case 'CLOSE_SIDEBAR':
        toggleSidebar({ action: 'close', force: true });
        break;
      case 'OPEN_PANEL':
        if (!isSidebarVisible) toggleSidebar({ force: true });
        setTimeout(() => sendMessageToSidebar({ type: 'SWITCH_PANEL', panel: msg.panel }), 100);
        break;
      case 'QUERY_EDITOR_STATUS':
        sendMessageToSidebar({
          type: 'EDITOR_STATUS',
          hasEditor: !!findNearestEditable(),
          siteEnabled
        });
        break;
      case 'REFRESH_SITE_STATUS':
        sendMessageToBackground({ type: 'IS_SITE_ENABLED', url: location.href }).then((resp) => {
          const wasEnabled = siteEnabled;
          siteEnabled = !!(resp && resp.enabled);
          if (wasEnabled !== siteEnabled) {
            const floatBtn = document.getElementById('med-assist-float-btn');
            if (siteEnabled && !floatBtn) {
              createFloatingButton();
            } else if (!siteEnabled && floatBtn) {
              floatBtn.remove();
            }
            sendMessageToSidebar({ type: 'SITE_STATUS_UPDATED', siteEnabled });
            if (!siteEnabled && isSidebarVisible) {
              toggleSidebar({ action: 'close', force: true });
            }
          }
        });
        break;
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      if (request.type === 'TOGGLE_SIDEBAR') {
        const action = request.action || 'toggle';
        const force = request.force || (request.modal ? true : false);
        
        if (!siteEnabled && !force) {
          sendResponse({ success: false, siteEnabled, reason: 'site_disabled' });
          return;
        }

        toggleSidebar({
          force,
          action,
          panel: request.panel,
          modal: request.modal
        });
        sendResponse({ success: true, siteEnabled, visible: isSidebarVisible });
      } else if (request.type === 'CHECK_SITE_ENABLED') {
        sendResponse({ success: true, enabled: siteEnabled });
      } else if (request.type === 'DIRECT_CAPTURE') {
        if (!siteEnabled) {
          sendResponse({ success: false, reason: 'site_disabled' });
          return;
        }
        captureScreenshotWithPrivacy().then((dataUrl) => {
          if (dataUrl) {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `医疗截图_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            a.click();
            sendMessageToBackground({ type: 'ADD_HISTORY', action: '截图', detail: '隐私遮挡截图已保存' });
          }
          sendResponse({ success: !!dataUrl });
        });
        return true;
      } else if (request.type === 'DIRECT_REFRESH') {
        if (!siteEnabled) {
          sendResponse({ success: false, reason: 'site_disabled' });
          return;
        }
        extractAndSendPageData();
        sendResponse({ success: true });
      } else if (request.type === 'SITE_ENABLED_UPDATED') {
        siteEnabled = request.enabled;
        const floatBtn = document.getElementById('med-assist-float-btn');
        if (siteEnabled && !floatBtn) {
          createFloatingButton();
        } else if (!siteEnabled && floatBtn) {
          floatBtn.remove();
        }
        sendResponse({ success: true });
      }
    })();
    return true;
  });

  function init() {
    setupEditableTracking();
    sendMessageToBackground({ type: 'IS_SITE_ENABLED', url: location.href }).then((resp) => {
      siteEnabled = !!(resp && resp.enabled);
      if (siteEnabled) {
        createFloatingButton();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
