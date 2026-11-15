// Original layout and classes, with safe data rendering and desktop actions.
const $ = id => document.getElementById(id);
let installation = null;
let operationBusy = false;
function node(tag, className, text) { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; }
function join(parent, ...children) { parent.append(...children.filter(Boolean)); return parent; }
const svg = path => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`;
const icons = {
 arrow: svg('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
 folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
 external: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
 trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
 down: svg('<polyline points="6 9 12 15 18 9"/>'),
 server: svg('<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>')
};
function action(icon, title, fn, label) {
  const b = node('button', label ? 'btn-action-label' : 'icon-btn'); b.type = 'button'; b.title = title; b.innerHTML = icons[icon] || '';
  if (label) b.append(document.createTextNode(' ' + label));
  b.addEventListener('click', event => { event.stopPropagation(); Promise.resolve().then(fn).catch(showOperationError); }); return b;
}
function showOperationError(error) { showCustomDialog({ type: 'error', title: 'No se pudo completar la operación', message: error?.message || String(error) }); $('custom-dialog-requirements-container').style.display = 'none'; }
async function operate(fn) { if (operationBusy) return; operationBusy = true; document.body.style.cursor = 'progress'; try { return await fn(); } catch (error) { showOperationError(error); } finally { operationBusy = false; document.body.style.cursor = ''; } }
function safeImage(src) { return typeof src === 'string' && /^data:image\/(jpeg|png|webp|svg\+xml)[;,]/.test(src) ? src : defaultPlaceholder; }
function image(src, className, alt) { const e = node('img', className); e.src = safeImage(src); e.alt = alt; e.onerror = () => { e.onerror = null; e.src = defaultPlaceholder; }; return e; }
function getPlainTextSnippet(text) { return (text || '').replace(/\[[^\]]+\]/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function cleanSteamDescription(text) {
  return (text || 'Sin descripción disponible.').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\[(?:img|table)\][\s\S]*?\[\/(?:img|table)\]/gi, '').replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>').replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>').replace(/\[\/?[^\]]+\]/g, '').replace(/\n/g, '<br>');
}
function tag(text) { const n = node('span', 'badge font-mono', text); n.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;color:#34d399;background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.3)'; return n; }
function checkColumn(row, value, kind, mod) {
  const td = node('td'); td.style.cssText = 'text-align:center;vertical-align:middle;width:36px;text-overflow:clip;padding:6px 4px;cursor:pointer';
  const check = node('input', `chk-mod-${kind}`); check.type = 'checkbox'; check.value = value;
  if (mod) check.dataset.modJson = encodeURIComponent(JSON.stringify(mod));
  td.onclick = event => kind === 'workshop' ? handleChkCellClickWorkshop(td, event) : handleChkCellClickGameinfo(td, event);
  td.append(check); row.append(td);
}
function selectionHeader(id, kind, active) {
  const row = $(id); if (!row) return;
  const existing = row.querySelector('[data-selection-header]'); if (existing) existing.remove();
  if (!active) return;
  const th = node('th'); th.dataset.selectionHeader = 'true'; th.style.cssText = 'width:36px;text-align:center';
  const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.title = 'Seleccionar Todos';
  checkbox.onclick = () => kind === 'workshop' ? toggleSelectAllWorkshop(checkbox.checked) : toggleSelectAllGameinfo(checkbox.checked);
  th.append(checkbox); row.prepend(th);
}
function textCell(text, css) { const td = node('td', 'font-mono', text); if (css) td.style.cssText = css; return td; }
function emptyRow(body, span, text) { const td = textCell(text, 'text-align:center;color:#71717a;padding:20px;font-size:12px'); td.colSpan = span; body.append(join(node('tr'), td)); }
function modRow(mod, mounted) {
  const key = mounted ? `gameinfo-${mounted.name}` : mod.id;
  const row = node('tr'); row.id = `mod-row-${key}`; row.onclick = () => toggleAccordionRow(key, mod.desc);
  if (mounted ? isQuickSelectGameinfo : isQuickSelectWorkshop) checkColumn(row, mounted ? mounted.name : mod.id, mounted ? 'gameinfo' : 'workshop', mounted ? null : mod);
  const cover = node('td'); cover.style.textAlign = 'center'; cover.append(join(node('div', 'thumb-container'), image(mod.img, 'thumb-img', 'Portada')));
  const titleCell = node('td'); const layout = node('div'); layout.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0';
  const info = node('div'); info.style.cssText = 'min-width:0;flex:1;overflow:hidden';
  join(info, node('div', 'mod-title', mod.title), node('div', 'mod-desc', getPlainTextSnippet(mod.desc)));
  if (mounted) { const folder = node('div', 'font-mono', mounted.name); folder.style.cssText = 'font-size:9px;color:#71717a;margin-top:2px'; info.append(folder); }
  const expand = node('div', 'expand-arrow'); expand.title = 'Ver descripción completa'; expand.innerHTML = icons.down; join(layout, info, expand); titleCell.append(layout);
  const tags = node('td'); if (mod.tags?.length) tags.append(tag(mod.tags[0])); else tags.textContent = '-';
  join(row, cover, titleCell, tags, textCell(mod.id || '-', 'font-size:11px;color:#a1a1aa'), textCell(mod.size, 'text-align:right;font-size:11px;color:#d4d4d8'));
  if (mounted) { const cell = node('td'); cell.style.textAlign = 'center'; const state = node('span'); state.innerHTML = icons.server; state.style.color = mounted.existsOnDisk ? '#34d399' : '#ef4444'; state.title = mounted.existsOnDisk ? 'Carpeta encontrada' : 'Carpeta no encontrada'; cell.append(state); row.append(cell); }
  const buttons = node('div'); buttons.style.cssText = 'display:inline-flex;gap:4px';
  if (!mounted) buttons.append(action('arrow', 'Convertir a Versus VPK (pak01_dir.vpk)', () => prepareWithRequirements(mod)));
  buttons.append(action('folder', 'Abrir carpeta en Windows', () => openLocalFolder(mounted ? mounted.folderPath : mod.fullPath)));
  if (mod.id) buttons.append(action('external', 'Abrir en Steam Workshop', () => openWorkshopPage(mod.id)));
  if (mounted) { const remove = action('trash', mounted.managed ? 'Retirar mod y enviar su carpeta a la Papelera' : 'Quitar registro y conservar carpeta', () => deleteGameinfoMod(mounted.name)); remove.style.color = '#f87171'; buttons.append(remove); }
  const controls = node('td'); controls.style.cssText = 'text-align:center;overflow:visible;text-overflow:clip'; controls.append(buttons); row.append(controls);
  const detail = node('tr', 'expanded-row'); detail.id = `mod-detail-${key}`; detail.style.display = 'none';
  const td = node('td'); td.colSpan = (mounted ? 7 : 6) + ((mounted ? isQuickSelectGameinfo : isQuickSelectWorkshop) ? 1 : 0);
  const card = node('div', 'accordion-card'); const header = node('div', 'accordion-header'); const descInfo = node('div', 'accordion-info');
  const title = node('div', '', mod.title); title.style.cssText = 'font-weight:700;font-size:14px;color:#fff';
  const labels = node('div'); labels.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px'; labels.append(node('span', 'font-mono', 'ETIQUETAS:')); for (const name of mod.tags || []) labels.append(tag(name));
  const meta = node('div', 'font-mono', `ID: ${mod.id || '-'} • ${mounted ? 'Carpeta: '+mounted.name : 'Archivo: '+mod.filename} • Tamaño: ${mod.size}`); meta.style.cssText = 'font-size:11px;color:#8e8e99;margin-top:4px';
  join(descInfo, title, labels, meta); join(header, image(mod.img, 'accordion-large-thumb', 'Preview'), descInfo);
  const description = node('div', 'accordion-desc-box'); description.id = `accordion-desc-${key}`; description.innerHTML = cleanSteamDescription(mod.desc);
  const actions = node('div', 'accordion-actions');
  if (mod.desc) { const translate = action(null, 'Traducir a Español', () => handleTranslateMod(key, mod.desc), 'Traducir a Español'); translate.id = `btn-translate-${key}`; actions.append(translate); }
  actions.append(action('folder', 'Abrir Carpeta en Windows', () => openLocalFolder(mounted ? mounted.folderPath : mod.fullPath), 'Abrir Carpeta en Windows'));
  if (mod.id) actions.append(action('external', 'Abrir en Steam Workshop', () => openWorkshopPage(mod.id), 'Abrir en Steam Workshop'));
  if (!mounted) actions.append(action(null, mod.enabled ? 'Desactivar VPK original' : 'Activar VPK original', () => operate(async () => { await window.api.toggleModStatus(mod); await loadModsData(); }), mod.enabled ? 'Desactivar VPK original' : 'Activar VPK original'));
  join(card, header, description, actions); td.append(card); detail.append(td); return [row, detail];
}
function renderMods(items) { const body = $('mods-tbody'); body.replaceChildren(); selectionHeader('tr-head-workshop', 'workshop', isQuickSelectWorkshop); if (!items.length) emptyRow(body, isQuickSelectWorkshop ? 7 : 6, 'No hay mods del Workshop para mostrar.'); for (const mod of items) body.append(...modRow(mod)); }
function renderGameinfo(data) {
  const converted = $('converted-gameinfo-tbody'), manual = $('manual-gameinfo-tbody'); converted.replaceChildren(); manual.replaceChildren();
  selectionHeader('tr-head-converted-gameinfo', 'gameinfo', isQuickSelectGameinfo);
  const query = ($('search-box-gameinfo').value || '').toLowerCase();
  const list = (data.convertedMods || []).filter(m => `${m.title} ${m.name} ${m.workshopId}`.toLowerCase().includes(query)).sort((a,b) => { const av = gameinfoSortField === 'id' ? a.workshopId : gameinfoSortField === 'size' ? parseSizeBytes(a.size || '0') : a.title; const bv = gameinfoSortField === 'id' ? b.workshopId : gameinfoSortField === 'size' ? parseSizeBytes(b.size || '0') : b.title; return (gameinfoSortOrder === 'asc' ? 1 : -1) * (typeof av === 'number' ? av-bv : String(av || '').localeCompare(String(bv || ''))); });
  if (!list.length) emptyRow(converted, isQuickSelectGameinfo ? 8 : 7, 'No hay mods convertidos aún.');
  for (const item of list) { const source = realWorkshopMods.find(m => m.id === item.workshopId); converted.append(...modRow({ id:item.workshopId,title:item.title || item.name,desc:item.desc || source?.desc || '',img:item.previewUrl || source?.img,size:item.size || source?.size || '-',tags:item.tags || source?.tags || [] }, item)); }
  const customs = (data.customMods || []).filter(m => m.name.toLowerCase().includes(query));
  if (!customs.length) emptyRow(manual, 5, 'Sin mods añadidos manualmente en gameinfo.txt.');
  for (const [i,item] of customs.entries()) {
    const row = node('tr'); const state = node('span'); state.innerHTML = icons.server; state.style.color = item.existsOnDisk ? '#34d399' : '#ef4444'; state.title = item.existsOnDisk ? 'Carpeta encontrada' : 'Carpeta no encontrada';
    const controls = node('div'); controls.style.cssText = 'display:inline-flex;gap:4px';
    join(controls, action('folder', 'Abrir carpeta en Windows', () => openLocalFolder(item.folderPath)), action('trash', 'Quitar registro y conservar carpeta', () => deleteGameinfoMod(item.name)));
    join(row, textCell(String(i+1), 'text-align:center;color:#71717a'), textCell(item.name, 'font-weight:600;color:#e4e4e7;font-size:12px'), textCell('Game','color:#8e8e99;font-size:11px'), join(textCell('','text-align:center'),state), join(textCell('','text-align:center'),controls)); manual.append(row);
  }
}
async function prepareWithRequirements(mod) {
  try { const result = await window.desktop.requirements(mod.id); const installed = new Set([...realWorkshopMods.map(m=>m.id),...(currentGameinfoData?.convertedMods||[]).map(m=>m.workshopId)]); mod.requiredItems = result.items.map(id=>({ id,title:'Mod '+id,isInstalled:installed.has(id) })); convertWorkshopModToVersus(mod); if (!result.verified) { $('custom-dialog-req-badge').textContent = 'NO VERIFICADOS'; $('custom-dialog-req-list').textContent = 'No se pudo comprobar los requisitos en Steam. Revisa la página del mod.'; } } catch(error) { showOperationError(error); }
}
async function deleteGameinfoMod(name) {
  const item = [...(currentGameinfoData?.convertedMods || []),...(currentGameinfoData?.customMods || [])].find(m=>m.name===name);
  if (!item) return;
  showCustomDialog({ type:'confirm',title:'¿Retirar mod de gameinfo.txt?',modTitle:item.title || name,message:item.managed ? 'Se respaldará gameinfo.txt y se enviará la carpeta creada por esta aplicación a la Papelera.' : 'Se quitará el registro de gameinfo.txt. La carpeta que moviste manualmente se conservará.',confirmText:'Confirmar',onConfirm:()=>operate(async()=>{await window.api.deleteGameinfoMod({name});await loadGameinfoData();await loadModsData();}) });
  $('custom-dialog-requirements-container').style.display='none';
}
async function batch(items, operation) {
  await operate(async()=> { let count=0;const failures=[]; for (const item of items) { try { await operation(item);count++; }catch(error){failures.push(error.message);} } await loadGameinfoData();await loadModsData();showCustomDialog({type:failures.length?'error':'success',title:'Proceso terminado',message:`Completados: ${count}/${items.length}${failures.length?'\n'+failures.join('\n'):''}`});$('custom-dialog-requirements-container').style.display='none'; });
}
function executeBulkConvertWorkshop() { const items=[...document.querySelectorAll('.chk-mod-workshop:checked')].map(c=>realWorkshopMods.find(m=>m.id===c.value)).filter(Boolean);if(!items.length)return;showCustomDialog({type:'confirm',title:'¿Convertir mods seleccionados?',message:`Se prepararán ${items.length} mods. Los originales se conservan y gameinfo.txt se respalda.`,onConfirm:()=>batch(items,m=>window.api.convertWorkshopModToVersus(m))});$('custom-dialog-requirements-container').style.display='none'; }
function executeBulkDeleteGameinfo() { const items=[...document.querySelectorAll('.chk-mod-gameinfo:checked')].map(c=>({name:c.value}));if(!items.length)return;showCustomDialog({type:'confirm',title:'¿Retirar mods seleccionados?',message:`Se retirarán ${items.length} registros. Las carpetas manuales se conservan; las creadas por esta versión se envían a la Papelera.`,onConfirm:()=>batch(items,m=>window.api.deleteGameinfoMod(m))});$('custom-dialog-requirements-container').style.display='none'; }
async function saveEditor(kind,id,btn) { await operate(async()=>{await window.desktop['save-config']({kind,content:$(id).value});if(kind==='gameinfo'){currentRawGameinfo=$(id).value;await loadGameinfoData();}if(kind==='autoexec')currentRawAutoexec=$(id).value;if(kind==='addonconfig')currentRawAddonconfig=$(id).value;if(btn)flashButtonSaved(btn);}); }
function saveGameinfoPageContent(btn){return saveEditor('gameinfo','gameinfo-page-textarea',btn);}
function saveGameinfoContent(){return saveEditor('gameinfo','gameinfo-textarea');}
function saveAutoexecContent(btn){return saveEditor('autoexec','autoexec-page-textarea',btn);}
function saveAddonconfigContent(btn){return saveEditor('addonconfig','addonconfig-page-textarea',btn);}
function renderLaunchTags(){const box=$('launch-tags-container');if(!box)return;box.replaceChildren();for(const text of ($('launch-options-textarea')?.value||'').match(/(?:"[^"]*"|[^\s])+/g)||[])box.append(action(null,'Quitar parámetro',()=>removeLaunchTag(text),text));renderPresetLibrary($('launch-options-textarea').value);}
function openLocation(kind){return window.desktop['open-location']({kind}).catch(showOperationError);}
async function initApp(){try{installation=await window.api.getStatus();if(!installation.exists){const selected=await window.desktop['select-game']();if(!selected)return;installation=await window.api.getStatus();}const root=installation.gamePath;const paths={game:root,workshop:root+'\\left4dead2\\addons\\workshop',gameinfo:root+'\\left4dead2\\gameinfo.txt',autoexec:root+'\\left4dead2\\cfg\\autoexec.cfg',addonconfig:root+'\\left4dead2\\cfg\\addonconfig.cfg'};for(const e of document.querySelectorAll('[data-location]'))if(e.tagName==='SPAN'){e.textContent=paths[e.dataset.location];e.title=paths[e.dataset.location];}await loadGameinfoData();await loadModsData();await loadAutoexecData();await loadAddonconfigData();await loadLaunchOptionsData();}catch(error){showOperationError(error);}}
window.addEventListener('unhandledrejection',event=>{event.preventDefault();showOperationError(event.reason);});
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='r'){event.preventDefault();initApp();}});
initApp();
