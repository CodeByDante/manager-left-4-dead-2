import React, { useState } from 'react';
import { Search, ChevronsUpDown, ArrowUp, ArrowDown, Folder, Trash2, Server, ChevronDown, Globe, ExternalLink, X, AlertTriangle, CheckCircle2, ImageOff, FileText, ArrowLeft, Save, CheckSquare, Square } from 'lucide-react';

export default function GameinfoMods({ gameinfo, loading, onRefresh, workshopMods }) {
  const { convertedMods = [], customMods = [], corePaths = [] } = gameinfo || {};
  const [expandedModName, setExpandedModName] = useState(null);
  const [translatedMap, setTranslatedMap] = useState({});
  const [translatingName, setTranslatingName] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('title'); // 'title' | 'size' | 'id'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [dialogConfig, setDialogConfig] = useState(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [rawText, setRawText] = useState('');
  const [savingText, setSavingText] = useState(false);

  const handleOpenEditor = () => {
    setRawText(gameinfo?.rawContent || '');
    setIsEditingText(true);
  };

  const [isSavedFlash, setIsSavedFlash] = useState(false);

  const handleSaveRawText = async () => {
    setSavingText(true);
    try {
      if (window.api && window.api.saveGameinfoTxt) {
        await window.api.saveGameinfoTxt(rawText);
      } else {
        await fetch('/api/save-gameinfo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: rawText })
        });
      }
      if (onRefresh) onRefresh();
      setIsSavedFlash(true);
      setTimeout(() => setIsSavedFlash(false), 2500);
    } catch (err) {
      console.error('Error al guardar:', err);
    } finally {
      setSavingText(false);
    }
  };

  if (isEditingText) {
    return (
      <div className="space-y-3">
        {/* Editor Toolbar with Back Arrow */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingText(false)}
              className="px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-[#0d0d0d] border border-[#222222] rounded hover:border-[#383838] transition-colors"
              title="Volver a la lista de Versus VPK"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
              <span>Volver a Versus VPK</span>
            </button>
            <span className="font-mono text-[11px] text-zinc-400 bg-[#050505] border border-[#1e1e1e] px-2 py-0.5 rounded truncate max-w-md">
              C:\Program Files (x86)\Steam\steamapps\common\Left 4 Dead 2\left4dead2\gameinfo.txt
            </span>
          </div>

          <button
            onClick={handleSaveRawText}
            disabled={savingText}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors ${
              isSavedFlash
                ? 'bg-[#0a1a12] border border-[#10b981] text-emerald-400 font-mono'
                : 'bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 text-white'
            }`}
          >
            {isSavedFlash ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{savingText ? 'Guardando...' : 'Guardar Cambios'}</span>
              </>
            )}
          </button>
        </div>

        {/* Full Textarea Code Editor */}
        <div className="dark-card p-3 bg-[#08080a] border-[#1e1e1e] rounded">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck="false"
            className="w-full h-[520px] bg-[#050507] text-zinc-200 font-mono text-xs p-3 rounded border border-[#1a1a24] focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
          />
        </div>

        {/* CUSTOM DIALOG MODAL */}
        {dialogConfig && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDialogConfig(null)}>
            <div className="dark-card bg-[#0c0c0e] border-[#22222a] max-w-md w-full p-4 space-y-3 shadow-2xl rounded-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#1f1f28] pb-2">
                <h3 className="text-sm font-bold text-white">{dialogConfig.title}</h3>
                <button onClick={() => setDialogConfig(null)} className="text-zinc-500 hover:text-zinc-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 rounded border text-xs leading-relaxed bg-[#0a1a12] border-[#1a3a2a] text-emerald-300">
                {dialogConfig.message}
              </div>
              <div className="pt-2 border-t border-[#1f1f28] flex justify-end">
                <button
                  onClick={() => setDialogConfig(null)}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] rounded cursor-pointer"
                >
                  {dialogConfig.confirmText || 'Entendido'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  // Quick Select & Bulk Delete State
  const [isQuickSelect, setIsQuickSelect] = useState(false);
  const [selectedNames, setSelectedNames] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const cycleSortKey = () => {
    if (sortKey === 'title') setSortKey('size');
    else if (sortKey === 'size') setSortKey('id');
    else setSortKey('title');
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const openFolder = (folderPath, name) => {
    const targetPath = folderPath || (`C:\\Program Files (x86)\\Steam\\steamapps\\common\\Left 4 Dead 2\\` + name);
    if (window.api && window.api.openFileLocation) {
      window.api.openFileLocation(targetPath);
    }
  };

  const openSteam = (e, workshopId) => {
    if (e) e.stopPropagation();
    if (!workshopId) return;
    const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`;
    if (window.api && window.api.openExternalUrl) {
      window.api.openExternalUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDelete = (name) => {
    const item = convertedMods.find(m => m.name === name) || customMods.find(m => m.name === name);
    const matched = (workshopMods || []).find(w => w.id === item?.workshopId || w.id === name || (name && name.includes(w.id)));
    const modTitle = matched?.title || item?.title || name;
    const modId = item?.workshopId || matched?.id || (name.match(/\d{5,}/)?.[0]) || null;
    const img = item?.previewUrl || matched?.thumbnailUrl || matched?.img;

    setDialogConfig({
      type: 'confirm',
      title: '¿Eliminar Mod de Versus VPK?',
      modTitle: modTitle,
      modId: modId,
      folderName: name,
      img: img,
      message: `¿Deseas eliminar "${modTitle}" de gameinfo.txt y borrar su carpeta de tu PC?`,
      confirmText: 'Sí, Eliminar Mod',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          if (window.api && window.api.deleteGameinfoMod) {
            await window.api.deleteGameinfoMod({ name });
          } else {
            await fetch('/api/delete-gameinfo-mod', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name })
            });
          }
          if (onRefresh) onRefresh();
        } catch (err) {
          console.error('Error al eliminar mod:', err);
        }
      }
    });
  };

  const handleTranslateMod = async (modName, rawDesc) => {
    if (translatedMap[modName]) {
      setTranslatedMap(prev => {
        const next = { ...prev };
        delete next[modName];
        return next;
      });
      return;
    }
    setTranslatingName(modName);
    try {
      let res;
      if (window.api && window.api.translateText) {
        res = await window.api.translateText(rawDesc);
      } else {
        const resp = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawDesc })
        });
        res = await resp.json();
      }
      if (res && res.translatedText) {
        setTranslatedMap(prev => ({ ...prev, [modName]: res.translatedText }));
      }
    } catch (err) {
      console.error('Error al traducir:', err);
    } finally {
      setTranslatingName(null);
    }
  };

  // Filter & Sort Converted Mods
  const filteredConvertedMods = convertedMods.filter(item => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (
      (item.title || '').toLowerCase().includes(query) ||
      (item.name || '').toLowerCase().includes(query) ||
      (item.workshopId || '').toLowerCase().includes(query)
    );
  });

  const sortedConvertedMods = [...filteredConvertedMods].sort((a, b) => {
    let valA, valB;
    if (sortKey === 'title') {
      valA = (a.title || a.name || '').toLowerCase();
      valB = (b.title || b.name || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (sortKey === 'size') {
      valA = parseFloat(a.size) || 0;
      valB = parseFloat(b.size) || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    } else if (sortKey === 'id') {
      valA = (a.workshopId || a.name || '').toLowerCase();
      valB = (b.workshopId || b.name || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  // Filter Custom Mods
  const filteredCustomMods = customMods.filter(item => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (item.name || '').toLowerCase().includes(query);
  });

  const allVersusMods = [...sortedConvertedMods, ...filteredCustomMods];

  const toggleSelectAll = () => {
    if (selectedNames.length === allVersusMods.length && allVersusMods.length > 0) {
      setSelectedNames([]);
    } else {
      setSelectedNames(allVersusMods.map(m => m.name));
    }
  };

  const toggleSelectMod = (name, e) => {
    if (e) e.stopPropagation();
    setSelectedNames(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  const promptBulkDelete = () => {
    if (selectedNames.length === 0) return;
    setDialogConfig({
      type: 'confirm',
      title: '¿Eliminar Mods Seleccionados?',
      message: `¿Deseas eliminar los ${selectedNames.length} mods seleccionados de gameinfo.txt y borrar sus carpetas de tu PC?`,
      confirmText: `Sí, Eliminar ${selectedNames.length} Mods`,
      cancelText: 'Cancelar',
      onConfirm: () => executeBulkDelete()
    });
  };

  const executeBulkDelete = async () => {
    setIsBulkDeleting(true);
    for (let name of selectedNames) {
      try {
        if (window.api && window.api.deleteGameinfoMod) {
          await window.api.deleteGameinfoMod({ name });
        } else {
          await fetch('/api/delete-gameinfo-mod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });
        }
      } catch (err) {
        console.error('Error al eliminar mod en lote:', name, err);
      }
    }
    setIsBulkDeleting(false);
    setSelectedNames([]);
    setIsQuickSelect(false);
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-4">

      {/* Top Header & Toolbar */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200 text-xs">
            Versus VPK Mods (gameinfo.txt)
          </span>
          <span className="badge font-mono text-[10px]">
            {convertedMods.length + customMods.length} ACTIVOS EN VERSUS
          </span>
          <button
            onClick={handleOpenEditor}
            className="px-2 py-0.5 text-[11px] font-mono font-medium text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer bg-[#0d0d0d] border border-[#222222] rounded hover:border-[#383838] transition-colors"
            title="Abrir editor de gameinfo.txt"
          >
            <FileText className="w-3 h-3 text-zinc-400" />
            <span>gameinfo.txt</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Select & Bulk Delete */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsQuickSelect(prev => !prev);
                if (isQuickSelect) setSelectedNames([]);
              }}
              className="px-2.5 py-1 text-[11px] font-mono font-medium rounded border bg-[#0d0d0d] border-[#222222] text-zinc-300 hover:text-white hover:border-[#383838] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Activar modo de selección múltiple rápida"
            >
              {isQuickSelect ? (
                <CheckSquare className="w-3.5 h-3.5 text-zinc-200" />
              ) : (
                <Square className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span className="whitespace-nowrap">Selección Rápida</span>
            </button>

            {isQuickSelect && (
              <button
                onClick={promptBulkDelete}
                disabled={selectedNames.length === 0 || isBulkDeleting}
                className="px-2.5 py-1 text-[11px] font-mono font-medium bg-[#2a0e0e] border border-[#7f1d1d] text-rose-400 hover:text-white hover:bg-[#3f1212] rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                title="Eliminar mods seleccionados"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-bold text-rose-400 text-[11px]">
                  ({selectedNames.length})
                </span>
              </button>
            )}
          </div>

          {/* Sorting Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={cycleSortKey}
              className="px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-[#0d0d0d] border border-[#222222] rounded hover:border-[#383838] transition-colors"
              title="Criterio de ordenación: Haz clic para cambiar entre Nombre, Tamaño e ID"
            >
              <ChevronsUpDown className="w-3 h-3 text-zinc-400" />
              <span>{sortKey === 'title' ? 'Nombre' : sortKey === 'size' ? 'Tamaño' : 'ID'}</span>
            </button>

            <button
              onClick={toggleSortOrder}
              className="px-2.5 py-1 text-[11px] font-mono font-medium text-zinc-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-[#0d0d0d] border border-[#222222] rounded hover:border-[#383838] transition-colors"
              title="Orden: Haz clic para alternar entre Ascendente y Descendente"
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-zinc-400" />
              ) : (
                <ArrowDown className="w-3 h-3 text-zinc-400" />
              )}
              <span>{sortOrder.toUpperCase()}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-56">
            <Search className="w-3 h-3 text-zinc-600 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar mod en Versus VPK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded pl-6 pr-2 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#333333] font-mono"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="dark-card h-8 animate-pulse bg-[#121212]"></div>
          ))}
        </div>
      ) : (
        <>
          {/* SECTION 1: MODS CONVERTIDOS A VERSUS VPK */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-end px-1">
              <span className="text-[10px] font-mono text-zinc-500">
                {sortedConvertedMods.length} MODS CONVERTIDOS
              </span>
            </div>

            {sortedConvertedMods.length === 0 ? (
              <div className="dark-card p-3 text-center text-zinc-500 text-[11px] bg-[#0a0a0a] border-[#1e1e1e]">
                No se encontraron mods convertidos.
              </div>
            ) : (
              <div className="dark-card overflow-hidden bg-[#0a0a0a] border-[#1e1e1e]">
                <table className="w-full text-left text-[11px] border-collapse table-fixed">
                  <thead>
                    <tr className="border-b border-[#1e1e1e] bg-[#0e0e0e] text-[10px] text-zinc-500 font-mono uppercase tracking-wider select-none">
                      {isQuickSelect && (
                        <th className="py-1 px-2 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={allVersusMods.length > 0 && selectedNames.length === allVersusMods.length}
                            onChange={toggleSelectAll}
                            className="cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="py-1 px-2 w-28 text-center">Portada</th>
                      <th className="py-1 px-2">Mod / Título & Descripción</th>
                      <th className="py-1 px-2 w-32">Etiquetas</th>
                      <th className="py-1 px-2 w-28">Workshop ID</th>
                      <th className="py-1 px-2 w-20 text-right">Tamaño</th>
                      <th className="py-1 px-2 w-28 text-center">Estado Disco</th>
                      <th className="py-1 px-2 w-36 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]">
                    {sortedConvertedMods.map((mod, idx) => {
                      const matched = (workshopMods || []).find(w => w.id === mod.workshopId || w.id === mod.name || (mod.name && mod.name.includes(w.id)));
                      const effectiveWorkshopId = mod.workshopId || matched?.id || (mod.name ? mod.name.match(/\d{5,}/)?.[0] : null);
                      const imgSrc = mod.previewUrl || (matched ? (matched.thumbnailUrl || matched.img) : null);
                      const itemDesc = mod.desc || (matched ? (matched.description || matched.desc) : null);
                      const tagsList = mod.tags || (matched ? (matched.tags || []) : []);
                      const sizeFormatted = mod.size || (matched ? (matched.sizeFormatted || matched.size) : null);
                      const isExpanded = expandedModName === mod.name;

                      return (
                        <React.Fragment key={idx}>
                          <tr
                            onClick={() => setExpandedModName(prev => prev === mod.name ? null : mod.name)}
                            className={`hover:bg-[#121212] transition-colors cursor-pointer group ${selectedNames.includes(mod.name) ? 'bg-[#2a0e0e]/40' : ''}`}
                          >
                            {isQuickSelect && (
                              <td
                                className="py-1.5 px-2 text-center w-8 shrink-0 cursor-pointer"
                                onClick={(e) => toggleSelectMod(mod.name, e)}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedNames.includes(mod.name)}
                                  onChange={() => {}}
                                  className="cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-1.5 px-2 text-center">
                              <div className="w-20 h-11 mx-auto bg-black rounded border border-[#222] overflow-hidden flex items-center justify-center">
                                {imgSrc ? (
                                  <img src={imgSrc} alt="Thumbnail" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-mono text-zinc-600">VPK</span>
                                )}
                              </div>
                            </td>
                            <td className="py-1 px-2 font-mono text-zinc-200 font-medium text-[11px] truncate">
                              <div className="flex items-center justify-between gap-2 w-full">
                                <div className="min-w-0 flex-1 truncate">
                                  <div className="font-sans font-semibold text-white text-[12px] group-hover:text-amber-400/90 transition-colors">{mod.title}</div>
                                  {itemDesc && <div className="text-[10px] text-zinc-400 font-sans truncate">{itemDesc.replace(/\[[^\]]+\]/g, '').replace(/<[^>]+>/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()}</div>}
                                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{mod.name}</div>
                                </div>
                                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-white' : ''}`} />
                              </div>
                            </td>
                            <td className="py-1 px-2 font-mono text-[10px] truncate">
                              {tagsList && tagsList.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {tagsList.slice(0, 2).map((tag, tIdx) => (
                                    <span key={tIdx} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px]">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="py-1 px-2 font-mono text-zinc-400 text-[10px] truncate">
                              {mod.workshopId || 'Convertido'}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-zinc-300 text-[10px]">
                              {sizeFormatted || '-'}
                            </td>
                            <td className="py-1 px-2 text-center font-mono text-[10px]">
                              {mod.existsOnDisk ? (
                                <span className="inline-flex items-center justify-center gap-1.5 text-emerald-400 font-mono text-[10px]" title="Servidor Activo en Disco">
                                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse"></span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center gap-1.5 text-rose-500 font-mono text-[10px]" title="Carpeta No Encontrada">
                                  <Server className="w-3.5 h-3.5 text-rose-500" />
                                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-center" style={{ textOverflow: 'clip' }}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openFolder(mod.folderPath, mod.name); }}
                                  className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#222] rounded transition-colors"
                                  title="Abrir carpeta en Windows"
                                >
                                  <Folder className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => openSteam(e, effectiveWorkshopId)}
                                  disabled={!effectiveWorkshopId}
                                  className={`p-1 rounded transition-colors ${
                                    effectiveWorkshopId
                                      ? 'text-zinc-400 hover:text-amber-400 hover:bg-[#222] cursor-pointer'
                                      : 'text-zinc-700 opacity-40 cursor-not-allowed'
                                  }`}
                                  title={effectiveWorkshopId ? "Ver en Steam Workshop" : "Sin ID de Steam Workshop"}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(mod.name); }}
                                  className="p-1 text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                                  title="Eliminar de gameinfo.txt y borrar carpeta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ACCORDION ROW */}
                          {isExpanded && (
                            <tr className="bg-[#0a0a0e]">
                              <td colSpan={isQuickSelect ? 8 : 7} className="p-3 border-t border-b border-[#1f1f2a]">
                                <div className="flex flex-col gap-3 bg-[#060608] p-3 rounded border border-[#1f1f28]">
                                  {/* Header Info Row (Thumbnail left, Title/Meta right) */}
                                  <div className="flex flex-col md:flex-row gap-4">
                                    <div className="w-48 h-28 shrink-0 bg-black rounded border border-[#222] overflow-hidden flex items-center justify-center">
                                      {imgSrc ? (
                                        <img src={imgSrc} alt="Preview" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-zinc-600 text-xs font-mono">Sin vista previa</span>
                                      )}
                                    </div>
                                    <div className="flex-1 space-y-2 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <h4 className="font-bold text-white text-sm">{mod.title}</h4>
                                        {effectiveWorkshopId && (
                                          <button
                                            onClick={(e) => openSteam(e, effectiveWorkshopId)}
                                            className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 hover:underline cursor-pointer"
                                          >
                                            <ExternalLink className="w-3 h-3" /> Steam Workshop
                                          </button>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 font-mono">
                                        <span>Carpeta: <strong className="text-zinc-200">{mod.name}</strong></span>
                                        {mod.workshopId && <span className="ml-3">ID: <strong className="text-zinc-200">{mod.workshopId}</strong></span>}
                                        {sizeFormatted && <span className="ml-3">Tamaño: <strong className="text-zinc-200">{sizeFormatted}</strong></span>}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Description Box (Underneath Thumbnail and Title Header) */}
                                  <div
                                    className="bg-[#030304] p-2.5 rounded border border-[#16161e] text-xs text-zinc-300 max-h-60 overflow-y-auto leading-relaxed font-sans"
                                    onClick={(e) => {
                                      const target = e.target.closest('a');
                                      if (target) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const url = target.getAttribute('data-external-url') || target.getAttribute('href');
                                        if (url) {
                                          if (window.api && window.api.openExternalUrl) window.api.openExternalUrl(url);
                                          else window.open(url, '_blank');
                                        }
                                      }
                                    }}
                                  >
                                    {translatedMap[mod.name] || itemDesc || 'Sin descripción.'}
                                  </div>

                                  {/* Action Buttons Row */}
                                  <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a24]">
                                    {itemDesc && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleTranslateMod(mod.name, itemDesc); }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161620] hover:bg-[#20202e] border border-[#2a2a3a] text-[11px] text-zinc-200 font-medium transition-colors cursor-pointer"
                                      >
                                        <Globe className="w-3 h-3 text-sky-400" />
                                        {translatingName === mod.name ? 'Traduciendo...' : (translatedMap[mod.name] ? 'Ver Original' : 'Traducir a Español')}
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openFolder(mod.folderPath, mod.name); }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161620] hover:bg-[#20202e] border border-[#2a2a3a] text-[11px] text-zinc-200 font-medium transition-colors cursor-pointer"
                                    >
                                      <Folder className="w-3 h-3 text-zinc-400" /> Abrir Carpeta en Windows
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: MODS AÑADIDOS MANUALMENTE (LOWER SECTION) */}
          <div className="space-y-1.5 pt-2 border-t border-[#1a1a1a]">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <span>Mods Añadidos Manualmente</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {customMods.length} ENTRADAS LOCALES
              </span>
            </div>

            {customMods.length === 0 ? (
              <div className="dark-card p-3 text-center text-zinc-500 text-[11px] bg-[#0a0a0a] border-[#1e1e1e]">
                Sin mods añadidos manualmente en gameinfo.txt.
              </div>
            ) : (
              <div className="dark-card overflow-hidden bg-[#0a0a0a] border-[#1e1e1e]">
                <table className="w-full text-left text-[11px] border-collapse table-fixed">
                  <thead>
                    <tr className="border-b border-[#1e1e1e] bg-[#0e0e0e] text-[10px] text-zinc-500 font-mono uppercase tracking-wider select-none">
                      {isQuickSelect && (
                        <th className="py-1 px-2 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={allVersusMods.length > 0 && selectedNames.length === allVersusMods.length}
                            onChange={toggleSelectAll}
                            className="cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="py-1 px-2 w-8 text-center">#</th>
                      <th className="py-1 px-2">Nombre de Carpeta en gameinfo.txt</th>
                      <th className="py-1 px-2 w-16">Tipo</th>
                      <th className="py-1 px-2 w-28 text-center">Estado Disco</th>
                      <th className="py-1 px-2 w-36 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]">
                    {filteredCustomMods.map((mod, idx) => {
                      const matched = (workshopMods || []).find(w => w.id === mod.workshopId || w.id === mod.name || (mod.name && mod.name.includes(w.id)));
                      const effectiveWorkshopId = mod.workshopId || matched?.id || (mod.name ? mod.name.match(/\d{5,}/)?.[0] : null);

                      return (
                        <tr key={idx} className={`hover:bg-[#121212] transition-colors ${selectedNames.includes(mod.name) ? 'bg-[#2a0e0e]/40' : ''}`}>
                          {isQuickSelect && (
                            <td
                              className="py-1 px-2 text-center w-8 shrink-0 cursor-pointer"
                              onClick={(e) => toggleSelectMod(mod.name, e)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedNames.includes(mod.name)}
                                onChange={() => {}}
                                className="cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-1 px-2 font-mono text-zinc-600 text-center text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-2 font-mono text-zinc-300 font-medium text-[11px] truncate">
                            {mod.name}
                          </td>
                          <td className="py-1 px-2 font-mono text-zinc-500 text-[10px]">
                            Game
                          </td>
                          <td className="py-1 px-2 text-center font-mono text-[10px]">
                            {mod.existsOnDisk ? (
                              <span className="inline-flex items-center justify-center gap-1.5 text-emerald-400 font-mono text-[10px]" title="Servidor Activo en Disco">
                                <Server className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse"></span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1.5 text-rose-500 font-mono text-[10px]" title="Carpeta No Encontrada">
                                <Server className="w-3.5 h-3.5 text-rose-500" />
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-center" style={{ textOverflow: 'clip' }}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openFolder(mod.folderPath, mod.name)}
                                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#222] rounded transition-colors"
                                title="Abrir carpeta en Windows"
                              >
                                <Folder className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => openSteam(e, effectiveWorkshopId)}
                                disabled={!effectiveWorkshopId}
                                className={`p-1 rounded transition-colors ${
                                  effectiveWorkshopId
                                    ? 'text-zinc-400 hover:text-amber-400 hover:bg-[#222] cursor-pointer'
                                    : 'text-zinc-700 opacity-40 cursor-not-allowed'
                                }`}
                                title={effectiveWorkshopId ? "Ver en Steam Workshop" : "Sin ID de Steam Workshop"}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(mod.name)}
                                className="p-1 text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                                title="Eliminar de gameinfo.txt y borrar carpeta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* CORE SYSTEMS */}
      <div className="pt-2 border-t border-[#1e1e1e] flex flex-wrap gap-1 items-center text-[10px] font-mono text-zinc-500">
        <span className="mr-1 text-zinc-600">CORE:</span>
        {corePaths.map((core, idx) => (
          <span key={idx} className="px-1.5 py-0.2 rounded bg-[#101010] border border-[#1e1e1e] text-zinc-400">
            {core.name}
          </span>
        ))}
      </div>

      {/* CUSTOM DIALOG MODAL */}
      {dialogConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDialogConfig(null)}>
          <div className="dark-card bg-[#0c0c0e] border-[#22222a] max-w-md w-full p-4 space-y-3 shadow-2xl rounded-lg" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1f1f28] pb-2">
              <div className="flex items-center gap-2">
                <span className={`p-1 rounded ${dialogConfig.type === 'confirm' ? 'bg-red-950/60 border border-red-800/60 text-red-400' : 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-400'}`}>
                  {dialogConfig.type === 'confirm' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </span>
                <h3 className="text-sm font-bold text-white">{dialogConfig.title}</h3>
              </div>
              <button onClick={() => setDialogConfig(null)} className="text-zinc-500 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mod Info Box */}
            <div className="flex items-center gap-3 bg-[#060608] border border-[#1c1c24] p-2.5 rounded">
              <div className="w-20 h-12 bg-black border border-[#22222a] rounded overflow-hidden shrink-0 flex items-center justify-center">
                {dialogConfig.img ? (
                  <img src={dialogConfig.img} alt="Thumb" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-4 h-4 text-zinc-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-zinc-100 text-xs truncate">{dialogConfig.modTitle}</div>
                {dialogConfig.modId && <div className="font-mono text-[11px] text-zinc-400 truncate">Workshop ID: {dialogConfig.modId}</div>}
                {dialogConfig.folderName && (
                  <div className="font-mono text-[10px] text-zinc-500 truncate">Carpeta VPK: {dialogConfig.folderName}</div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className={`p-3 rounded border text-xs leading-relaxed ${
              dialogConfig.type === 'confirm' ? 'bg-[#1a0a0a] border-[#3b1717] text-red-300' : 'bg-[#0a1a12] border-[#1a3a2a] text-emerald-300'
            }`}>
              {dialogConfig.message}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-[#1f1f28] flex justify-end gap-2">
              <button
                onClick={() => setDialogConfig(null)}
                className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const cb = dialogConfig.onConfirm;
                  setDialogConfig(null);
                  if (cb) cb();
                }}
                className={`px-4 py-1.5 text-xs font-medium text-white rounded transition-colors cursor-pointer ${
                  dialogConfig.type === 'confirm' ? 'bg-red-900 hover:bg-red-800 border border-red-700' : 'bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46]'
                }`}
              >
                {dialogConfig.confirmText || 'Entendido'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
