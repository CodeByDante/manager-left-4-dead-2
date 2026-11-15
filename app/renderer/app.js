const defaultPlaceholder = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='40' viewBox='0 0 64 40'><rect width='64' height='40' fill='%23111116'/><text x='32' y='24' fill='%23555566' font-size='12' text-anchor='middle' font-family='sans-serif'>VPK</text></svg>";
let realWorkshopMods = [];
let realGameinfoMods = [];
async function openLocalFolder(targetPath) {
  if (!targetPath) return;
  await window.api.openFileLocation(targetPath);
}
async function toggleModFile(mod) {
  await window.api.toggleModStatus({
    filename: mod.filename,
    isEnabled: mod.isEnabled
  });
  loadModsData();
}
function openWorkshopPage(id) {
  const url = 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + id;
  window.api.openExternalUrl(url);
}
let currentGameinfoData = null;
function getAvailableWorkshopMods(rawList) {
  if (!currentGameinfoData) return rawList;
  const convertedMods = currentGameinfoData.convertedMods || [];
  const customMods = currentGameinfoData.customMods || [];
  const activeVersusMods = [...convertedMods, ...customMods];
  const convertedIds = new Set(activeVersusMods.map(m => m.workshopId || (m.name ? m.name.match(/\d{5,}/)?.[0] : null)).filter(Boolean));
  return rawList.filter(w => {
    if (convertedIds.has(w.id)) return false;
    if (activeVersusMods.some(v => {
      if (!v) return false;
      if (v.workshopId && v.workshopId === w.id) return true;
      if (v.name) {
        const vLower = v.name.toLowerCase();
        const wIdLower = (w.id || '').toLowerCase();
        const wTitleLower = (w.title || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const wFileLower = (w.filename || '').toLowerCase();
        if (wIdLower && vLower.includes(wIdLower)) return true;
        if (wFileLower && vLower === wFileLower) return true;
        if (wTitleLower && vLower.includes(wTitleLower)) return true;
      }
      if (v.title && w.title && v.title.trim().toLowerCase() === w.title.trim().toLowerCase()) return true;
      return false;
    })) return false;
    return true;
  });
}
async function loadModsData() {
  try {
    const result = await window.api.getWorkshopMods();
    realWorkshopMods = (result.mods || []).map(m => ({
      id: m.id,
      title: m.title,
      desc: m.description || '',
      img: m.thumbnailUrl || defaultPlaceholder,
      filename: m.filename,
      fullPath: m.fullPath,
      size: m.sizeFormatted,
      sizeBytes: m.sizeBytes,
      enabled: m.isEnabled,
      tags: m.tags || [],
      requiredItems: m.requiredItems || []
    }));
    filterMods();
    if (currentGameinfoData) renderGameinfo(currentGameinfoData);
  } catch (error) {
    realWorkshopMods = [];
    filterMods();
    showOperationError(error);
  }
}
function highlightSyntax(text) {
  if (!text) return '';
  let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = escaped.split('\n');
  const processedLines = lines.map(line => {
    let inQuote = false;
    let commentStartIdx = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (line[i] === '/' && line[i + 1] === '/' || line[i] === '#') {
          commentStartIdx = i;
          break;
        }
      }
    }
    let codePart = commentStartIdx !== -1 ? line.substring(0, commentStartIdx) : line;
    let commentPart = commentStartIdx !== -1 ? line.substring(commentStartIdx) : '';
    if (commentPart) {
      commentPart = `<span class="hl-comment">${commentPart}</span>`;
    }
    return codePart + commentPart;
  });
  return processedLines.join('\n') + '\n';
}
function onEditorInput(textareaElem, highlightId) {
  const highlightElem = document.getElementById(highlightId);
  if (highlightElem && textareaElem) {
    highlightElem.innerHTML = highlightSyntax(textareaElem.value);
    highlightElem.scrollTop = textareaElem.scrollTop;
    highlightElem.scrollLeft = textareaElem.scrollLeft;
  }
}
function onEditorScroll(textareaElem, highlightId) {
  const highlightElem = document.getElementById(highlightId);
  if (highlightElem && textareaElem) {
    highlightElem.scrollTop = textareaElem.scrollTop;
    highlightElem.scrollLeft = textareaElem.scrollLeft;
  }
}
let currentRawGameinfo = '';
async function openGameinfoViewer() {
  if (!currentRawGameinfo) {
    try {
      let resData = await window.api.getGameinfoMods();
      if (resData && resData.rawContent) {
        currentRawGameinfo = resData.rawContent;
      }
    } catch (e) {}
  }
  switchTab('editor');
}
function closeGameinfoViewer() {
  switchTab('gameinfo');
}
function flashButtonSaved(btnElem) {
  if (!btnElem) return;
  const originalHtml = btnElem.getAttribute('data-original-html') || btnElem.innerHTML;
  if (!btnElem.getAttribute('data-original-html')) {
    btnElem.setAttribute('data-original-html', originalHtml);
  }
  btnElem.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" style="vertical-align: -1px; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg><span style="color: #34d399; font-weight: 600;">¡Guardado!</span>`;
  btnElem.style.borderColor = '#10b981';
  btnElem.style.background = '#0a1a12';
  setTimeout(() => {
    btnElem.innerHTML = originalHtml;
    btnElem.style.borderColor = '';
    btnElem.style.background = '';
  }, 2500);
}
async function loadGameinfoData() {
  try {
    const data = await window.api.getGameinfoMods();
    currentRawGameinfo = data.rawContent || '';
    currentGameinfoData = data;
    renderGameinfo(data);
    filterMods();
  } catch (error) {
    showOperationError(error);
  }
}
function openExternalLink(url) {
  window.api.openExternalUrl(url);
}
async function translateText(text) {
  if (!text) return '';
  try {
    return await window.api.translateText(text);
  } catch (e) {
    return text;
  }
}
const translatedCache = {};
const iconGlobe = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
const iconPower = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px;"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
const iconFolder = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const iconExternal = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
async function handleTranslateMod(modId, rawDesc) {
  const descEl = document.getElementById(`accordion-desc-${modId}`);
  const btnEl = document.getElementById(`btn-translate-${modId}`);
  if (!descEl) return;
  if (translatedCache[modId]) {
    if (btnEl && btnEl.getAttribute('data-state') === 'translated') {
      descEl.innerHTML = cleanSteamDescription(rawDesc);
      btnEl.innerHTML = `${iconGlobe} Traducir a Español`;
      btnEl.setAttribute('data-state', 'original');
    } else {
      descEl.innerHTML = cleanSteamDescription(translatedCache[modId]);
      if (btnEl) {
        btnEl.innerHTML = `${iconGlobe} Ver Original`;
        btnEl.setAttribute('data-state', 'translated');
      }
    }
    return;
  }
  if (btnEl) btnEl.innerHTML = `${iconGlobe} Traduciendo...`;
  let textToTranslate = rawDesc || '';
  const translated = await translateText(textToTranslate);
  translatedCache[modId] = translated;
  descEl.innerHTML = cleanSteamDescription(translated);
  if (btnEl) {
    btnEl.innerHTML = `${iconGlobe} Ver Original`;
    btnEl.setAttribute('data-state', 'translated');
  }
}
function toggleAccordionRow(modId, rawDesc) {
  const mainRow = document.getElementById(`mod-row-${modId}`);
  const detailRow = document.getElementById(`mod-detail-${modId}`);
  if (!mainRow || !detailRow) return;
  const isExpanded = mainRow.classList.contains('expanded');
  document.querySelectorAll('tr.expanded').forEach(r => {
    if (r !== mainRow) r.classList.remove('expanded');
  });
  document.querySelectorAll('tr.expanded-row').forEach(d => {
    if (d !== detailRow) d.style.display = 'none';
  });
  if (isExpanded) {
    mainRow.classList.remove('expanded');
    detailRow.style.display = 'none';
  } else {
    mainRow.classList.add('expanded');
    detailRow.style.display = 'table-row';
    if (rawDesc && !translatedCache[modId]) {
      // Translation remains available through its original button.
    }
  }
}
let currentDialogConfirmCallback = null;
function showCustomDialog(opts) {
  document.getElementById('custom-dialog-requirements-container').style.display = '';
  const modal = document.getElementById('custom-dialog-modal');
  const titleEl = document.getElementById('custom-dialog-title');
  const iconWrapper = document.getElementById('custom-dialog-icon-wrapper');
  const imgEl = document.getElementById('custom-dialog-img');
  const fallbackIcon = document.getElementById('custom-dialog-fallback-icon');
  const modTitleEl = document.getElementById('custom-dialog-mod-title');
  const modIdEl = document.getElementById('custom-dialog-mod-id');
  const folderEl = document.getElementById('custom-dialog-folder');
  const messageBox = document.getElementById('custom-dialog-message-box');
  const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
  const confirmBtn = document.getElementById('custom-dialog-confirm-btn');
  if (!modal) return;
  currentDialogConfirmCallback = opts.onConfirm || null;
  titleEl.innerText = opts.title || 'Notificación';
  modTitleEl.innerText = opts.modTitle || 'Mod de Left 4 Dead 2';
  if (opts.modId) {
    modIdEl.style.display = 'block';
    modIdEl.innerText = `Workshop ID: ${opts.modId}`;
  } else {
    modIdEl.style.display = 'none';
  }
  if (opts.folderName) {
    folderEl.style.display = 'block';
    folderEl.innerText = `Carpeta VPK: ${opts.folderName}`;
  } else {
    folderEl.style.display = 'none';
  }
  messageBox.innerText = opts.message || '';
  if (opts.img) {
    imgEl.src = opts.img;
    imgEl.style.display = 'block';
    fallbackIcon.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    fallbackIcon.style.display = 'block';
  }
  if (opts.type === 'success' || opts.theme === 'green') {
    iconWrapper.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    messageBox.style.borderColor = '#1a3a2a';
    messageBox.style.background = '#0a1a12';
    messageBox.style.color = '#6ee7b7';
  } else if (opts.type === 'confirm') {
    iconWrapper.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    messageBox.style.borderColor = '#3b1717';
    messageBox.style.background = '#1a0a0a';
    messageBox.style.color = '#fca5a5';
  } else if (opts.type === 'error') {
    iconWrapper.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    messageBox.style.borderColor = '#450a0a';
    messageBox.style.background = '#1c0505';
    messageBox.style.color = '#fca5a5';
  } else {
    iconWrapper.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    messageBox.style.borderColor = '#272730';
    messageBox.style.background = '#121217';
    messageBox.style.color = '#d4d4d8';
  }
  if (opts.type === 'confirm') {
    cancelBtn.style.display = 'inline-block';
    cancelBtn.innerText = opts.cancelText || 'Cancelar';
    confirmBtn.innerText = opts.confirmText || 'Confirmar';
    confirmBtn.style.background = opts.confirmBg || '#059669';
    confirmBtn.style.borderColor = opts.confirmBorder || '#10b981';
    confirmBtn.style.color = opts.confirmColor || '#ffffff';
  } else {
    cancelBtn.style.display = 'none';
    confirmBtn.innerText = opts.confirmText || 'Entendido';
    confirmBtn.style.background = '#27272a';
    confirmBtn.style.borderColor = '#3f3f46';
    confirmBtn.style.color = '#fff';
  }
  const reqListEl = document.getElementById('custom-dialog-req-list');
  const reqBadgeEl = document.getElementById('custom-dialog-req-badge');
  if (reqListEl) {
    reqListEl.innerHTML = '';
    const requiredItems = opts.requiredItems || [];
    if (requiredItems.length > 0) {
      let missingCount = 0;
      requiredItems.forEach(req => {
        const isInstalled = req.isInstalled || (currentGameinfoData?.convertedMods || []).some(v => v.workshopId === req.id || v.name && v.name.includes(req.id));
        if (!isInstalled) missingCount++;
        const itemEl = document.createElement('div');
        itemEl.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; background: ${isInstalled ? '#08140e' : '#1a0a0a'}; border: 1px solid ${isInstalled ? '#163824' : '#450a0a'}; border-radius: 6px; padding: 6px 10px; font-size: 11px;`;
        itemEl.innerHTML = `
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                <span style="color: ${isInstalled ? '#34d399' : '#f87171'}; font-weight: 700;">
                  ${isInstalled ? '✓' : '⚠️'}
                </span>
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span style="font-weight: 600; color: ${isInstalled ? '#e4e4e7' : '#fca5a5'};">${req.title || 'Mod ' + req.id}</span>
                  <span style="font-family: monospace; color: #71717a; margin-left: 6px;">(ID: ${req.id})</span>
                </div>
              </div>
              <div>
                ${isInstalled ? `<span style="font-size: 10px; font-family: monospace; color: #34d399; background: #0c2718; padding: 2px 6px; border-radius: 4px; border: 1px solid #164e2b;">Suscrito</span>` : `<button onclick="event.stopPropagation(); openExternalLink('https://steamcommunity.com/sharedfiles/filedetails/?id=${req.id}')" style="font-size: 10px; font-family: monospace; color: #fca5a5; background: #3b1111; padding: 2px 8px; border-radius: 4px; border: 1px solid #631c1c; cursor: pointer;">Falta suscripción (Abrir en Steam ↗)</button>`}
              </div>
            `;
        reqListEl.appendChild(itemEl);
      });
      if (missingCount > 0) {
        reqBadgeEl.innerText = `FALTAN ${missingCount} SUSCRIPCIÓN(ES)`;
        reqBadgeEl.style.cssText = 'font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #f87171; background: #261010; border: 1px solid #521c1c;';
      } else {
        reqBadgeEl.innerText = 'TODOS INSTALADOS';
        reqBadgeEl.style.cssText = 'font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #34d399; background: #0c2718; border: 1px solid #164e2b;';
      }
    } else {
      reqBadgeEl.innerText = 'NINGUNO REQUERIDO';
      reqBadgeEl.style.cssText = 'font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #71717a; background: #121217; border: 1px solid #272730;';
      reqListEl.innerHTML = `<div style="font-size: 11px; color: #71717a; font-family: monospace; background: #08080a; border: 1px solid #18181f; padding: 6px 10px; border-radius: 6px; text-align: center;">✓ Este mod no requiere otros addons adicionales de Steam Workshop.</div>`;
    }
  }
  modal.style.display = 'flex';
}
function closeCustomDialog() {
  const modal = document.getElementById('custom-dialog-modal');
  if (modal) modal.style.display = 'none';
  currentDialogConfirmCallback = null;
}
function onCustomDialogConfirm() {
  const cb = currentDialogConfirmCallback;
  closeCustomDialog();
  if (cb) Promise.resolve().then(cb).catch(showOperationError);
}
function convertWorkshopModToVersus(mod) {
  showCustomDialog({
    type: 'confirm',
    theme: 'green',
    title: '¿Convertir Mod a Versus VPK?',
    modTitle: mod.title,
    modId: mod.id,
    folderName: mod.filename,
    img: mod.img || mod.thumbnailUrl,
    requiredItems: mod.requiredItems || [],
    message: `¿Deseas convertir "${mod.title}" a Versus VPK (pak01_dir.vpk)?`,
    cancelText: 'Cancelar',
    confirmText: 'Confirmar',
    confirmBg: '#059669',
    confirmBorder: '#10b981',
    confirmColor: '#ffffff',
    onConfirm: async () => {
      await executeConvertWorkshopModToVersus(mod);
    }
  });
}
async function executeConvertWorkshopModToVersus(mod) {
  try {
    let res;
    res = await window.api.convertWorkshopModToVersus({
      id: mod.id,
      title: mod.title,
      filename: mod.filename,
      fullPath: mod.fullPath
    });
    if (res && res.success) {
      closeCustomDialog();
      loadModsData();
      loadGameinfoData();
    } else {
      showCustomDialog({
        type: 'error',
        title: 'Error al Convertir Mod',
        modTitle: mod.title,
        modId: mod.id,
        img: mod.img || mod.thumbnailUrl,
        message: 'Error al convertir el mod: ' + (res?.error || 'Desconocido')
      });
    }
  } catch (err) {
    showCustomDialog({
      type: 'error',
      title: 'Error al Convertir Mod',
      modTitle: mod.title,
      modId: mod.id,
      img: mod.img || mod.thumbnailUrl,
      message: 'Error al convertir el mod: ' + err.message
    });
  }
}
function handleChkCellClickWorkshop(tdElem, e) {
  if (e) e.stopPropagation();
  const chk = tdElem ? tdElem.querySelector('.chk-mod-workshop') : null;
  if (chk) {
    if (e && e.target !== chk) {
      chk.checked = !chk.checked;
    }
    updateWorkshopSelectionCount();
  }
}
function handleChkCellClickGameinfo(tdElem, e) {
  if (e) e.stopPropagation();
  const chk = tdElem ? tdElem.querySelector('.chk-mod-gameinfo') : null;
  if (chk) {
    if (e && e.target !== chk) {
      chk.checked = !chk.checked;
    }
    updateGameinfoSelectionCount();
  }
}
let isQuickSelectWorkshop = false;
let isQuickSelectGameinfo = false;
function toggleQuickSelectWorkshop() {
  isQuickSelectWorkshop = !isQuickSelectWorkshop;
  const icon = document.getElementById('icon-quick-select-workshop');
  if (icon) {
    icon.innerHTML = isQuickSelectWorkshop ? '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>';
  }
  const bulkBtn = document.getElementById('btn-bulk-convert');
  if (bulkBtn) {
    bulkBtn.style.display = isQuickSelectWorkshop ? 'inline-flex' : 'none';
  }
  filterMods();
  updateWorkshopSelectionCount();
}
function toggleSelectAllWorkshop(checked) {
  document.querySelectorAll('.chk-mod-workshop').forEach(c => {
    c.checked = checked;
  });
  updateWorkshopSelectionCount();
}
function updateWorkshopSelectionCount() {
  const selected = document.querySelectorAll('.chk-mod-workshop:checked');
  const count = selected.length;
  const txt = document.getElementById('bulk-convert-text');
  if (txt) txt.innerText = `Convertir (${count})`;
}
function toggleQuickSelectGameinfo() {
  isQuickSelectGameinfo = !isQuickSelectGameinfo;
  const icon = document.getElementById('icon-quick-select-gameinfo');
  if (icon) {
    icon.innerHTML = isQuickSelectGameinfo ? '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>';
  }
  const bulkBtn = document.getElementById('btn-bulk-delete-gameinfo');
  if (bulkBtn) {
    bulkBtn.style.display = isQuickSelectGameinfo ? 'inline-flex' : 'none';
  }
  if (currentGameinfoData) renderGameinfo(currentGameinfoData);
  updateGameinfoSelectionCount();
}
function toggleSelectAllGameinfo(checked) {
  document.querySelectorAll('.chk-mod-gameinfo').forEach(c => {
    c.checked = checked;
  });
  updateGameinfoSelectionCount();
}
function updateGameinfoSelectionCount() {
  const selected = document.querySelectorAll('.chk-mod-gameinfo:checked');
  const count = selected.length;
  const txt = document.getElementById('bulk-delete-text-gameinfo');
  if (txt) txt.innerText = `(${count})`;
}
let gameinfoSortField = 'title';
let gameinfoSortOrder = 'asc';
function cycleSortFieldGameinfo() {
  if (gameinfoSortField === 'title') gameinfoSortField = 'size';else if (gameinfoSortField === 'size') gameinfoSortField = 'id';else gameinfoSortField = 'title';
  const textEl = document.getElementById('sort-field-text-gameinfo');
  if (textEl) {
    textEl.innerText = gameinfoSortField === 'title' ? 'Nombre' : gameinfoSortField === 'size' ? 'Tamaño' : 'ID';
  }
  if (currentGameinfoData) renderGameinfo(currentGameinfoData);
}
function toggleSortOrderGameinfo() {
  gameinfoSortOrder = gameinfoSortOrder === 'asc' ? 'desc' : 'asc';
  const textEl = document.getElementById('sort-order-text-gameinfo');
  const iconEl = document.getElementById('sort-order-icon-gameinfo');
  if (textEl) textEl.innerText = gameinfoSortOrder.toUpperCase();
  if (iconEl) {
    iconEl.innerHTML = gameinfoSortOrder === 'asc' ? '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>' : '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>';
  }
  if (currentGameinfoData) renderGameinfo(currentGameinfoData);
}
function filterGameinfoMods() {
  if (currentGameinfoData) renderGameinfo(currentGameinfoData);
}
let currentSortField = 'title';
let currentSortOrder = 'asc';
function cycleSortField() {
  if (currentSortField === 'title') currentSortField = 'size';else if (currentSortField === 'size') currentSortField = 'id';else currentSortField = 'title';
  const fieldText = document.getElementById('sort-field-text');
  if (fieldText) {
    fieldText.innerText = currentSortField === 'title' ? 'Nombre' : currentSortField === 'size' ? 'Tamaño' : 'ID';
  }
  filterMods();
}
function toggleSortOrder() {
  currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  const orderText = document.getElementById('sort-order-text');
  const orderIcon = document.getElementById('sort-order-icon');
  if (orderText) orderText.innerText = currentSortOrder.toUpperCase();
  if (orderIcon) {
    orderIcon.innerHTML = currentSortOrder === 'asc' ? '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>' : '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>';
  }
  filterMods();
}
function setSortFromHeader(field) {
  if (currentSortField === field) {
    toggleSortOrder();
  } else {
    currentSortField = field;
    const fieldText = document.getElementById('sort-field-text');
    if (fieldText) {
      fieldText.innerText = field === 'title' ? 'Nombre' : field === 'size' ? 'Tamaño' : 'ID';
    }
    filterMods();
  }
}
function parseSizeBytes(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.]+)\s*(MB|GB|KB|B)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return num * 1024 * 1024 * 1024;
  if (unit === 'MB') return num * 1024 * 1024;
  if (unit === 'KB') return num * 1024;
  return num;
}
function filterMods() {
  const searchElem = document.getElementById('search-box');
  const query = (searchElem ? searchElem.value : '').toLowerCase().trim();
  const rawDataset = realWorkshopMods;
  const dataset = getAvailableWorkshopMods(rawDataset);
  const filtered = dataset.filter(m => !query || m.id.toLowerCase().includes(query) || m.title.toLowerCase().includes(query) || m.desc && m.desc.toLowerCase().includes(query) || m.tags && m.tags.some(t => t.toLowerCase().includes(query)));
  filtered.sort((a, b) => {
    let valA, valB;
    if (currentSortField === 'title') {
      valA = (a.title || '').toLowerCase();
      valB = (b.title || '').toLowerCase();
      return currentSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (currentSortField === 'size') {
      valA = a.sizeBytes !== undefined ? a.sizeBytes : parseSizeBytes(a.size);
      valB = b.sizeBytes !== undefined ? b.sizeBytes : parseSizeBytes(b.size);
      return currentSortOrder === 'asc' ? valA - valB : valB - valA;
    } else if (currentSortField === 'id') {
      valA = (a.id || '').toLowerCase();
      valB = (b.id || '').toLowerCase();
      return currentSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });
  renderMods(filtered);
}
let currentRawAutoexec = '';
async function loadAutoexecData() {
  try {
    let resData = null;
    resData = await window.api.getAutoexecCfg();
    if (resData && resData.rawContent !== undefined) {
      currentRawAutoexec = resData.rawContent;
      const el = document.getElementById('autoexec-page-textarea');
      if (el) {
        el.value = currentRawAutoexec;
        onEditorInput(el, 'autoexec-page-highlight');
      }
    }
  } catch (err) {
    console.error('Error loading autoexec.cfg:', err);
  }
}
let currentRawAddonconfig = '';
async function loadAddonconfigData() {
  try {
    let resData = null;
    resData = await window.api.getAddonconfigCfg();
    if (resData && resData.rawContent !== undefined) {
      currentRawAddonconfig = resData.rawContent;
      const el = document.getElementById('addonconfig-page-textarea');
      if (el) {
        el.value = currentRawAddonconfig;
        onEditorInput(el, 'addonconfig-page-highlight');
      }
    }
  } catch (err) {
    console.error('Error loading addonconfig.cfg:', err);
  }
}
let currentRawLaunchOptions = '';
let currentLaunchOptionsPath = '';
async function loadLaunchOptionsData() {
  try {
    let resData = null;
    resData = await window.api.getLaunchOptions();
    if (resData) {
      currentRawLaunchOptions = resData.launchOptions || '';
      currentLaunchOptionsPath = resData.vdfPath || 'C:\\Program Files (x86)\\Steam\\userdata';
      const pathEl = document.getElementById('launch-options-path');
      if (pathEl) pathEl.innerText = currentLaunchOptionsPath;
      const textareaEl = document.getElementById('launch-options-textarea');
      if (textareaEl) {
        textareaEl.value = currentRawLaunchOptions;
        onEditorInput(textareaEl, 'launch-options-highlight');
        renderLaunchTags();
      }
    }
  } catch (err) {
    console.error('Error loading launch options:', err);
  }
}
async function saveLaunchOptionsContent(btnElem) {
  const content = document.getElementById('launch-options-textarea').value;
  let res = null;
  res = await window.api.saveLaunchOptions(content);
  if (res && res.success) {
    currentRawLaunchOptions = content;
    if (btnElem) flashButtonSaved(btnElem);
  } else {
    alert('Error al guardar Parámetros de Inicio: ' + (res && res.error || 'Desconocido'));
  }
}
const PRESET_LIBRARY = [{
  flag: '-novid',
  label: 'Omitir Intro'
}, {
  flag: '-console',
  label: 'Consola'
}, {
  flag: '-high',
  label: 'Prioridad Alta CPU'
}, {
  flag: '-nojoy',
  label: 'Sin Joystick'
}, {
  flag: '-lv',
  label: 'Sangre Reducida (Low Violence)'
}, {
  flag: '-insecure',
  label: 'Modo Inseguro / Mods VPK'
}, {
  flag: '-useallavailablecores',
  label: 'Todos Núcleos CPU'
}, {
  flag: '-windowed -noborder',
  label: 'Ventana Sin Bordes'
}];
function renderPresetLibrary(currentRawText) {
  const libContainer = document.getElementById('preset-library-container');
  if (!libContainer) return;
  const availablePresets = PRESET_LIBRARY.filter(item => {
    const flags = item.flag.split(/\s+/);
    return !flags.every(f => currentRawText.includes(f));
  });
  if (availablePresets.length === 0) {
    libContainer.innerHTML = `<span style="font-size: 11px; color: #52525b;" class="font-mono">Todos los parámetros populares ya han sido añadidos.</span>`;
  } else {
    libContainer.innerHTML = availablePresets.map(item => `
          <button class="preset-chip" onclick="toggleLaunchFlag('${item.flag}')"><code>${item.flag}</code> ${item.label}</button>
        `).join('');
  }
}
function removeLaunchTag(tag) {
  const textareaEl = document.getElementById('launch-options-textarea');
  if (!textareaEl) return;
  let val = textareaEl.value;
  val = val.replace(tag, '').replace(/\s+/g, ' ').trim();
  textareaEl.value = val;
  onEditorInput(textareaEl, 'launch-options-highlight');
  renderLaunchTags();
}
function toggleLaunchFlag(flag) {
  const textareaEl = document.getElementById('launch-options-textarea');
  if (!textareaEl) return;
  let val = textareaEl.value;
  if (val.includes(flag)) {
    val = val.replace(flag, '').replace(/\s+/g, ' ').trim();
  } else {
    val = (val.trim() + ' ' + flag).trim();
  }
  textareaEl.value = val;
  onEditorInput(textareaEl, 'launch-options-highlight');
  renderLaunchTags();
}
function switchTab(tab) {
  document.getElementById('tab-workshop')?.classList.toggle('active', tab === 'workshop');
  document.getElementById('tab-gameinfo')?.classList.toggle('active', tab === 'gameinfo');
  document.getElementById('tab-editor')?.classList.toggle('active', tab === 'editor');
  document.getElementById('tab-autoexec')?.classList.toggle('active', tab === 'autoexec');
  document.getElementById('tab-addonconfig')?.classList.toggle('active', tab === 'addonconfig');
  document.getElementById('section-workshop').style.display = tab === 'workshop' ? 'block' : 'none';
  document.getElementById('section-gameinfo').style.display = tab === 'gameinfo' ? 'block' : 'none';
  document.getElementById('section-editor').style.display = tab === 'editor' ? 'block' : 'none';
  document.getElementById('section-autoexec').style.display = tab === 'autoexec' ? 'block' : 'none';
  document.getElementById('section-addonconfig').style.display = tab === 'addonconfig' ? 'block' : 'none';
  if (tab === 'gameinfo') {
    loadGameinfoData();
  } else if (tab === 'editor') {
    const el = document.getElementById('gameinfo-page-textarea');
    if (el) {
      if (!currentRawGameinfo) {
        window.api.getGameinfoMods().then(res => {
          if (res && res.rawContent) currentRawGameinfo = res.rawContent;
          el.value = currentRawGameinfo || '';
          onEditorInput(el, 'gameinfo-page-highlight');
        }).catch(() => {
          el.value = currentRawGameinfo || '';
          onEditorInput(el, 'gameinfo-page-highlight');
        });
      } else {
        el.value = currentRawGameinfo || '';
        onEditorInput(el, 'gameinfo-page-highlight');
      }
    }
  } else if (tab === 'autoexec') {
    const el = document.getElementById('autoexec-page-textarea');
    if (el) {
      el.value = currentRawAutoexec || '';
      onEditorInput(el, 'autoexec-page-highlight');
    }
  } else if (tab === 'addonconfig') {
    const el = document.getElementById('addonconfig-page-textarea');
    if (el) {
      el.value = currentRawAddonconfig || '';
      onEditorInput(el, 'addonconfig-page-highlight');
    }
  }
}
let currentSelectedMod = null;
function openModal(mod) {
  currentSelectedMod = mod;
  document.getElementById('modal-title').innerText = mod.title;
  document.getElementById('modal-sub').innerText = `ID: ${mod.id} • ${mod.size} • ${mod.filename}`;
  document.getElementById('modal-img').src = mod.img;
  document.getElementById('modal-desc').innerText = mod.desc;
  document.getElementById('mod-modal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('mod-modal').style.display = 'none';
}
