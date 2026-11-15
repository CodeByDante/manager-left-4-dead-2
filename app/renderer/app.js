'use strict';
const api = window.desktop;
const state = { tab: 'workshop', status: {}, workshop: [], mounted: [], backups: [], selected: new Set(), query: '', sort: 'title', config: 'gameinfo', drafts: {}, configData: {}, launch: null, accountId: '', busy: false };
const $ = id => document.getElementById(id);
function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function append(parent, ...children) { parent.append(...children.filter(Boolean)); return parent; }
function button(label, action, style = '') {
  const node = el('button', style, label);
  node.type = 'button';
  node.addEventListener('click', () => Promise.resolve().then(action).catch(error => notify(error.message, true)));
  return node;
}
function notify(message, error = false) { const node = $('notification'); node.textContent = message; node.classList.toggle('error', error); node.hidden = !message; }
async function run(label, action) {
  if (state.busy) return;
  state.busy = true; $('busy-text').textContent = label; $('busy').hidden = false;
  try { return await action(); }
  catch (error) { notify(error.message, true); }
  finally { state.busy = false; $('busy').hidden = true; }
}
function confirmAction(title, message, okLabel = 'Continuar') {
  const dialog = $('confirm-dialog');
  $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-ok').textContent = okLabel;
  dialog.showModal();
  return new Promise(resolve => {
    let answer = false;
    $('confirm-ok').onclick = () => { answer = true; dialog.close(); };
    $('confirm-cancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => resolve(answer), { once: true });
  });
}
function formatSize(size) { return size >= 1024 ** 3 ? (size / 1024 ** 3).toFixed(2) + ' GB' : (size / 1024 ** 2).toFixed(2) + ' MB'; }
function prepared() { return state.mounted.filter(m => m.kind === 'workshop'); }
function custom() { return state.mounted.filter(m => m.kind !== 'workshop'); }
function updateHeader() {
  $('game-path').textContent = state.status.gamePath || 'Selecciona la carpeta del juego';
  $('game-path').title = state.status.gamePath || '';
  $('detected').textContent = state.status.detected ? 'JUEGO DETECTADO' : 'SIN CONFIGURAR';
  $('detected').classList.toggle('good', state.status.detected);
  $('count-workshop').textContent = state.workshop.length;
  $('count-prepared').textContent = prepared().length;
  $('count-custom').textContent = custom().length;
}
async function refresh() {
  state.status = await api.status();
  if (state.status.detected) {
    state.mounted = await api['gameinfo-mods']();
    const response = await api.workshop();
    state.workshop = response.mods;
    if (response.offline) notify('Steam no respondió. Se muestran los archivos locales y los datos disponibles en caché.');
  } else { state.mounted = []; state.workshop = []; }
  state.selected.clear();
  updateHeader();
  await render();
}
const descriptions = {
  workshop: ['Workshop', 'Tus VPK descargados de Steam. Actívalos o prepara una copia con prioridad en gameinfo.txt.'],
  prepared: ['Mods preparados', 'Copias de Workshop registradas en SearchPaths. El archivo original se conserva.'],
  custom: ['Mods personalizados', 'Carpetas que moviste y registraste manualmente en gameinfo.txt.'],
  config: ['Configuraciones', 'Edita los archivos del juego y los parámetros de Steam con respaldo automático.'],
  backups: ['Copias de seguridad', 'Recupera una configuración anterior de esta instalación.']
};
async function render() {
  const [title, description] = descriptions[state.tab];
  $('page-title').textContent = title; $('page-description').textContent = description;
  document.querySelectorAll('[data-tab]').forEach(node => node.classList.toggle('active', node.dataset.tab === state.tab));
  const content = $('content'); content.replaceChildren();
  if (!state.status.detected && state.tab !== 'backups') {
    append(content, empty('Selecciona tu juego', 'Elige la carpeta raíz de Left 4 Dead 2. La ruta quedará guardada para la próxima vez.'));
    return;
  }
  if (state.tab === 'workshop') renderWorkshop(content);
  if (state.tab === 'prepared' || state.tab === 'custom') renderMounted(content);
  if (state.tab === 'config') await renderConfig(content);
  if (state.tab === 'backups') await renderBackups(content);
}
function empty(title, description) { return append(el('div', 'panel empty'), el('strong', '', title), el('p', '', description)); }
function createTable(headers) {
  const wrapper = el('div', 'panel table-wrap');
  const table = el('table'); const head = el('tr');
  headers.forEach(text => head.append(el('th', '', text)));
  const body = el('tbody'); append(table, append(el('thead'), head), body); wrapper.append(table);
  return { wrapper, body, head };
}
function filter(items) {
  const query = state.query.toLocaleLowerCase();
  return items.filter(m => `${m.title} ${m.id || ''} ${m.name || ''} ${(m.tags || []).join(' ')}`.toLocaleLowerCase().includes(query)).sort((a, b) => state.sort === 'size' ? (b.size || 0) - (a.size || 0) : a.title.localeCompare(b.title));
}
function searchToolbar(onChange) {
  const toolbar = el('div', 'toolbar');
  const search = el('input'); search.type = 'search'; search.placeholder = 'Buscar por nombre, carpeta o ID…'; search.value = state.query; search.setAttribute('aria-label', 'Buscar mods');
  const sort = el('select'); sort.setAttribute('aria-label', 'Ordenar mods');
  for (const [value, label] of [['title', 'Nombre A–Z'], ['size', 'Mayor tamaño']]) { const option = el('option', '', label); option.value = value; sort.append(option); }
  sort.value = state.sort;
  search.oninput = () => { state.query = search.value; onChange(); };
  sort.onchange = () => { state.sort = sort.value; onChange(); };
  append(toolbar, search, sort); return toolbar;
}
function renderWorkshop(content) {
  const list = el('div');
  const bulk = button('Preparar seleccionados', async () => {
    const mods = state.workshop.filter(m => state.selected.has(m.id) && m.enabled && !m.converted);
    if (!mods.length) return notify('Selecciona al menos un mod activo sin preparar.', true);
    if (!await confirmAction('Preparar mods', `Se copiarán ${mods.length} VPK y se registrarán en gameinfo.txt. Los originales se conservan. Se creará una copia de la configuración.`, 'Preparar')) return;
    await run('Preparando mods…', async () => {
      const failures = []; let complete = 0;
      for (const [i, mod] of mods.entries()) {
        $('busy-text').textContent = `Preparando ${i + 1} de ${mods.length}…`;
        try { await api.convert({ id: mod.id, filename: mod.filename }); complete++; }
        catch (error) { failures.push(`${mod.title}: ${error.message}`); }
      }
      await refresh(); notify(`${complete} de ${mods.length} mods preparados.${failures.length ? '\n' + failures.join('\n') : ''}`, failures.length > 0);
    });
  }, 'primary');
  function draw() {
    list.replaceChildren();
    const mods = filter(state.workshop);
    if (!mods.length) { list.append(empty('No hay mods para mostrar', state.workshop.length ? 'Prueba otra búsqueda.' : 'No se encontraron VPK del Workshop en esta instalación.')); return; }
    const { wrapper, body, head } = createTable(['', 'MOD', 'TAMAÑO', 'ESTADO', 'ACCIONES']);
    const all = el('input', 'select-check'); all.type = 'checkbox'; all.setAttribute('aria-label', 'Seleccionar todos los mods visibles');
    const selectable = mods.filter(m => m.enabled && !m.converted);
    all.checked = selectable.length > 0 && selectable.every(m => state.selected.has(m.id));
    all.onchange = () => { for (const m of selectable) all.checked ? state.selected.add(m.id) : state.selected.delete(m.id); draw(); };
    head.firstChild.append(all);
    for (const mod of mods) {
      const tr = el('tr'); const check = el('input', 'select-check'); check.type = 'checkbox'; check.checked = state.selected.has(mod.id); check.disabled = !mod.enabled || mod.converted; check.setAttribute('aria-label', `Seleccionar ${mod.title}`);
      check.onchange = () => { check.checked ? state.selected.add(mod.id) : state.selected.delete(mod.id); all.checked = selectable.length > 0 && selectable.every(m => state.selected.has(m.id)); };
      const name = el('div', 'mod-name');
      if (mod.thumbnail) { const image = el('img', 'mod-thumb'); image.src = mod.thumbnail; image.alt = ''; name.append(image); }
      name.append(append(el('div'), el('strong', '', mod.title), el('small', '', `ID ${mod.id}`)));
      const actions = el('div', 'row-actions');
      actions.append(button('Detalles', () => showDetails(mod)));
      actions.append(button('Carpeta', () => api['open-mod']({ type: 'workshop', filename: mod.filename })));
      actions.append(button(mod.enabled ? 'Desactivar' : 'Activar', () => run('Cambiando estado…', async () => { await api.toggle({ filename: mod.filename }); await refresh(); })));
      if (!mod.converted) { const convert = button('Preparar', () => prepareOne(mod), 'primary'); convert.disabled = !mod.enabled; actions.append(convert); }
      append(tr, append(el('td'), check), append(el('td'), name), el('td', '', formatSize(mod.size)), append(el('td'), el('span', 'badge' + (mod.enabled ? '' : ' off'), mod.converted ? 'Preparado' : mod.enabled ? 'Activo' : 'Desactivado')), append(el('td'), actions)); body.append(tr);
    }
    wrapper.append(el('div', 'table-footer', `${mods.length} mods · Las copias preparadas no se actualizan automáticamente con Workshop.`)); list.append(wrapper);
  }
  const toolbar = searchToolbar(draw); toolbar.append(bulk);
  append(content, el('div', 'hint', 'Preparar registra una copia del VPK como ruta del juego; su compatibilidad depende del mod y del servidor. No transforma sus scripts ni garantiza su funcionamiento en todos los modos.'), toolbar, list); draw();
}
async function prepareOne(mod) {
  if (!await confirmAction('Preparar mod para gameinfo.txt', `Se copiará “${mod.title}” a una carpeta del juego y se añadirá a SearchPaths. El VPK original se conserva y gameinfo.txt tendrá respaldo.`, 'Preparar mod')) return;
  await run('Preparando mod…', async () => { await api.convert({ id: mod.id, filename: mod.filename }); await refresh(); notify('Mod preparado y registrado correctamente.'); });
}
async function showDetails(mod) {
  const dialog = el('dialog');
  const description = el('div', 'detail-text', mod.description || 'Sin descripción disponible.');
  const requirements = el('div', 'requirements', 'Consultando requisitos en Steam…');
  const actions = el('div', 'detail-actions');
  append(actions, button('Abrir Workshop', () => api.external(`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`)), button('Traducir descripción', () => run('Traduciendo…', async () => { description.textContent = await api.translate(mod.description || ''); })));
  append(dialog, el('h2', '', mod.title), el('p', '', `Workshop ${mod.id} · ${formatSize(mod.size)}`), description, actions, requirements, append(el('div', 'dialog-actions'), button('Cerrar', () => dialog.close())));
  document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal();
  try {
    const result = await api.requirements(mod.id);
    if (!requirements.isConnected) return;
    requirements.replaceChildren(el('strong', '', 'Requisitos del Workshop'));
    if (!result.verified) requirements.append(el('p', '', 'No se pudo verificar la lista en Steam. Revisa la página del mod.'));
    else if (!result.items.length) requirements.append(el('p', '', 'Steam no indica requisitos adicionales.'));
    const installed = new Set([...state.workshop.map(m => m.id), ...state.mounted.map(m => m.id)]);
    for (const id of result.items) requirements.append(button(`${installed.has(id) ? 'Instalado' : 'No encontrado'} · ID ${id} ↗`, () => api.external(`https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`), 'quiet'));
  } catch (error) { requirements.textContent = error.message; }
}
function renderMounted(content) {
  const list = el('div');
  const items = state.tab === 'custom' ? custom() : prepared();
  function draw() {
    list.replaceChildren();
    const mods = filter(items);
    if (!mods.length) { list.append(empty('No hay carpetas registradas', state.tab === 'custom' ? 'Aquí aparecen las rutas personalizadas de SearchPaths, tal como las registraste en gameinfo.txt.' : 'Prepara un mod desde Workshop para verlo aquí.')); return; }
    const { wrapper, body, head } = createTable(['', 'MOD / CARPETA', 'ARCHIVOS', 'GESTIÓN', 'ACCIONES']);
    const all = el('input', 'select-check'); all.type = 'checkbox'; all.setAttribute('aria-label', 'Seleccionar todas las rutas visibles');
    all.checked = mods.length > 0 && mods.every(m => state.selected.has(m.name));
    all.onchange = () => { for (const m of mods) all.checked ? state.selected.add(m.name) : state.selected.delete(m.name); draw(); };
    head.firstChild.append(all);
    for (const mod of mods) {
      const name = append(el('div', 'mod-name'), append(el('div'), el('strong', '', mod.title), el('small', '', mod.name)));
      const actions = append(el('div', 'row-actions'), button('Carpeta', () => api['open-mod']({ type: 'mounted', name: mod.name })), button(mod.managed ? 'Retirar mod' : 'Quitar registro', () => removeOne(mod), 'danger'));
      const check = el('input', 'select-check'); check.type = 'checkbox'; check.checked = state.selected.has(mod.name); check.setAttribute('aria-label', `Seleccionar ${mod.title}`);
      check.onchange = () => { check.checked ? state.selected.add(mod.name) : state.selected.delete(mod.name); all.checked = mods.every(m => state.selected.has(m.name)); };
      append(body, append(el('tr'), append(el('td'), check), append(el('td'), name), append(el('td'), el('span', 'badge' + (mod.exists ? '' : ' off'), mod.exists ? 'Carpeta encontrada' : 'No encontrada')), el('td', '', mod.managed ? 'Aplicación' : 'Manual'), append(el('td'), actions)));
    }
    list.append(wrapper);
  }
  if (state.tab === 'custom') content.append(el('div', 'hint', 'Esta sección lee las carpetas personalizadas que ya figuran en gameinfo.txt. “Quitar registro” elimina su entrada; conserva los archivos que moviste manualmente.'));
  const toolbar = searchToolbar(draw);
  toolbar.append(button('Retirar seleccionados', async () => {
    const mods = items.filter(m => state.selected.has(m.name));
    if (!mods.length) return notify('Selecciona al menos una ruta.', true);
    const managed = mods.filter(m => m.managed).length;
    if (!await confirmAction('Retirar registros seleccionados', `Se quitarán ${mods.length} registros de gameinfo.txt. Las carpetas manuales se conservarán.${managed ? ` Las ${managed} carpetas creadas por esta aplicación se enviarán a la Papelera.` : ''}`, 'Retirar seleccionados')) return;
    await run('Retirando registros…', async () => {
      const errors = []; let complete = 0;
      for (const mod of mods) { try { await api.remove({ name: mod.name }); complete++; } catch (error) { errors.push(`${mod.title}: ${error.message}`); } }
      await refresh(); notify(`${complete} de ${mods.length} registros retirados.${errors.length ? '\n' + errors.join('\n') : ''}`, errors.length > 0);
    });
  }, 'danger'));
  append(content, toolbar, list); draw();
}
async function removeOne(mod) {
  const detail = mod.managed ? 'Su carpeta creada por esta aplicación se enviará a la Papelera de Windows y se quitará el registro.' : 'Se quitará su entrada de gameinfo.txt. La carpeta y tus archivos se conservarán.';
  if (!await confirmAction('Retirar mod', `“${mod.title}”\n\n${detail}\nSe respaldará gameinfo.txt.`, mod.managed ? 'Retirar mod' : 'Quitar registro')) return;
  await run('Retirando mod…', async () => { await api.remove({ name: mod.name }); await refresh(); notify('Registro retirado. Puedes recuperar gameinfo.txt desde Copias de seguridad.'); });
}
async function renderConfig(content) {
  const tabs = el('div', 'config-tabs');
  for (const [key, label] of [['gameinfo', 'gameinfo.txt'], ['autoexec', 'autoexec.cfg'], ['addonconfig', 'addonconfig.cfg'], ['launch', 'Inicio de Steam']]) tabs.append(button(label, () => run('Cargando configuración…', async () => { state.config = key; await render(); }), state.config === key ? 'active' : ''));
  content.append(tabs);
  if (state.config === 'launch') return renderLaunch(content);
  const kind = state.config;
  const data = await api['read-config'](kind);
  state.configData[kind] = data;
  if (state.tab !== 'config' || state.config !== kind) return;
  const panel = el('div', 'panel');
  const textarea = el('textarea', 'editor'); textarea.spellcheck = false; textarea.setAttribute('aria-label', `Editor de ${kind}`); textarea.value = state.drafts[kind] ?? data.content;
  const dirty = el('span', '', state.drafts[kind] !== undefined ? 'Sin guardar' : 'Sin cambios');
  textarea.oninput = () => { state.drafts[kind] = textarea.value; dirty.textContent = textarea.value === data.content ? 'Sin cambios' : 'Sin guardar'; };
  textarea.onkeydown = event => { if (event.key === 'Tab') { event.preventDefault(); textarea.setRangeText('\t', textarea.selectionStart, textarea.selectionEnd, 'end'); textarea.dispatchEvent(new Event('input')); } };
  const save = button('Guardar cambios', () => run('Guardando configuración…', async () => {
    await api['save-config']({ kind, content: textarea.value }); delete state.drafts[kind];
    if (kind === 'gameinfo') { state.mounted = await api['gameinfo-mods'](); updateHeader(); }
    await render(); notify('Configuración guardada. Si existía una versión anterior, se creó su respaldo.');
  }), 'primary');
  append(panel, append(el('div', 'editor-toolbar'), dirty, save), el('div', 'editor-path', data.file), textarea, el('div', 'editor-note', 'Cierra el juego antes de cambiar su configuración. Tus borradores se conservan al cambiar de sección; se descartan al cerrar la aplicación.'));
  content.append(panel);
}
async function renderLaunch(content) {
  const data = await api.launch({ accountId: state.accountId }); state.launch = data; state.accountId = data.id || '';
  if (state.tab !== 'config' || state.config !== 'launch') return;
  const panel = el('div', 'panel panel-body');
  const top = el('div', 'toolbar');
  const select = el('select'); select.setAttribute('aria-label', 'Cuenta de Steam');
  for (const account of data.accounts) { const option = el('option', '', `Cuenta ${account.id}`); option.value = account.id; select.append(option); }
  select.value = state.accountId;
  select.onchange = () => run('Cambiando cuenta…', async () => { state.accountId = select.value; await render(); });
  append(top, select, button('Elegir carpeta de Steam', () => run('Seleccionando Steam…', async () => { if (await api['select-steam']()) { state.accountId = ''; await render(); } })));
  panel.append(top);
  if (!data.accounts.length) { append(panel, el('p', '', 'Selecciona la carpeta de Steam. La cuenta debe haber ejecutado Left 4 Dead 2 al menos una vez.')); content.append(panel); return; }
  append(panel, el('p', '', 'Cierra Steam antes de guardar para evitar que sobrescriba los cambios. Elige la cuenta que deseas modificar.'));
  const key = `launch-${state.accountId}`;
  const input = el('input', 'launch-input'); input.setAttribute('aria-label', 'Parámetros de inicio de Steam'); input.value = state.drafts[key] ?? data.launchOptions;
  input.oninput = () => { state.drafts[key] = input.value; };
  panel.append(input);
  const presets = el('div', 'presets');
  for (const [flag, label] of [['-novid', 'Omitir intro'], ['-console', 'Consola'], ['-nojoy', 'Sin joystick'], ['-windowed', 'Ventana'], ['-noborder', 'Sin bordes']]) presets.append(button(label, () => {
    const tokens = input.value.trim().split(/\s+/).filter(Boolean); input.value = tokens.includes(flag) ? tokens.filter(t => t !== flag).join(' ') : [...tokens, flag].join(' '); input.dispatchEvent(new Event('input'));
  }));
  append(panel, presets, button('Guardar parámetros', () => run('Guardando parámetros…', async () => { await api['save-launch']({ accountId: state.accountId, content: input.value }); delete state.drafts[key]; notify('Parámetros guardados con copia de seguridad.'); }), 'primary'));
  content.append(panel);
}
async function renderBackups(content) {
  const backups = await api.backups();
  if (state.tab !== 'backups') return;
  content.append(append(el('div', 'toolbar'), button('Abrir carpeta de copias', () => api['open-backups']())));
  content.append(el('div', 'hint', 'Restaurar recupera el archivo de configuración. Si retiraste un mod, recupera también su carpeta desde la Papelera de Windows.'));
  if (!backups.length) { content.append(empty('Todavía no hay copias', 'Se crean automáticamente antes de modificar un archivo existente.')); return; }
  const { wrapper, body } = createTable(['FECHA', 'ARCHIVO', 'ACCIÓN']);
  for (const item of backups) body.append(append(el('tr'), el('td', '', new Date(item.createdAt).toLocaleString('es-PE')), el('td', 'backup-file', item.file), append(el('td'), button('Restaurar', async () => {
    if (!await confirmAction('Restaurar configuración', `Se recuperará la versión del ${new Date(item.createdAt).toLocaleString('es-PE')}. Se respaldará la versión actual. Cierra Steam y el juego antes de continuar.`, 'Restaurar')) return;
    await run('Restaurando…', async () => { await api.restore({ id: item.id }); state.drafts = {}; await refresh(); notify('Configuración restaurada.'); });
  }))));
  content.append(wrapper);
}
$('select-game').onclick = async () => {
  if (Object.keys(state.drafts).length && !await confirmAction('Cambiar de instalación', 'Los borradores sin guardar se descartarán al elegir otra instalación.')) return;
  await run('Seleccionando juego…', async () => { if (await api['select-game']()) { state.drafts = {}; state.accountId = ''; await refresh(); } });
};
$('open-game').onclick = () => run('Abriendo carpeta…', () => api['open-game']());
$('refresh').onclick = () => run('Actualizando biblioteca…', refresh);
for (const node of document.querySelectorAll('[data-tab]')) node.onclick = () => run('Cargando sección…', async () => { state.tab = node.dataset.tab; state.query = ''; state.selected.clear(); await render(); });
if (!api) { notify('Abre el proyecto con npm start o ejecuta la aplicación de Windows.', true); }
else run('Leyendo tu instalación…', refresh);
