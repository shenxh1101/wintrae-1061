(function () {
  'use strict';

  const STORAGE_KEYS = {
    PATIENT_ARCHIVES: 'patient_archives',
    CURRENT_PATIENT_KEY: 'current_patient_key',
    USER_TEMPLATES: 'user_templates',
    SNIPPETS: 'snippets',
    DEPARTMENT: 'current_department',
    HISTORY: 'operation_history',
    ENABLED_SITES: 'enabled_sites',
    ORDER_DRAFTS: 'order_drafts',
    FOLLOWUP_TEMPLATES: 'followup_templates',
    PATIENT_DRAFTS: 'patient_drafts'
  };

  let currentPageData = null;
  let isSiteEnabled = true;
  let state = {
    department: '内科',
    snippets: {},
    userTemplates: [],
    orderDrafts: [],
    followupTemplates: [],
    history: [],
    patientArchives: {},
    patientDrafts: {},
    currentPatientKey: null
  };

  let currentArchivePatient = null;

  const $ = (id) => document.getElementById(id);
  const els = {};

  function toast(msg, type = 'info') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `toast show toast-${type}`;
    setTimeout(() => { el.className = 'toast'; }, 2200);
  }

  function sendToContent(message) {
    window.parent.postMessage({ source: 'med-assist-sidebar', ...message }, '*');
  }

  function sendToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response);
      });
    });
  }

  async function loadState() {
    const resp = await sendToBackground({ type: 'GET_ALL_STORAGE' });
    if (resp && resp.success) {
      const d = resp.data;
      state.department = d[STORAGE_KEYS.DEPARTMENT] || '内科';
      state.snippets = d[STORAGE_KEYS.SNIPPETS] || {};
      state.userTemplates = d[STORAGE_KEYS.USER_TEMPLATES] || [];
      state.orderDrafts = d[STORAGE_KEYS.ORDER_DRAFTS] || [];
      state.followupTemplates = d[STORAGE_KEYS.FOLLOWUP_TEMPLATES] || [];
      state.history = d[STORAGE_KEYS.HISTORY] || [];
      state.patientArchives = d[STORAGE_KEYS.PATIENT_ARCHIVES] || {};
      state.patientDrafts = d[STORAGE_KEYS.PATIENT_DRAFTS] || {};
      state.currentPatientKey = d[STORAGE_KEYS.CURRENT_PATIENT_KEY] || null;
    }
  }

  async function saveStorage(key, value) {
    await sendToBackground({ type: 'SET_STORAGE', key, value });
  }

  async function addHistory(action, detail) {
    await sendToBackground({ type: 'ADD_HISTORY', action, detail });
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchToPanel(tab.dataset.tab);
      });
    });
  }

  function switchToPanel(panelName) {
    if (!panelName) return;
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    const targetTab = document.querySelector(`.tab[data-tab="${panelName}"]`);
    if (targetTab) targetTab.classList.add('active');
    const targetPanel = $(`panel-${panelName}`);
    if (targetPanel) targetPanel.classList.add('active');
  }

  function updateSiteRestrictionUI() {
    const tabs = document.querySelectorAll('.tab');
    if (!isSiteEnabled) {
      tabs.forEach(t => {
        t.style.opacity = '0.3';
        t.style.pointerEvents = 'none';
      });
      const overlay = $('siteRestrictionOverlay');
      if (!overlay) {
        const o = document.createElement('div');
        o.id = 'siteRestrictionOverlay';
        o.style.cssText = 'position:absolute;inset:0;background:rgba(255,255,255,0.98);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;';
        o.innerHTML = `
          <div style="font-size:56px;margin-bottom:18px;">🔒</div>
          <h3 style="font-size:16px;color:#1e293b;margin-bottom:10px;">当前页面非院内系统</h3>
          <p style="font-size:12px;color:#64748b;margin-bottom:24px;line-height:1.7;max-width:280px;">
            智慧医疗助手仅在配置的院内页面提供完整功能，<br>避免干扰您的正常工作。
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;width:220px;">
            <button class="btn-block primary" id="goSettingsFromOverlay" style="margin:0;">去配置白名单</button>
            <button class="btn-block secondary" id="closeSidebarFromOverlay" style="margin:0;">关闭侧边栏</button>
          </div>
        `;
        document.querySelector('.app').style.position = 'relative';
        document.querySelector('.app').appendChild(o);
        o.querySelector('#goSettingsFromOverlay').onclick = () => {
          showSettingsModal('settings');
        };
        o.querySelector('#closeSidebarFromOverlay').onclick = () => {
          sendToContent({ type: 'CLOSE_SIDEBAR' });
        };
      }
    } else {
      tabs.forEach(t => {
        t.style.opacity = '';
        t.style.pointerEvents = '';
      });
      const overlay = $('siteRestrictionOverlay');
      if (overlay) overlay.remove();
    }
  }

  function showInsertFallbackModal(text) {
    const modal = $('modal');
    $('modalTitle').textContent = '未找到可插入的编辑器';
    $('modalBody').innerHTML = `
      <div style="padding:8px 2px 16px;">
        <p style="font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.6;">
          请先点击院内系统的病历输入框，再尝试插入内容。<br>
          当前内容已为您准备好，可复制后手动粘贴：
        </p>
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:12px;line-height:1.6;max-height:160px;overflow:auto;margin-bottom:14px;white-space:pre-wrap;color:#1e293b;">${escapeHtml(text)}</div>
        <div class="modal-actions" style="padding:0;">
          <button class="btn-block secondary" id="fallbackCancelBtn">关闭</button>
          <button class="btn-block primary" id="fallbackCopyBtn">复制文本</button>
        </div>
      </div>
    `;
    modal.classList.add('show');
    $('fallbackCancelBtn').onclick = () => modal.classList.remove('show');
    $('fallbackCopyBtn').onclick = () => {
      sendToContent({ type: 'COPY_TEXT', text });
      modal.classList.remove('show');
    };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function maskText(text) {
    if (!text) return text;
    return text
      .replace(/1[3-9]\d{9}/g, (m) => m.slice(0, 3) + '****' + m.slice(7))
      .replace(/\d{17}[\dXx]/g, (m) => m.slice(0, 4) + '********' + m.slice(-4))
      .replace(/\d{15}/g, (m) => m.slice(0, 4) + '*******' + m.slice(-4));
  }

  function getPatientKey() {
    const p = (currentPageData && currentPageData.patient) || {};
    if (p.idCard) return `id_${p.idCard.slice(0, 6)}****${p.idCard.slice(-4)}`;
    if (p.phone) return `phone_${p.phone.slice(0, 3)}****${p.phone.slice(-4)}`;
    if (p.name && p.age && p.gender) return `name_${p.name}_${p.age}_${p.gender}`;
    if (p.name) return `name_${p.name}_${new Date().toDateString()}`;
    return null;
  }

  function getCurrentArchive() {
    const key = getPatientKey();
    if (!key) return null;
    return state.patientArchives[key] || null;
  }

  async function saveCurrentArchive(data) {
    const key = getPatientKey();
    if (!key) { toast('无法识别患者身份', 'warning'); return false; }
    
    const archive = state.patientArchives[key] || { versions: [] };
    const version = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...data
    };
    archive.versions.unshift(version);
    if (archive.versions.length > 20) archive.versions = archive.versions.slice(0, 20);
    archive.latest = version;
    archive.patient = { ...(currentPageData && currentPageData.patient) };
    
    state.patientArchives[key] = archive;
    await saveStorage(STORAGE_KEYS.PATIENT_ARCHIVES, state.patientArchives);
    return true;
  }

  function showArchiveEditor() {
    const archive = getCurrentArchive();
    const latest = archive && archive.latest;
    const p = (currentPageData && currentPageData.patient) || {};
    
    if (!getPatientKey()) {
      toast('请先识别到患者信息', 'warning');
      return;
    }

    const modal = $('modal');
    $('modalTitle').textContent = '编辑就诊档案';
    $('modalBody').innerHTML = `
      <div style="padding:6px 2px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:12px;">
          👤 <strong>${escapeHtml(p.name || '未识别')}</strong>
          ${p.gender ? ` · ${escapeHtml(p.gender)}` : ''}
          ${p.age ? ` · ${escapeHtml(p.age)}岁` : ''}
        </div>
        
        <div class="form-group">
          <label class="form-label">主诉</label>
          <textarea class="form-textarea" id="archiveChiefComplaint" rows="2" placeholder="例如：反复咳嗽3天，伴发热1天">${escapeHtml(latest?.chiefComplaint || '')}</textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">现病史</label>
          <textarea class="form-textarea" id="archiveHistoryPresent" rows="4" placeholder="详细描述发病情况、诊疗经过、目前情况...">${escapeHtml(latest?.historyPresent || '')}</textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">过敏史</label>
          <textarea class="form-textarea" id="archiveAllergies" rows="2" placeholder="例如：青霉素过敏、海鲜过敏">${escapeHtml(latest?.allergies || '')}</textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">处理意见</label>
          <textarea class="form-textarea" id="archivePlan" rows="4" placeholder="诊断、处理方案、用药、检查建议...">${escapeHtml(latest?.plan || '')}</textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-textarea" id="archiveNote" rows="2" placeholder="其他需要记录的信息">${escapeHtml(latest?.note || '')}</textarea>
        </div>
        
        ${archive && archive.versions && archive.versions.length > 1 ? `
          <div class="form-group">
            <label class="form-label">历史版本（共 ${archive.versions.length} 版）</label>
            <select class="form-select" id="archiveVersionSelect">
              <option value="">—— 选择历史版本查看 ——</option>
              ${archive.versions.map((v, i) => 
                `<option value="${v.id}">${i === 0 ? '【当前】 ' : ''}${new Date(v.timestamp).toLocaleString()}</option>`
              ).join('')}
            </select>
          </div>
        ` : ''}
        
        <div class="modal-actions" style="margin-top:16px;">
          <button class="btn-block secondary" id="archiveCancelBtn">取消</button>
          <button class="btn-block primary" id="archiveSaveBtn">保存档案</button>
        </div>
      </div>
    `;
    modal.classList.add('show');

    $('archiveCancelBtn').onclick = () => modal.classList.remove('show');
    
    const versionSel = $('archiveVersionSelect');
    if (versionSel) {
      versionSel.onchange = () => {
        const vid = versionSel.value;
        if (!vid) return;
        const v = (archive.versions || []).find(x => x.id === vid);
        if (v) {
          $('archiveChiefComplaint').value = v.chiefComplaint || '';
          $('archiveHistoryPresent').value = v.historyPresent || '';
          $('archiveAllergies').value = v.allergies || '';
          $('archivePlan').value = v.plan || '';
          $('archiveNote').value = v.note || '';
        }
      };
    }

    $('archiveSaveBtn').onclick = async () => {
      const data = {
        chiefComplaint: $('archiveChiefComplaint').value.trim(),
        historyPresent: $('archiveHistoryPresent').value.trim(),
        allergies: $('archiveAllergies').value.trim(),
        plan: $('archivePlan').value.trim(),
        note: $('archiveNote').value.trim()
      };
      const ok = await saveCurrentArchive(data);
      if (ok) {
        toast('档案已保存', 'success');
        addHistory('保存档案', `${p.name || '患者'} 就诊档案`);
        modal.classList.remove('show');
        renderPatientSummary();
      }
    };
  }

  function buildClinicNote(mask = true) {
    const p = (currentPageData && currentPageData.patient) || {};
    const archive = getCurrentArchive();
    const latest = archive && archive.latest;
    const diagnosis = (currentPageData && currentPageData.diagnosis) || [];
    const medications = (currentPageData && currentPageData.medications) || [];
    const labs = (currentPageData && currentPageData.labResults) || [];
    const abnormal = labs.filter(l => l.abnormal);
    const missing = getMissingChecksSuggestions();

    const proc = (v) => mask ? maskText(v || '') : (v || '');

    let note = '【门诊小结】\n';
    note += `生成时间：${new Date().toLocaleString()}\n\n`;

    note += '一、基本信息\n';
    const basicItems = [
      ['姓名', p.name], ['性别', p.gender], ['年龄', p.age],
      ['科室', p.department], ['医生', p.doctor], ['就诊日期', p.visitDate],
      ['电话', proc(p.phone)], ['身份证', proc(p.idCard)]
    ].filter(([, v]) => v);
    if (basicItems.length > 0) {
      note += basicItems.map(([k, v]) => `${k}：${v}`).join('；') + '\n';
    }

    if (latest?.chiefComplaint) {
      note += `\n二、主诉\n${latest.chiefComplaint}\n`;
    }
    if (latest?.historyPresent) {
      note += `\n三、现病史\n${latest.historyPresent}\n`;
    }
    if (latest?.allergies) {
      note += `\n四、过敏史\n${latest.allergies}\n`;
    }

    if (diagnosis.length > 0) {
      note += '\n五、诊断\n';
      diagnosis.forEach((d, i) => {
        note += `${i + 1}. ${d.text}${d.date ? `（${d.date}）` : ''}\n`;
      });
    }

    if (medications.length > 0) {
      note += '\n六、用药\n';
      medications.forEach((m, i) => {
        note += `${i + 1}. ${m.name}\n`;
      });
    }

    if (abnormal.length > 0) {
      note += '\n七、异常检验值\n';
      abnormal.forEach((r, i) => {
        note += `${i + 1}. ${r.item}：${r.value}${r.unit || ''}${r.reference ? `（参考：${r.reference}）` : ''} ⚠️\n`;
      });
    }

    if (latest?.plan) {
      note += `\n八、处理意见\n${latest.plan}\n`;
    }

    if (missing.length > 0) {
      note += '\n九、建议补充检查\n';
      missing.forEach((m, i) => { note += `${i + 1}. ${m}\n`; });
    }

    if (latest?.note) {
      note += `\n十、备注\n${latest.note}\n`;
    }

    note += '\n—— 智慧医疗助手生成 ——';
    return note;
  }

  function getMissingChecksSuggestions() {
    const suggestions = [];
    const diagnosis = (currentPageData && currentPageData.diagnosis) || [];
    const diagText = diagnosis.map(d => d.text).join(' ');
    const labs = (currentPageData && currentPageData.labResults) || [];
    const labItems = labs.map(l => l.item);

    if (/高血压|血压高/.test(diagText)) {
      if (!labItems.some(i => /血脂|胆固醇/.test(i))) suggestions.push('血脂四项');
      if (!labItems.some(i => /心电图/.test(i))) suggestions.push('心电图');
      if (!labItems.some(i => /肾功|肌酐/.test(i))) suggestions.push('肾功能');
    }
    if (/糖尿病|血糖高/.test(diagText)) {
      if (!labItems.some(i => /糖化血红蛋白|HbA1c/i.test(i))) suggestions.push('糖化血红蛋白');
      if (!labItems.some(i => /尿微量白蛋白/.test(i))) suggestions.push('尿微量白蛋白');
      if (!labItems.some(i => /眼底/.test(i))) suggestions.push('眼底检查');
    }
    if (/冠心病|心绞痛|心肌|胸闷/.test(diagText)) {
      if (!labItems.some(i => /心电图/.test(i))) suggestions.push('心电图');
      if (!labItems.some(i => /肌钙蛋白|心肌酶/.test(i))) suggestions.push('心肌酶谱');
    }
    if (/发热|感染|感冒|炎症/.test(diagText)) {
      if (!labItems.some(i => /血常规|白细胞/.test(i))) suggestions.push('血常规+CRP');
    }
    return suggestions;
  }

  function buildStructuredSummary(mask = true) {
    const p = (currentPageData && currentPageData.patient) || {};
    const diagnosis = (currentPageData && currentPageData.diagnosis) || [];
    const medications = (currentPageData && currentPageData.medications) || [];
    const labs = (currentPageData && currentPageData.labResults) || [];
    const abnormal = labs.filter(l => l.abnormal);
    const missing = getMissingChecksSuggestions();

    const proc = (v) => mask ? maskText(v || '') : (v || '');

    let summary = '【门诊摘要】\n';
    summary += `生成时间：${new Date().toLocaleString()}\n\n`;

    summary += '一、基本信息\n';
    const basicItems = [
      ['姓名', p.name], ['性别', p.gender], ['年龄', p.age],
      ['科室', p.department], ['医生', p.doctor], ['就诊日期', p.visitDate],
      ['电话', proc(p.phone)], ['身份证', proc(p.idCard)]
    ].filter(([, v]) => v);
    if (basicItems.length > 0) {
      summary += basicItems.map(([k, v]) => `${k}：${v}`).join('；') + '\n';
    } else {
      summary += '（未识别到基本信息）\n';
    }

    summary += '\n二、最近诊断\n';
    if (diagnosis.length > 0) {
      diagnosis.forEach((d, i) => {
        summary += `${i + 1}. ${d.text}${d.date ? `（${d.date}）` : ''}\n`;
      });
    } else {
      summary += '（未识别到诊断记录）\n';
    }

    summary += '\n三、近期用药\n';
    if (medications.length > 0) {
      medications.forEach((m, i) => {
        summary += `${i + 1}. ${m.name}\n`;
      });
    } else {
      summary += '（未识别到用药记录）\n';
    }

    summary += '\n四、异常检验值\n';
    if (abnormal.length > 0) {
      abnormal.forEach((r, i) => {
        summary += `${i + 1}. ${r.item}：${r.value}${r.unit || ''}${r.reference ? `（参考：${r.reference}）` : ''} ⚠️异常\n`;
      });
    } else {
      summary += '（未检测到异常检验指标）\n';
    }

    summary += '\n五、缺失检查项提醒\n';
    if (missing.length > 0) {
      missing.forEach((m, i) => {
        summary += `${i + 1}. 建议补充：${m}\n`;
      });
    } else {
      summary += '（未识别到缺失项）\n';
    }

    summary += '\n—— 智慧医疗助手生成 ——';
    return summary;
  }

  function renderStructuredSummary() {
    const container = $('structuredSummary');
    if (!currentPageData || !currentPageData.patient) {
      container.innerHTML = '<div class="info-empty">暂未识别到患者数据，请先点击「重新识别」</div>';
      return;
    }
    const summary = buildStructuredSummary(true);
    container.innerHTML = `
      <pre style="margin:0;padding:12px 14px;font-family:inherit;font-size:12px;line-height:1.7;white-space:pre-wrap;color:#334155;background:var(--bg-secondary);border-radius:6px;">${escapeHtml(summary)}</pre>
      <div style="padding:10px 14px;display:flex;gap:8px;border-top:1px solid var(--border-light);">
        <button class="btn-block secondary" style="padding:8px 12px;font-size:12px;" id="refreshSummaryBtn">刷新</button>
        <button class="btn-block primary" style="padding:8px 12px;font-size:12px;" id="copyMaskedSummaryBtn">复制（已脱敏）</button>
      </div>
    `;
    $('refreshSummaryBtn').onclick = renderStructuredSummary;
    $('copyMaskedSummaryBtn').onclick = () => {
      const text = buildStructuredSummary(true);
      sendToContent({ type: 'COPY_TEXT', text });
      addHistory('复制摘要', '脱敏结构化门诊摘要');
    };
  }

  function renderPatientBasic() {
    const container = $('patientBasic');
    if (!currentPageData || !currentPageData.patient) {
      container.innerHTML = '<div class="info-empty">未识别到患者信息</div>';
      return;
    }
    const p = currentPageData.patient;
    const items = [
      { label: '姓名', value: p.name, icon: '👤' },
      { label: '性别', value: p.gender, icon: '⚧' },
      { label: '年龄', value: p.age, icon: '🎂' },
      { label: '科室', value: p.department, icon: '🏥' },
      { label: '医生', value: p.doctor, icon: '👨‍⚕️' },
      { label: '就诊日期', value: p.visitDate, icon: '📅' },
      { label: '电话', value: p.phone ? p.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '', icon: '📞' },
      { label: '身份证', value: p.idCard ? p.idCard.replace(/^(.{4}).+(.{4})$/, '$1********$2') : '', icon: '🆔' }
    ].filter(it => it.value);

    if (items.length === 0) {
      container.innerHTML = '<div class="info-empty">未识别到患者信息</div>';
      return;
    }

    container.innerHTML = items.map(it => `
      <div class="info-item">
        <span class="info-icon">${it.icon}</span>
        <span class="info-label">${it.label}</span>
        <span class="info-value">${it.value}</span>
      </div>
    `).join('');
  }

  function renderDiagnosis() {
    const list = $('diagnosisList');
    const count = $('diagnosisCount');
    const data = (currentPageData && currentPageData.diagnosis) || [];
    count.textContent = data.length;
    if (data.length === 0) {
      list.innerHTML = '<div class="info-empty">暂无诊断记录</div>';
      return;
    }
    list.innerHTML = data.map((d, i) => `
      <div class="list-item">
        <span class="item-index">${i + 1}</span>
        <div class="item-content">
          <div class="item-text">${d.text}</div>
          <div class="item-meta">${d.date || ''}</div>
        </div>
        <button class="mini-btn insert-btn" data-text="${d.text.replace(/"/g, '&quot;')}" title="插入">插入</button>
      </div>
    `).join('');
    bindInsertButtons(list);
  }

  function renderMedications() {
    const list = $('medicationList');
    const count = $('medicationCount');
    const data = (currentPageData && currentPageData.medications) || [];
    count.textContent = data.length;
    if (data.length === 0) {
      list.innerHTML = '<div class="info-empty">暂无用药记录</div>';
      return;
    }
    list.innerHTML = data.map((m, i) => `
      <div class="list-item">
        <span class="item-index med">${i + 1}</span>
        <div class="item-content">
          <div class="item-text">${m.name}</div>
          <div class="item-meta">${m.date || ''}</div>
        </div>
        <button class="mini-btn insert-btn" data-text="${m.name.replace(/"/g, '&quot;')}" title="插入">插入</button>
      </div>
    `).join('');
    bindInsertButtons(list);
  }

  function renderLabResults() {
    const list = $('labResultList');
    const count = $('abnormalCount');
    const all = (currentPageData && currentPageData.labResults) || [];
    const abnormal = all.filter(r => r.abnormal);
    count.textContent = abnormal.length;
    if (abnormal.length === 0) {
      list.innerHTML = '<div class="info-empty">未检测到异常指标</div>';
      return;
    }
    list.innerHTML = abnormal.map((r) => `
      <div class="lab-item abnormal">
        <div class="lab-info">
          <span class="lab-name">${r.item}</span>
          <span class="lab-value">${r.value}${r.unit || ''}</span>
          <span class="lab-flag">↑异常</span>
        </div>
        ${r.reference ? `<div class="lab-ref">参考值: ${r.reference}</div>` : ''}
      </div>
    `).join('');
  }

  function bindInsertButtons(container) {
    container.querySelectorAll('.insert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text') || btn.dataset.text;
        if (text) {
          sendToContent({ type: 'INSERT_TEXT', text });
        }
      });
    });
  }

  function renderPatientSummary() {
    renderPatientBasic();
    renderDiagnosis();
    renderMedications();
    renderLabResults();
    
    const archive = getCurrentArchive();
    const statusEl = $('archiveStatus');
    const statusText = $('archiveStatusText');
    if (archive && archive.latest) {
      statusEl.style.display = 'block';
      statusText.textContent = `ℹ️ 已保存就诊档案（${archive.versions.length}版），最近更新：${new Date(archive.latest.timestamp).toLocaleString()}`;
    } else {
      statusEl.style.display = 'none';
    }
  }

  function renderClinicNote() {
    const container = $('clinicNotePreview');
    if (!currentPageData || !currentPageData.patient) {
      container.innerHTML = '<div class="info-empty">暂未识别到患者数据，请先点击「重新识别」</div>';
      return;
    }
    const note = buildClinicNote(true);
    container.innerHTML = `
      <pre style="margin:0;padding:12px 14px;font-family:inherit;font-size:12px;line-height:1.7;white-space:pre-wrap;color:#334155;background:var(--bg-secondary);border-radius:6px;">${escapeHtml(note)}</pre>
      <div style="padding:10px 14px;display:flex;gap:8px;border-top:1px solid var(--border-light);">
        <button class="btn-block secondary" style="padding:8px 12px;font-size:12px;" id="refreshClinicNoteBtn">刷新</button>
        <button class="btn-block primary" style="padding:8px 12px;font-size:12px;" id="copyClinicNoteBtn">复制脱敏小结</button>
      </div>
    `;
    $('refreshClinicNoteBtn').onclick = renderClinicNote;
    $('copyClinicNoteBtn').onclick = () => {
      const text = buildClinicNote(true);
      sendToContent({ type: 'COPY_TEXT', text });
      addHistory('复制门诊小结', '脱敏门诊小结');
    };
  }

  function getPatientDraft() {
    const key = getPatientKey();
    if (!key) return null;
    return state.patientDrafts[key] || null;
  }

  async function savePatientDraft(type, content) {
    const key = getPatientKey();
    if (!key) { toast('请先识别到患者信息', 'warning'); return false; }
    
    const draft = state.patientDrafts[key] || {
      patient: { ...(currentPageData && currentPageData.patient) },
      updatedAt: new Date().toISOString()
    };
    draft[type] = content;
    draft.updatedAt = new Date().toISOString();
    draft.patient = { ...(currentPageData && currentPageData.patient) };
    
    state.patientDrafts[key] = draft;
    await saveStorage(STORAGE_KEYS.PATIENT_DRAFTS, state.patientDrafts);
    return true;
  }

  function loadPatientDraftToUI() {
    const draft = getPatientDraft();
    if (!draft) return;
    
    if (draft.order) $('orderEditor').value = draft.order;
    if (draft.followup) $('followupEditor').value = draft.followup;
  }

  function buildMergedContent() {
    const parts = [];
    const order = $('orderEditor').value.trim();
    const followup = $('followupEditor').value.trim();
    
    const checks = Array.from(document.querySelectorAll('#panel-checkup input[type="checkbox"]:checked'))
      .map(c => c.value);
    
    if (order) parts.push(order);
    
    if (checks.length > 0) {
      parts.push(`【检查建议】\n建议完善：${checks.join('、')}`);
    }
    
    if (followup) parts.push(followup);
    
    return parts.join('\n\n');
  }

  function showMergeModal() {
    const merged = buildMergedContent();
    if (!merged.trim()) {
      toast('没有可合并的内容', 'warning');
      return;
    }
    
    const modal = $('modal');
    $('modalTitle').textContent = '合并内容预览';
    $('modalBody').innerHTML = `
      <div style="padding:4px 2px;">
        <p style="font-size:12px;color:#64748b;margin-bottom:10px;">
          已合并医嘱、检查建议和随访内容，可直接插入或复制：
        </p>
        <pre style="margin:0 0 14px;padding:10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;font-size:12px;line-height:1.6;white-space:pre-wrap;max-height:240px;overflow:auto;color:#1e293b;">${escapeHtml(merged)}</pre>
        <div class="modal-actions">
          <button class="btn-block secondary" id="mergeCancelBtn">取消</button>
          <button class="btn-block secondary" id="mergeCopyBtn">复制文本</button>
          <button class="btn-block primary" id="mergeInsertBtn">插入到编辑器</button>
        </div>
      </div>
    `;
    modal.classList.add('show');
    
    $('mergeCancelBtn').onclick = () => modal.classList.remove('show');
    $('mergeCopyBtn').onclick = () => {
      sendToContent({ type: 'COPY_TEXT', text: merged });
      toast('已复制合并内容', 'success');
      addHistory('复制合并内容', '医嘱+检查+随访');
    };
    $('mergeInsertBtn').onclick = () => {
      sendToContent({ type: 'INSERT_TEXT', text: merged });
      addHistory('插入合并内容', '医嘱+检查+随访');
      modal.classList.remove('show');
    };
  }

  function showPatientDraftsList() {
    const drafts = Object.entries(state.patientDrafts)
      .filter(([, d]) => d && d.patient)
      .sort(([, a], [, b]) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    const modal = $('modal');
    $('modalTitle').textContent = '患者草稿箱';
    $('modalBody').innerHTML = `
      <div style="padding:4px 2px;max-height:360px;overflow:auto;">
        ${drafts.length === 0 ? '<div class="info-empty">暂无患者草稿</div>' : drafts.map(([key, d]) => {
          const p = d.patient || {};
          return `
            <div class="list-item" style="margin-bottom:6px;border:1px solid var(--border);border-radius:8px;padding:10px;">
              <div class="item-content" style="flex:1;">
                <div class="item-text" style="font-weight:500;">
                  ${escapeHtml(p.name || '未命名患者')}
                  ${p.gender ? ` · ${escapeHtml(p.gender)}` : ''}
                  ${p.age ? ` · ${escapeHtml(p.age)}岁` : ''}
                </div>
                <div class="item-meta" style="font-size:11px;color:#94a3b8;">
                  更新于 ${new Date(d.updatedAt).toLocaleString()}
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:4px;">
                  ${d.order ? '📝 医嘱 ' : ''}
                  ${d.followup ? '📅 随访 ' : ''}
                </div>
              </div>
              <button class="mini-btn" data-load-draft="${key}">载入</button>
            </div>
          `;
        }).join('')}
      </div>
      <div class="modal-actions" style="margin-top:12px;">
        <button class="btn-block secondary" id="draftCloseBtn">关闭</button>
      </div>
    `;
    modal.classList.add('show');
    
    $('draftCloseBtn').onclick = () => modal.classList.remove('show');
    
    document.querySelectorAll('[data-load-draft]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.loadDraft;
        const d = state.patientDrafts[key];
        if (d) {
          if (d.order) $('orderEditor').value = d.order;
          if (d.followup) $('followupEditor').value = d.followup;
          toast('已载入患者草稿', 'success');
          modal.classList.remove('show');
          switchToPanel('order');
        }
      });
    });
  }

  function setupOrderPanel() {
    $('orderEditor').addEventListener('input', () => {});

    document.querySelectorAll('[data-order]').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-order');
        const ed = $('orderEditor');
        ed.value = (ed.value ? ed.value + '\n' : '') + text;
        addHistory('医嘱插入', text);
      });
    });

    $('insertOrderBtn').addEventListener('click', () => {
      const text = $('orderEditor').value;
      if (!text.trim()) { toast('请输入医嘱内容', 'warning'); return; }
      sendToContent({ type: 'INSERT_TEXT', text });
      addHistory('医嘱插入', text.substring(0, 50));
    });

    $('copyOrderBtn').addEventListener('click', () => {
      const text = $('orderEditor').value;
      if (!text.trim()) { toast('无内容可复制', 'warning'); return; }
      sendToContent({ type: 'COPY_TEXT', text });
      addHistory('复制医嘱', text.substring(0, 50));
      toast('已复制到剪贴板', 'success');
    });

    $('clearOrderBtn').addEventListener('click', () => {
      $('orderEditor').value = '';
    });

    $('savePatientDraftBtn').addEventListener('click', async () => {
      const text = $('orderEditor').value;
      const ok = await savePatientDraft('order', text);
      if (ok) {
        toast('已保存到患者草稿', 'success');
        addHistory('保存患者草稿', '医嘱');
        updatePatientDraftHint();
      }
    });

    $('draftListBtn').addEventListener('click', showPatientDraftsList);
    $('mergeAllBtn').addEventListener('click', showMergeModal);

    renderDrafts();
    updatePatientDraftHint();
  }

  function updatePatientDraftHint() {
    const hint = $('patientDraftHint');
    const nameEl = $('currentPatientName');
    const draft = getPatientDraft();
    const p = (currentPageData && currentPageData.patient) || {};
    
    if (p.name || draft) {
      hint.style.display = 'block';
      nameEl.textContent = p.name || '当前患者';
    } else {
      hint.style.display = 'none';
    }
  }

  function renderDrafts() {
    const list = $('draftList');
    $('draftCount').textContent = state.orderDrafts.length;
    if (state.orderDrafts.length === 0) {
      list.innerHTML = '<div class="info-empty">暂无保存的草稿</div>';
      return;
    }
    list.innerHTML = state.orderDrafts.map(d => `
      <div class="list-item">
        <div class="item-content">
          <div class="item-text">${d.content.substring(0, 40)}${d.content.length > 40 ? '...' : ''}</div>
          <div class="item-meta">${new Date(d.createdAt).toLocaleString()}</div>
        </div>
        <div class="item-actions">
          <button class="mini-btn load-draft" data-id="${d.id}" title="加载">加载</button>
          <button class="mini-btn danger del-draft" data-id="${d.id}" title="删除">删</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.load-draft').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = state.orderDrafts.find(x => x.id === btn.dataset.id);
        if (d) { $('orderEditor').value = d.content; toast('已加载草稿', 'success'); }
      });
    });

    list.querySelectorAll('.del-draft').forEach(btn => {
      btn.addEventListener('click', async () => {
        state.orderDrafts = state.orderDrafts.filter(x => x.id !== btn.dataset.id);
        await saveStorage(STORAGE_KEYS.ORDER_DRAFTS, state.orderDrafts);
        renderDrafts();
      });
    });
  }

  function setupCheckupPanel() {
    $('genCheckupNoteBtn').addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('#panel-checkup input[type="checkbox"]:checked'))
        .map(c => c.value);
      if (checked.length === 0) { toast('请选择检查项目', 'warning'); return; }
      const text = `【检查建议】\n建议完善以下检查：\n${checked.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n待检查结果回报后进一步评估。`;
      $('orderEditor').value = ($('orderEditor').value ? $('orderEditor').value + '\n\n' : '') + text;
      document.querySelector('.tab[data-tab="order"]').click();
      addHistory('检查建议', checked.join(','));
      toast('已生成检查建议', 'success');
    });

    $('copyCheckupBtn').addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('#panel-checkup input[type="checkbox"]:checked'))
        .map(c => c.value);
      if (checked.length === 0) { toast('请选择检查项目', 'warning'); return; }
      const text = checked.join('、');
      sendToContent({ type: 'COPY_TEXT', text });
      toast('已复制', 'success');
    });

    updateMissingChecks();
  }

  function updateMissingChecks() {
    const list = $('missingChecksList');
    const suggestions = [];

    const diagnosis = (currentPageData && currentPageData.diagnosis) || [];
    const diagText = diagnosis.map(d => d.text).join(' ');
    const labs = (currentPageData && currentPageData.labResults) || [];
    const labItems = labs.map(l => l.item);

    if (/高血压|血压高/.test(diagText)) {
      if (!labItems.some(i => /血脂|胆固醇/.test(i))) suggestions.push('血脂四项');
      if (!labItems.some(i => /心电图/.test(i))) suggestions.push('心电图');
      if (!labItems.some(i => /肾功|肌酐/.test(i))) suggestions.push('肾功能');
    }
    if (/糖尿病|血糖高/.test(diagText)) {
      if (!labItems.some(i => /糖化血红蛋白|HbA1c/i.test(i))) suggestions.push('糖化血红蛋白');
      if (!labItems.some(i => /尿微量白蛋白/.test(i))) suggestions.push('尿微量白蛋白');
      if (!labItems.some(i => /眼底/.test(i))) suggestions.push('眼底检查');
    }
    if (/冠心病|心绞痛|心肌|胸闷/.test(diagText)) {
      if (!labItems.some(i => /心电图/.test(i))) suggestions.push('心电图');
      if (!labItems.some(i => /肌钙蛋白|心肌酶/.test(i))) suggestions.push('心肌酶谱');
    }
    if (/发热|感染|感冒|炎症/.test(diagText)) {
      if (!labItems.some(i => /血常规|白细胞/.test(i))) suggestions.push('血常规+CRP');
    }

    if (suggestions.length === 0) {
      list.innerHTML = '<div class="info-empty">未识别到缺失项</div>';
      return;
    }
    list.innerHTML = suggestions.map(s => `
      <div class="list-item warning">
        <span class="item-icon">⚠️</span>
        <div class="item-content">
          <div class="item-text">建议补充：${s}</div>
        </div>
      </div>
    `).join('');
  }

  function setupFollowupPanel() {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    $('followupDate').value = today.toISOString().split('T')[0];

    $('insertFollowupBtn').addEventListener('click', () => {
      const text = $('followupEditor').value;
      if (!text.trim()) { toast('请输入或选择随访内容', 'warning'); return; }
      sendToContent({ type: 'INSERT_TEXT', text });
      addHistory('随访插入', text.substring(0, 50));
    });

    $('copyFollowupBtn').addEventListener('click', () => {
      const text = $('followupEditor').value;
      if (!text.trim()) { toast('无内容可复制', 'warning'); return; }
      sendToContent({ type: 'COPY_TEXT', text });
      addHistory('复制随访', text.substring(0, 50));
      toast('结构化内容已复制', 'success');
    });

    $('saveFollowupDraftBtn').addEventListener('click', async () => {
      const text = $('followupEditor').value;
      const ok = await savePatientDraft('followup', text);
      if (ok) {
        toast('随访已保存到患者草稿', 'success');
        addHistory('保存患者草稿', '随访');
      }
    });

    $('addTemplateBtn').addEventListener('click', () => showTemplateModal());

    renderTemplates();
    bindFollowupInputs();
  }

  function bindFollowupInputs() {
    const inputs = ['followupDate', ...Array.from(document.querySelectorAll('#panel-followup input[type="checkbox"]')).map(c => c.id || c.value)];
    const updateEditor = () => {
      const date = $('followupDate').value;
      const tips = Array.from(document.querySelectorAll('#panel-followup input[type="checkbox"]:checked')).map(c => c.value);
      if (!$('followupEditor').value || $('followupEditor').dataset.auto === '1') {
        let content = `【复诊注意事项】\n复诊时间：${date || '____年__月__日'}\n`;
        if (tips.length) {
          content += `\n就诊准备：\n${tips.map(t => `☐ ${t}`).join('\n')}\n`;
        }
        content += `\n日常注意：\n- 规律作息，避免劳累\n- 遵医嘱按时服药\n- 如有不适及时就诊`;
        $('followupEditor').value = content;
        $('followupEditor').dataset.auto = '1';
      }
    };
    document.querySelector('#panel-followup').addEventListener('change', updateEditor);
    $('followupDate').addEventListener('change', updateEditor);
    updateEditor();
  }

  function renderTemplates() {
    const list = $('templateList');
    const allTemplates = [...state.followupTemplates, ...state.userTemplates.filter(t => t.type === 'followup')];
    if (allTemplates.length === 0) {
      list.innerHTML = '<div class="info-empty">暂无模板</div>';
      return;
    }
    list.innerHTML = allTemplates.map(t => `
      <div class="template-card">
        <div class="template-header">
          <span class="template-name">${t.name}</span>
          ${t.user ? `<span class="template-tag">自定义</span>` : `<span class="template-tag sys">系统</span>`}
        </div>
        <div class="template-preview">${t.content.substring(0, 60)}${t.content.length > 60 ? '...' : ''}</div>
        <div class="template-actions">
          <button class="mini-btn primary use-tpl" data-id="${t.id}">使用</button>
          ${t.user ? `<button class="mini-btn danger del-tpl" data-id="${t.id}">删除</button>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.use-tpl').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = allTemplates.find(x => x.id === btn.dataset.id);
        if (t) {
          $('followupEditor').value = t.content;
          $('followupEditor').dataset.auto = '0';
          toast('已加载模板', 'success');
        }
      });
    });

    list.querySelectorAll('.del-tpl').forEach(btn => {
      btn.addEventListener('click', async () => {
        state.userTemplates = state.userTemplates.filter(t => t.id !== btn.dataset.id);
        await saveStorage(STORAGE_KEYS.USER_TEMPLATES, state.userTemplates);
        renderTemplates();
      });
    });
  }

  function showTemplateModal(editData = null) {
    const modal = $('modal');
    $('modalTitle').textContent = editData ? '编辑模板' : '新建随访模板';
    $('modalBody').innerHTML = `
      <div class="form-row">
        <label>模板名称</label>
        <input type="text" id="tplNameInput" value="${editData ? editData.name : ''}" placeholder="如：高血压随访">
      </div>
      <div class="form-row">
        <label>模板内容</label>
        <textarea id="tplContentInput" rows="8" placeholder="输入随访内容...">${editData ? editData.content : ''}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-block secondary" id="tplCancelBtn">取消</button>
        <button class="btn-block primary" id="tplSaveBtn">保存</button>
      </div>
    `;
    modal.classList.add('show');

    $('tplCancelBtn').onclick = () => modal.classList.remove('show');
    $('tplSaveBtn').onclick = async () => {
      const name = $('tplNameInput').value.trim();
      const content = $('tplContentInput').value.trim();
      if (!name || !content) { toast('请填写完整', 'warning'); return; }
      if (editData) {
        const t = state.userTemplates.find(x => x.id === editData.id);
        if (t) { t.name = name; t.content = content; }
      } else {
        state.userTemplates.push({
          id: Date.now().toString(),
          name, content,
          type: 'followup',
          user: true,
          createdAt: new Date().toISOString()
        });
      }
      await saveStorage(STORAGE_KEYS.USER_TEMPLATES, state.userTemplates);
      renderTemplates();
      modal.classList.remove('show');
      toast('已保存', 'success');
    };
  }

  function setupSnippetPanel() {
    const deptSel = $('deptSelector');
    deptSel.value = state.department;
    $('currentDeptLabel').textContent = state.department;

    deptSel.addEventListener('change', async () => {
      state.department = deptSel.value;
      $('currentDeptLabel').textContent = state.department;
      await saveStorage(STORAGE_KEYS.DEPARTMENT, state.department);
      renderSnippets();
      addHistory('切换科室', state.department);
    });

    $('snippetSearch').addEventListener('input', renderSnippets);

    $('addUserSnippetBtn').addEventListener('click', () => showSnippetModal());

    renderSnippets();
    renderUserSnippets();
  }

  function renderSnippets() {
    const list = $('snippetList');
    const dept = state.department;
    const snippets = (state.snippets && state.snippets[dept]) || [];
    const keyword = $('snippetSearch').value.trim().toLowerCase();
    const filtered = keyword ? snippets.filter(s =>
      s.name.toLowerCase().includes(keyword) || s.content.toLowerCase().includes(keyword)
    ) : snippets;

    if (filtered.length === 0) {
      list.innerHTML = '<div class="info-empty">该科室暂无片段</div>';
      return;
    }
    list.innerHTML = filtered.map(s => `
      <div class="snippet-card">
        <div class="snippet-header">
          <span class="snippet-name">${s.name}</span>
        </div>
        <div class="snippet-preview">${s.content.substring(0, 50)}${s.content.length > 50 ? '...' : ''}</div>
        <div class="snippet-actions">
          <button class="mini-btn primary snippet-insert" data-text="${s.content.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}">插入</button>
          <button class="mini-btn snippet-copy" data-text="${s.content.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}">复制</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.snippet-insert').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = (btn.getAttribute('data-text') || '').replace(/\\n/g, '\n');
        sendToContent({ type: 'INSERT_TEXT', text });
        addHistory('插入片段', text.substring(0, 50));
      });
    });

    list.querySelectorAll('.snippet-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = (btn.getAttribute('data-text') || '').replace(/\\n/g, '\n');
        sendToContent({ type: 'COPY_TEXT', text });
        addHistory('复制片段', text.substring(0, 50));
        toast('已复制', 'success');
      });
    });
  }

  function renderUserSnippets() {
    const list = $('userSnippetList');
    const snippets = state.userTemplates.filter(t => t.type === 'snippet');
    if (snippets.length === 0) {
      list.innerHTML = '<div class="info-empty">暂无自定义模板，点击"新建"添加</div>';
      return;
    }
    list.innerHTML = snippets.map(s => `
      <div class="snippet-card">
        <div class="snippet-header">
          <span class="snippet-name">${s.name}</span>
          <span class="template-tag">个人</span>
        </div>
        <div class="snippet-preview">${s.content.substring(0, 50)}${s.content.length > 50 ? '...' : ''}</div>
        <div class="snippet-actions">
          <button class="mini-btn primary usnippet-insert" data-id="${s.id}">插入</button>
          <button class="mini-btn usnippet-copy" data-id="${s.id}">复制</button>
          <button class="mini-btn usnippet-edit" data-id="${s.id}">编辑</button>
          <button class="mini-btn danger usnippet-del" data-id="${s.id}">删除</button>
        </div>
      </div>
    `).join('');

    const getText = (id) => (state.userTemplates.find(t => t.id === id) || {}).content || '';

    list.querySelectorAll('.usnippet-insert').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = getText(btn.dataset.id);
        if (text) sendToContent({ type: 'INSERT_TEXT', text });
      });
    });
    list.querySelectorAll('.usnippet-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = getText(btn.dataset.id);
        if (text) { sendToContent({ type: 'COPY_TEXT', text }); toast('已复制', 'success'); }
      });
    });
    list.querySelectorAll('.usnippet-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = state.userTemplates.find(x => x.id === btn.dataset.id);
        if (t) showSnippetModal(t);
      });
    });
    list.querySelectorAll('.usnippet-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        state.userTemplates = state.userTemplates.filter(t => t.id !== btn.dataset.id);
        await saveStorage(STORAGE_KEYS.USER_TEMPLATES, state.userTemplates);
        renderUserSnippets();
      });
    });
  }

  function showSnippetModal(editData = null) {
    const modal = $('modal');
    $('modalTitle').textContent = editData ? '编辑片段' : '新建片段';
    $('modalBody').innerHTML = `
      <div class="form-row">
        <label>片段名称</label>
        <input type="text" id="snNameInput" value="${editData ? editData.name : ''}" placeholder="如：一般查体">
      </div>
      <div class="form-row">
        <label>适用科室</label>
        <select id="snDeptInput">
          <option value="通用" ${editData && editData.dept === '通用' ? 'selected' : ''}>通用</option>
          <option value="内科" ${(!editData || editData.dept === '内科') ? 'selected' : ''}>内科</option>
          <option value="外科" ${editData && editData.dept === '外科' ? 'selected' : ''}>外科</option>
          <option value="儿科" ${editData && editData.dept === '儿科' ? 'selected' : ''}>儿科</option>
          <option value="妇产科" ${editData && editData.dept === '妇产科' ? 'selected' : ''}>妇产科</option>
        </select>
      </div>
      <div class="form-row">
        <label>片段内容</label>
        <textarea id="snContentInput" rows="6" placeholder="输入病历片段内容...">${editData ? editData.content : ''}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-block secondary" id="snCancelBtn">取消</button>
        <button class="btn-block primary" id="snSaveBtn">保存</button>
      </div>
    `;
    modal.classList.add('show');

    $('snCancelBtn').onclick = () => modal.classList.remove('show');
    $('snSaveBtn').onclick = async () => {
      const name = $('snNameInput').value.trim();
      const content = $('snContentInput').value.trim();
      const dept = $('snDeptInput').value;
      if (!name || !content) { toast('请填写完整', 'warning'); return; }
      if (editData) {
        const t = state.userTemplates.find(x => x.id === editData.id);
        if (t) { t.name = name; t.content = content; t.dept = dept; }
      } else {
        state.userTemplates.push({
          id: Date.now().toString(),
          name, content, dept,
          type: 'snippet',
          user: true,
          createdAt: new Date().toISOString()
        });
      }
      await saveStorage(STORAGE_KEYS.USER_TEMPLATES, state.userTemplates);
      renderUserSnippets();
      modal.classList.remove('show');
      toast('已保存', 'success');
    };
  }

  function setupHeaderActions() {
    $('refreshBtn').addEventListener('click', () => {
      sendToContent({ type: 'REFRESH_DATA' });
      toast('正在重新识别...', 'info');
    });

    $('captureBtn').addEventListener('click', () => {
      sendToContent({ type: 'CAPTURE_PRIVACY_SCREENSHOT' });
      toast('请选择隐私区域遮挡', 'info');
    });

    $('settingsBtn').addEventListener('click', () => showSettingsModal('settings'));
    $('closeBtn').addEventListener('click', () => {
      sendToContent({ type: 'CLOSE_SIDEBAR' });
    });

    $('modalCloseBtn').addEventListener('click', () => $('modal').classList.remove('show'));
    $('modal').querySelector('.modal-mask').addEventListener('click', () => $('modal').classList.remove('show'));

    if ($('editArchiveBtn')) {
      $('editArchiveBtn').addEventListener('click', showArchiveEditor);
    }
    if ($('genClinicNoteBtn')) {
      $('genClinicNoteBtn').addEventListener('click', renderClinicNote);
    }
  }

  function showSettingsModal(tab = 'settings') {
    const modal = $('modal');
    $('modalTitle').textContent = '设置';
    $('modalBody').innerHTML = `
      <div style="border-bottom:1px solid var(--border);display:flex;">
        <button class="settings-tab ${tab === 'settings' ? 'active' : ''}" data-stab="settings" style="flex:1;padding:10px;border:none;background:transparent;cursor:pointer;font-size:12px;color:${tab === 'settings' ? 'var(--primary)' : 'var(--text-secondary)'};border-bottom:2px solid ${tab === 'settings' ? 'var(--primary)' : 'transparent'};">基础设置</button>
        <button class="settings-tab ${tab === 'history' ? 'active' : ''}" data-stab="history" style="flex:1;padding:10px;border:none;background:transparent;cursor:pointer;font-size:12px;color:${tab === 'history' ? 'var(--primary)' : 'var(--text-secondary)'};border-bottom:2px solid ${tab === 'history' ? 'var(--primary)' : 'transparent'};">操作历史</button>
        <button class="settings-tab ${tab === 'io' ? 'active' : ''}" data-stab="io" style="flex:1;padding:10px;border:none;background:transparent;cursor:pointer;font-size:12px;color:${tab === 'io' ? 'var(--primary)' : 'var(--text-secondary)'};border-bottom:2px solid ${tab === 'io' ? 'var(--primary)' : 'transparent'};">导入导出</button>
      </div>
      <div id="settingsBody"></div>
    `;
    modal.classList.add('show');

    const renderSettings = () => {
      $('settingsBody').innerHTML = `
        <div class="form-row">
          <label>当前科室</label>
          <select id="setDeptInput">
            <option value="内科" ${state.department === '内科' ? 'selected' : ''}>内科</option>
            <option value="外科" ${state.department === '外科' ? 'selected' : ''}>外科</option>
            <option value="儿科" ${state.department === '儿科' ? 'selected' : ''}>儿科</option>
            <option value="妇产科" ${state.department === '妇产科' ? 'selected' : ''}>妇产科</option>
          </select>
        </div>
        <div class="form-row">
          <label>启用站点关键词</label>
          <small class="form-tip">URL 包含以下任一关键词时启用完整功能（每行一个）</small>
          <textarea id="setSitesInput" rows="5"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-block secondary" id="setCancelBtn">关闭</button>
          <button class="btn-block primary" id="setSaveBtn">保存</button>
        </div>
      `;
      chrome.storage.local.get(STORAGE_KEYS.ENABLED_SITES, (d) => {
        $('setSitesInput').value = (d[STORAGE_KEYS.ENABLED_SITES] || []).join('\n');
      });
      $('setCancelBtn').onclick = () => modal.classList.remove('show');
      $('setSaveBtn').onclick = async () => {
        state.department = $('setDeptInput').value;
        $('currentDeptLabel').textContent = state.department;
        $('deptSelector').value = state.department;
        await saveStorage(STORAGE_KEYS.DEPARTMENT, state.department);
        const sites = $('setSitesInput').value.split('\n').map(s => s.trim()).filter(Boolean);
        await saveStorage(STORAGE_KEYS.ENABLED_SITES, sites);
        renderSnippets();
        
        sendToContent({ type: 'REFRESH_SITE_STATUS' });
        
        modal.classList.remove('show');
        toast('设置已保存', 'success');
      };
    };

    const renderHistory = () => {
      $('settingsBody').innerHTML = `
        <div class="form-row">
          <label>操作历史（最近 ${state.history.length} 条）</label>
          <div class="history-list" style="max-height:240px;">
            ${state.history.slice(0, 50).map(h => `
              <div class="history-item">
                <span class="history-action">${escapeHtml(h.action)}</span>
                <span class="history-detail">${escapeHtml(h.detail || '')}</span>
                <span class="history-time">${new Date(h.timestamp).toLocaleString()}</span>
              </div>
            `).join('') || '<div class="info-empty">暂无记录</div>'}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-block secondary" id="clearHistoryBtn" style="color:var(--danger);">清空历史</button>
          <button class="btn-block primary" id="historyCloseBtn">关闭</button>
        </div>
      `;
      $('historyCloseBtn').onclick = () => modal.classList.remove('show');
      $('clearHistoryBtn').onclick = async () => {
        state.history = [];
        await saveStorage(STORAGE_KEYS.HISTORY, []);
        toast('历史记录已清空', 'success');
        renderHistory();
      };
    };

    const renderIO = () => {
      $('settingsBody').innerHTML = `
        <div class="form-row">
          <label>数据导出</label>
          <small class="form-tip">导出个人模板、科室配置、片段库、医嘱草稿、随访模板等数据</small>
          <button class="btn-block primary" id="exportBtn" style="margin-top:6px;">📤 导出为 JSON 文件</button>
        </div>
        <div class="form-row">
          <label>数据导入</label>
          <small class="form-tip">选择之前导出的 JSON 文件进行恢复（将合并并覆盖同 ID 的项目）</small>
          <input type="file" id="importFile" accept=".json,application/json" style="margin-top:6px;width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:12px;">
        </div>
        <div id="ioStatus" style="padding:0 14px 10px;font-size:12px;color:var(--text-muted);"></div>
        <div class="modal-actions">
          <button class="btn-block secondary" id="ioCloseBtn">关闭</button>
        </div>
      `;
      $('ioCloseBtn').onclick = () => modal.classList.remove('show');
      $('exportBtn').onclick = async () => {
        const resp = await sendToBackground({ type: 'GET_ALL_STORAGE' });
        if (!resp || !resp.success) { toast('导出失败', 'danger'); return; }
        const d = resp.data;
        const exportData = {
          version: 2,
          exportedAt: new Date().toISOString(),
          department: d[STORAGE_KEYS.DEPARTMENT],
          snippets: d[STORAGE_KEYS.SNIPPETS],
          userTemplates: d[STORAGE_KEYS.USER_TEMPLATES],
          orderDrafts: d[STORAGE_KEYS.ORDER_DRAFTS],
          followupTemplates: d[STORAGE_KEYS.FOLLOWUP_TEMPLATES],
          enabledSites: d[STORAGE_KEYS.ENABLED_SITES],
          patientArchives: d[STORAGE_KEYS.PATIENT_ARCHIVES],
          patientDrafts: d[STORAGE_KEYS.PATIENT_DRAFTS]
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `智慧医疗助手配置_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addHistory('导出数据', '配置导出为JSON');
        toast('已导出到下载目录', 'success');
      };
      $('importFile').onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data || typeof data !== 'object') throw new Error('文件格式错误');
            $('ioStatus').textContent = '正在导入...';
            let merged = 0, added = 0;

            if (data.department) {
              state.department = data.department;
              await saveStorage(STORAGE_KEYS.DEPARTMENT, data.department);
              $('currentDeptLabel').textContent = data.department;
              $('deptSelector').value = data.department;
              merged++;
            }
            if (data.enabledSites && Array.isArray(data.enabledSites)) {
              await saveStorage(STORAGE_KEYS.ENABLED_SITES, data.enabledSites);
              merged++;
            }
            if (data.snippets && typeof data.snippets === 'object') {
              state.snippets = Object.assign({}, state.snippets || {}, data.snippets);
              await saveStorage(STORAGE_KEYS.SNIPPETS, state.snippets);
              renderSnippets();
              added += Object.keys(data.snippets).length;
            }
            if (data.userTemplates && Array.isArray(data.userTemplates)) {
              const existingIds = new Set((state.userTemplates || []).map(t => t.id));
              data.userTemplates.forEach(t => {
                if (existingIds.has(t.id)) {
                  state.userTemplates = state.userTemplates.map(x => x.id === t.id ? t : x);
                  merged++;
                } else {
                  state.userTemplates.push(t);
                  added++;
                }
              });
              await saveStorage(STORAGE_KEYS.USER_TEMPLATES, state.userTemplates);
              renderUserSnippets();
              renderTemplates();
            }
            if (data.orderDrafts && Array.isArray(data.orderDrafts)) {
              const existingIds = new Set((state.orderDrafts || []).map(t => t.id));
              data.orderDrafts.forEach(t => {
                if (!existingIds.has(t.id)) {
                  state.orderDrafts.push(t);
                  added++;
                }
              });
              state.orderDrafts = state.orderDrafts.slice(0, 50);
              await saveStorage(STORAGE_KEYS.ORDER_DRAFTS, state.orderDrafts);
              renderDrafts();
            }
            if (data.followupTemplates && Array.isArray(data.followupTemplates)) {
              state.followupTemplates = data.followupTemplates;
              await saveStorage(STORAGE_KEYS.FOLLOWUP_TEMPLATES, state.followupTemplates);
              renderTemplates();
              merged++;
            }
            if (data.patientArchives && typeof data.patientArchives === 'object') {
              state.patientArchives = Object.assign({}, state.patientArchives || {}, data.patientArchives);
              await saveStorage(STORAGE_KEYS.PATIENT_ARCHIVES, state.patientArchives);
              added += Object.keys(data.patientArchives).length;
            }
            if (data.patientDrafts && typeof data.patientDrafts === 'object') {
              state.patientDrafts = Object.assign({}, state.patientDrafts || {}, data.patientDrafts);
              await saveStorage(STORAGE_KEYS.PATIENT_DRAFTS, state.patientDrafts);
              added += Object.keys(data.patientDrafts).length;
            }
            $('ioStatus').innerHTML = `<span style="color:var(--success);">✅ 导入完成：更新 ${merged} 项，新增 ${added} 项</span>`;
            addHistory('导入数据', `更新${merged}项/新增${added}项`);
            setTimeout(() => { $('ioStatus').textContent = ''; }, 4000);
          } catch (err) {
            $('ioStatus').innerHTML = `<span style="color:var(--danger);">❌ 导入失败：${err.message || '文件无效'}</span>`;
          }
        };
        reader.readAsText(file);
      };
    };

    const switchSettingsTab = (t) => {
      modal.querySelectorAll('.settings-tab').forEach(el => {
        const active = el.dataset.stab === t;
        el.style.color = active ? 'var(--primary)' : 'var(--text-secondary)';
        el.style.borderBottom = active ? '2px solid var(--primary)' : '2px solid transparent';
      });
      if (t === 'settings') renderSettings();
      else if (t === 'history') renderHistory();
      else if (t === 'io') renderIO();
    };

    modal.querySelectorAll('.settings-tab').forEach(el => {
      el.onclick = () => switchSettingsTab(el.dataset.stab);
    });

    switchSettingsTab(tab);

    $('modalCloseBtn').onclick = () => modal.classList.remove('show');
    modal.querySelector('.modal-mask').onclick = () => modal.classList.remove('show');
  }

  function showEditBasicModal() {
    const modal = $('modal');
    const p = (currentPageData && currentPageData.patient) || {};
    $('modalTitle').textContent = '编辑患者信息';
    $('modalBody').innerHTML = `
      <div class="form-row"><label>姓名</label><input id="eb_name" value="${p.name || ''}"></div>
      <div class="form-row"><label>性别</label><input id="eb_gender" value="${p.gender || ''}"></div>
      <div class="form-row"><label>年龄</label><input id="eb_age" value="${p.age || ''}"></div>
      <div class="form-row"><label>科室</label><input id="eb_department" value="${p.department || ''}"></div>
      <div class="form-row"><label>医生</label><input id="eb_doctor" value="${p.doctor || ''}"></div>
      <div class="form-row"><label>就诊日期</label><input id="eb_visitDate" value="${p.visitDate || ''}"></div>
      <div class="modal-actions">
        <button class="btn-block secondary" id="ebCancelBtn">取消</button>
        <button class="btn-block primary" id="ebSaveBtn">保存</button>
      </div>
    `;
    modal.classList.add('show');
    $('ebCancelBtn').onclick = () => modal.classList.remove('show');
    $('ebSaveBtn').onclick = () => {
      if (!currentPageData) currentPageData = {};
      if (!currentPageData.patient) currentPageData.patient = {};
      ['name', 'gender', 'age', 'department', 'doctor', 'visitDate'].forEach(k => {
        currentPageData.patient[k] = $(`eb_${k}`).value;
      });
      renderPatientBasic();
      modal.classList.remove('show');
      toast('已保存', 'success');
    };
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'med-assist-content') return;

    switch (msg.type) {
      case 'PAGE_DATA':
        currentPageData = msg.data;
        renderPatientSummary();
        updateMissingChecks();
        if (typeof updatePatientDraftHint === 'function') {
          updatePatientDraftHint();
        }
        const key = getPatientKey ? getPatientKey() : null;
        if (key && state.patientDrafts && state.patientDrafts[key]) {
          const d = state.patientDrafts[key];
          const hasContent = (d.order && d.order.trim()) || (d.followup && d.followup.trim());
          if (hasContent) {
            const name = (d.patient && d.patient.name) || '当前患者';
            setTimeout(() => {
              toast(`发现 ${name} 的历史草稿，可在「患者草稿」中载入`, 'info');
            }, 800);
          }
        }
        break;
      case 'COPY_SUCCESS':
        toast('已复制到剪贴板', 'success');
        break;
      case 'COPY_FAILED':
        toast('复制失败，请手动复制', 'danger');
        break;
      case 'SCREENSHOT_SUCCESS':
        toast('截图已保存', 'success');
        break;
      case 'OPEN_HISTORY':
        showSettingsModal('history');
        break;
      case 'OPEN_SETTINGS':
        showSettingsModal('settings');
        break;
      case 'SIDEBAR_OPENED':
        isSiteEnabled = msg.siteEnabled !== false;
        updateSiteRestrictionUI();
        if (msg.panel) {
          setTimeout(() => switchToPanel(msg.panel), 50);
        }
        if (msg.modal) {
          setTimeout(() => {
            if (msg.modal === 'HISTORY') showSettingsModal('history');
            else if (msg.modal === 'SETTINGS') showSettingsModal('settings');
          }, 100);
        }
        break;
      case 'SWITCH_PANEL':
        switchToPanel(msg.panel);
        break;
      case 'INSERT_RESULT':
        if (msg.success) {
          toast('已插入到编辑器', 'success');
        } else {
          if (msg.reason === 'no_editable') {
            showInsertFallbackModal(msg.fallbackText || '');
          } else {
            toast('插入失败，已复制到剪贴板', 'warning');
            if (msg.fallbackText) sendToContent({ type: 'COPY_TEXT', text: msg.fallbackText });
          }
        }
        break;
      case 'EDITOR_STATUS':
        isSiteEnabled = !!msg.siteEnabled;
        updateSiteRestrictionUI();
        break;
      case 'SITE_STATUS_UPDATED':
        isSiteEnabled = !!msg.siteEnabled;
        updateSiteRestrictionUI();
        if (isSiteEnabled) {
          sendToContent({ type: 'REFRESH_DATA' });
        }
        break;
    }
  });

  async function init() {
    await loadState();
    setupTabs();
    setupHeaderActions();
    setupOrderPanel();
    setupCheckupPanel();
    setupFollowupPanel();
    setupSnippetPanel();
    $('currentDeptLabel').textContent = state.department;
    $('deptSelector').value = state.department;
    sendToContent({ type: 'QUERY_EDITOR_STATUS' });
    sendToContent({ type: 'REFRESH_DATA' });
    updateSiteRestrictionUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
