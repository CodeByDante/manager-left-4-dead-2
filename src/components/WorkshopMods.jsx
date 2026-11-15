import React, { useState } from 'react';
import { Search, ExternalLink, ImageOff, Folder, X, ChevronsUpDown, ArrowUp, ArrowDown, ArrowRight, CheckCircle2, AlertTriangle, CheckSquare, Square } from 'lucide-react';

export default function WorkshopMods({ mods, loading, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMod, setSelectedMod] = useState(null);
  const [sortKey, setSortKey] = useState('title'); // 'title' | 'size' | 'id'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [convertingId, setConvertingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dialogConfig, setDialogConfig] = useState(null);

  // Selección Rápida State
  const [isQuickSelect, setIsQuickSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkConverting, setIsBulkConverting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

  const filteredMods = mods.filter(mod =>
    mod.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mod.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMods = [...filteredMods].sort((a, b) => {
    let valA, valB;
    if (sortKey === 'title') {
      valA = (a.title || '').toLowerCase();
      valB = (b.title || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else if (sortKey === 'size') {
      valA = a.sizeBytes || 0;
      valB = b.sizeBytes || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    } else if (sortKey === 'id') {
      valA = (a.id || '').toLowerCase();
      valB = (b.id || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  const handleHeaderSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const cycleSortKey = () => {
    if (sortKey === 'title') setSortKey('size');
    else if (sortKey === 'size') setSortKey('id');
    else setSortKey('title');
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedMods.length && sortedMods.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedMods.map(m => m.id));
    }
  };

  const toggleSelectMod = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const executeBulkConvert = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkConverting(true);
    const selectedMods = sortedMods.filter(m => selectedIds.includes(m.id));

    for (let i = 0; i < selectedMods.length; i++) {
      const mod = selectedMods[i];
      setBulkProgress(`Convertidos ${i + 1}/${selectedMods.length}...`);
      try {
        if (window.api && window.api.convertWorkshopModToVersus) {
          await window.api.convertWorkshopModToVersus({
            id: mod.id,
            title: mod.title,
            filename: mod.filename,
            fullPath: mod.fullPath
          });
        } else {
          await fetch('/api/convert-mod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: mod.id,
              title: mod.title,
              filename: mod.filename,
              fullPath: mod.fullPath
            })
          });
        }
      } catch (err) {
        console.error('Error al convertir mod en lote:', mod.id, err);
      }
    }

    setIsBulkConverting(false);
    setBulkProgress(null);
    setSelectedIds([]);
    setIsQuickSelect(false);
    if (onRefresh) onRefresh();
  };

  const handleOpenFolder = (e, mod) => {
    e.stopPropagation();
    if (window.api && window.api.openFileLocation) {
      window.api.openFileLocation(mod.fullPath);
    }
  };

  const handleOpenSteam = (e, mod) => {
    e.stopPropagation();
    const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.id}`;
    if (window.api && window.api.openExternalUrl) {
      window.api.openExternalUrl(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const promptConvert = (e, mod) => {
    e.stopPropagation();
    setDialogConfig({
      type: 'confirm',
      title: '¿Convertir Mod a Versus VPK?',
      modTitle: mod.title,
      modId: mod.id,
      folderName: mod.filename,
      img: mod.thumbnailUrl,
      requiredItems: mod.requiredItems || [],
      message: `¿Deseas convertir "${mod.title}" a Versus VPK (pak01_dir.vpk)?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: () => executeConvert(mod)
    });
  };

  const executeConvert = async (mod) => {
    setConvertingId(mod.id);
    setNotice(null);
    try {
      let res;
      if (window.api && window.api.convertWorkshopModToVersus) {
        res = await window.api.convertWorkshopModToVersus({
          id: mod.id,
          title: mod.title,
          filename: mod.filename,
          fullPath: mod.fullPath
        });
      } else {
        const resp = await fetch('/api/convert-mod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mod.id,
            title: mod.title,
            filename: mod.filename,
            fullPath: mod.fullPath
          })
        });
        res = await resp.json();
      }

      if (res && res.success) {
        setDialogConfig(null);
        if (onRefresh) onRefresh();
      } else {
        setDialogConfig({
          type: 'error',
          title: 'Error al Convertir Mod',
          modTitle: mod.title,
          modId: mod.id,
          img: mod.thumbnailUrl,
          message: 'Error al convertir el mod: ' + (res?.error || 'Error desconocido.')
        });
      }
    } catch (err) {
      setDialogConfig({
        type: 'error',
        title: 'Error al Convertir Mod',
        modTitle: mod.title,
        modId: mod.id,
        img: mod.thumbnailUrl,
        message: 'Error al convertir el mod: ' + err.message
      });
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="space-y-2">
      
      {/* Conversion Banner Alert */}
      {notice && (
        <div className="p-2 text-[11px] font-mono bg-[#0f1d13] border border-[#1e4627] text-emerald-300 rounded flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-300 p-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-zinc-200">
            Workshop Mods
          </span>
          <span className="badge">
            {mods.length} INSTALADOS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Select & Bulk Convert */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsQuickSelect(prev => !prev);
                if (isQuickSelect) setSelectedIds([]);
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
                onClick={executeBulkConvert}
                disabled={selectedIds.length === 0 || isBulkConverting}
                className="px-2.5 py-1 text-[11px] font-mono font-medium bg-[#0d0d0d] border border-[#222222] text-zinc-300 hover:text-white hover:border-[#383838] rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                title="Convertir mods seleccionados a Versus VPK"
              >
                <ArrowRight className={`w-3.5 h-3.5 text-zinc-400 ${isBulkConverting ? 'animate-pulse' : ''}`} />
                <span>
                  {isBulkConverting ? (bulkProgress || 'Convertidos...') : `Convertir (${selectedIds.length})`}
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
              placeholder="Buscar mod por título o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded pl-6 pr-2 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#333333] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="dark-card h-8 animate-pulse bg-[#101010]"></div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sortedMods.length === 0 && (
        <div className="dark-card p-4 text-center text-zinc-500 text-[11px]">
          No se encontraron mods.
        </div>
      )}

      {/* ULTRA COMPACT MONOCHROME TABLE WITH TITLES & DESCRIPTIONS */}
      {!loading && sortedMods.length > 0 && (
        <div className="dark-card overflow-hidden bg-[#0a0a0a] border-[#1e1e1e]">
          <table className="w-full text-left text-[11px] border-collapse table-fixed">
            <thead>
              <tr className="border-b border-[#1e1e1e] bg-[#0e0e0e] text-[10px] text-zinc-500 font-mono uppercase tracking-wider select-none">
                {isQuickSelect && (
                  <th className="py-1 px-2 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={sortedMods.length > 0 && selectedIds.length === sortedMods.length}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-1 px-2 w-10 text-center">Img</th>
                <th
                  className="py-1 px-2 cursor-pointer hover:text-zinc-200 transition-colors"
                  onClick={() => handleHeaderSort('title')}
                  title="Ordenar por Título"
                >
                  <div className="flex items-center gap-1">
                    <span>Título del Mod / Descripción</span>
                    {sortKey === 'title' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-zinc-300" /> : <ArrowDown className="w-2.5 h-2.5 text-zinc-300" />
                    )}
                  </div>
                </th>
                <th
                  className="py-1 px-2 w-28 cursor-pointer hover:text-zinc-200 transition-colors"
                  onClick={() => handleHeaderSort('id')}
                  title="Ordenar por Workshop ID"
                >
                  <div className="flex items-center gap-1">
                    <span>Workshop ID</span>
                    {sortKey === 'id' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-zinc-300" /> : <ArrowDown className="w-2.5 h-2.5 text-zinc-300" />
                    )}
                  </div>
                </th>
                <th
                  className="py-1 px-2 w-20 text-right cursor-pointer hover:text-zinc-200 transition-colors"
                  onClick={() => handleHeaderSort('size')}
                  title="Ordenar por Tamaño"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Tamaño</span>
                    {sortKey === 'size' && (
                      sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-zinc-300" /> : <ArrowDown className="w-2.5 h-2.5 text-zinc-300" />
                    )}
                  </div>
                </th>
                <th className="py-1 px-2 w-28 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {sortedMods.map(mod => (
                <tr
                  key={mod.id}
                  onClick={() => setSelectedMod(mod)}
                  className={`hover:bg-[#121212] transition-colors cursor-pointer group ${selectedIds.includes(mod.id) ? 'bg-[#0f172a]/50' : ''}`}
                >
                  {isQuickSelect && (
                    <td
                      className="py-1 px-2 text-center w-8 shrink-0 cursor-pointer"
                      onClick={(e) => toggleSelectMod(mod.id, e)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(mod.id)}
                        onChange={() => {}}
                        className="cursor-pointer"
                      />
                    </td>
                  )}
                  {/* Thumbnail */}
                  <td className="py-1 px-2 text-center w-10 shrink-0">
                    <div className="w-9 h-5 bg-[#000000] rounded border border-[#222222] overflow-hidden mx-auto flex items-center justify-center shrink-0">
                      {mod.hasThumbnail ? (
                        <img
                          src={mod.thumbnailUrl}
                          alt={mod.id}
                          className="mod-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <ImageOff className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* Title & Description Snippet */}
                  <td className="py-1 px-2 overflow-hidden">
                    <div className="font-medium text-zinc-200 group-hover:text-white truncate">
                      {mod.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {(mod.description || '').replace(/\[[^\]]+\]/g, '').replace(/<[^>]+>/g, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()}
                    </div>
                  </td>

                  {/* ID */}
                  <td className="py-1 px-2 font-mono text-zinc-400 text-[10px] truncate">
                    {mod.id}
                  </td>

                  {/* Size */}
                  <td className="py-1 px-2 font-mono text-right text-zinc-400 text-[10px]">
                    {mod.sizeFormatted}
                  </td>

                  {/* Actions */}
                  <td className="py-1 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => promptConvert(e, mod)}
                        disabled={convertingId === mod.id}
                        className="text-zinc-400 hover:text-zinc-100 p-0.5"
                        title="Convertir a Versus VPK (pak01_dir.vpk)"
                      >
                        <ArrowRight className={`w-3 h-3 ${convertingId === mod.id ? 'animate-pulse text-amber-300' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleOpenFolder(e, mod)}
                        className="text-zinc-600 hover:text-zinc-300 p-0.5"
                        title="Abrir carpeta local"
                      >
                        <Folder className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleOpenSteam(e, mod)}
                        className="text-zinc-600 hover:text-zinc-300 p-0.5"
                        title="Ver en Steam Workshop"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MOD DETAIL MODAL */}
      {selectedMod && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedMod(null)}
        >
          <div
            className="dark-card bg-[#0a0a0a] border-[#222222] max-w-lg w-full p-4 space-y-3 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#1e1e1e] pb-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  {selectedMod.title}
                </h3>
                <p className="text-[10px] font-mono text-zinc-500">
                  ID: {selectedMod.id} • {selectedMod.sizeFormatted} • {selectedMod.filename}
                </p>
              </div>
              <button
                onClick={() => setSelectedMod(null)}
                className="text-zinc-500 hover:text-zinc-200 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail Preview */}
            {selectedMod.hasThumbnail && (
              <div className="aspect-video w-full bg-black rounded border border-[#1e1e1e] overflow-hidden max-h-48 flex items-center justify-center">
                <img
                  src={selectedMod.thumbnailUrl}
                  alt={selectedMod.title}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Description Text */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-500">
                Descripción de la Workshop:
              </span>
              <div
                className="bg-[#050505] p-2.5 rounded border border-[#1a1a1a] text-[11px] text-zinc-300 max-h-48 overflow-y-auto font-sans leading-relaxed"
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
                dangerouslySetInnerHTML={{
                  __html: (function(text) {
                    if (!text) return 'Sin descripción disponible.';
                    let cleaned = text;
                    cleaned = cleaned.replace(/\[h[1-6]\]([\s\S]*?)\[\/h[1-6]\]/gi, '<strong class="block text-white font-bold mt-1 text-xs">$1</strong>');
                    cleaned = cleaned.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
                    cleaned = cleaned.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
                    cleaned = cleaned.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
                    cleaned = cleaned.replace(/\[quote.*?\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="border-l-2 border-sky-500 pl-2 text-zinc-400 my-1 font-sans">$1</blockquote>');
                    cleaned = cleaned.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre class="bg-black/60 p-1.5 rounded font-mono text-[10px] my-1">$1</pre>');
                    cleaned = cleaned.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (m, url, label) => `<a href="${url}" data-external-url="${url}" class="text-sky-400 underline font-medium hover:text-sky-300 transition-colors" target="_blank">${label}</a>`);
                    cleaned = cleaned.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (m, url) => `<a href="${url}" data-external-url="${url}" class="text-sky-400 underline font-medium hover:text-sky-300 transition-colors" target="_blank">${url}</a>`);
                    cleaned = cleaned.replace(/\[img\][\s\S]*?\[\/img\]/gi, '');
                    cleaned = cleaned.replace(/\[list\]/gi, '').replace(/\[\/list\]/gi, '');
                    cleaned = cleaned.replace(/\[\*\]/gi, '• ');
                    cleaned = cleaned.replace(/\[hr\]\[\/hr\]|\[hr\]/gi, '<hr class="border-[#222] my-2" />');
                    cleaned = cleaned.replace(/\[table\][\s\S]*?\[\/table\]/gi, '');
                    cleaned = cleaned.replace(/(?<!href=["'])(https?:\/\/[^\s\)\>\]]+)/gi, (m, url) => {
                      let cleanUrl = url.replace(/[\.\)]+$/, '');
                      const rest = url.slice(cleanUrl.length);
                      return `<a href="${cleanUrl}" data-external-url="${cleanUrl}" class="text-sky-400 underline font-medium hover:text-sky-300 transition-colors" target="_blank">${cleanUrl}</a>${rest}`;
                    });
                    cleaned = cleaned.replace(/\n/g, '<br />');
                    return cleaned;
                  })(selectedMod.description)
                }}
              />
            </div>

            {/* Requirements Section in Detail Modal */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-500">
                <span>Requisitos del Workshop:</span>
                {selectedMod.requiredItems && selectedMod.requiredItems.length > 0 ? (
                  selectedMod.requiredItems.some(r => !r.isInstalled) ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-400 font-mono">
                      FALTAN SUSCRIPCIONES ({selectedMod.requiredItems.filter(r => !r.isInstalled).length})
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-mono">
                      TODOS INSTALADOS
                    </span>
                  )
                ) : (
                  <span className="text-[10px] text-zinc-600 font-mono">
                    NINGUNO REQUERIDO
                  </span>
                )}
              </div>

              <div className="space-y-1 max-h-28 overflow-y-auto">
                {selectedMod.requiredItems && selectedMod.requiredItems.length > 0 ? (
                  selectedMod.requiredItems.map((req) => (
                    <div
                      key={req.id}
                      className={`flex items-center justify-between gap-2 p-1.5 rounded text-xs border ${
                        req.isInstalled
                          ? 'bg-[#08140e] border-[#163824] text-emerald-300'
                          : 'bg-[#1a0a0a] border-[#450a0a] text-red-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <span className="font-bold">{req.isInstalled ? '✓' : '⚠️'}</span>
                        <div className="truncate">
                          <span className="font-semibold">{req.title}</span>
                          <span className="font-mono text-[10px] text-zinc-500 ml-1.5">(ID: {req.id})</span>
                        </div>
                      </div>

                      <div>
                        {req.isInstalled ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                            Suscrito
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${req.id}`;
                              if (window.api && window.api.openExternalUrl) window.api.openExternalUrl(url);
                              else window.open(url, '_blank');
                            }}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 cursor-pointer flex items-center gap-1"
                          >
                            <span>Falta suscripción (Steam ↗)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-zinc-500 font-mono bg-[#050505] border border-[#1a1a1a] p-1.5 rounded text-center">
                    ✓ Este mod no requiere otros addons adicionales de Steam Workshop.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-[#1e1e1e] flex items-center justify-end gap-2">
              <button
                onClick={(e) => handleOpenFolder(e, selectedMod)}
                className="dark-card px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-[#181818] cursor-pointer flex items-center gap-1.5"
              >
                <Folder className="w-3.5 h-3.5 text-zinc-500" />
                <span>Abrir Carpeta</span>
              </button>

              <button
                onClick={(e) => handleOpenSteam(e, selectedMod)}
                className="dark-card px-3 py-1.5 text-xs font-mono text-zinc-100 bg-[#161616] hover:bg-[#222222] cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                <span>Steam Workshop</span>
              </button>
            </div>

          </div>
        </div>
      {/* CUSTOM DIALOG MODAL */}
      {dialogConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDialogConfig(null)}>
          <div className="dark-card bg-[#0c0c0e] border-[#22222a] max-w-lg w-full p-5 space-y-4 shadow-2xl rounded-xl" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1f1f28] pb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-white">{dialogConfig.title}</h3>
              </div>
              <button onClick={() => setDialogConfig(null)} className="text-zinc-500 hover:text-zinc-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mod Info Box */}
            <div className="flex items-center gap-3.5 bg-[#060608] border border-[#1c1c24] p-3 rounded-lg">
              <div className="w-28 h-16 bg-black border border-[#22222a] rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                {dialogConfig.img ? (
                  <img src={dialogConfig.img} alt="Thumb" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-5 h-5 text-zinc-600" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-bold text-zinc-100 text-sm truncate">{dialogConfig.modTitle}</div>
                {dialogConfig.modId && <div className="font-mono text-xs text-zinc-400 truncate">Workshop ID: {dialogConfig.modId}</div>}
                {dialogConfig.folderName && (
                  <div className="font-mono text-[11px] text-zinc-500 truncate">Carpeta VPK: {dialogConfig.folderName}</div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="p-3.5 rounded-lg border text-xs leading-relaxed font-medium bg-[#0a1a12] border-[#1a3a2a] text-emerald-300">
              {dialogConfig.message}
            </div>

            {/* Requirements Section */}
            <div className="border-t border-[#1f1f28] pt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                <span>Requisitos del Workshop:</span>
                {dialogConfig.requiredItems && dialogConfig.requiredItems.length > 0 ? (
                  dialogConfig.requiredItems.some(r => !r.isInstalled) ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-400 font-mono">
                      FALTAN SUSCRIPCIONES
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-mono">
                      TODOS INSTALADOS
                    </span>
                  )
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono">
                    NINGUNO REQUERIDO
                  </span>
                )}
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {dialogConfig.requiredItems && dialogConfig.requiredItems.length > 0 ? (
                  dialogConfig.requiredItems.map((req) => (
                    <div
                      key={req.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded text-xs border ${
                        req.isInstalled
                          ? 'bg-[#08140e] border-[#163824] text-emerald-300'
                          : 'bg-[#1a0a0a] border-[#450a0a] text-red-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <span className="font-bold">{req.isInstalled ? '✓' : '⚠️'}</span>
                        <div className="truncate">
                          <span className="font-semibold">{req.title}</span>
                          <span className="font-mono text-[10px] text-zinc-500 ml-1.5">(ID: {req.id})</span>
                        </div>
                      </div>

                      <div>
                        {req.isInstalled ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                            Suscrito
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `https://steamcommunity.com/sharedfiles/filedetails/?id=${req.id}`;
                              if (window.api && window.api.openExternalUrl) window.api.openExternalUrl(url);
                              else window.open(url, '_blank');
                            }}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 cursor-pointer flex items-center gap-1"
                          >
                            <span>Falta suscripción (Steam ↗)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-zinc-500 font-mono bg-[#08080a] border border-[#18181f] p-2 rounded text-center">
                    ✓ Este mod no requiere otros addons adicionales de Steam Workshop.
                  </div>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="pt-2.5 border-t border-[#1f1f28] flex justify-end gap-2.5">
              {dialogConfig.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setDialogConfig(null)}
                    className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-white hover:bg-[#181818] border border-[#27272a] rounded-md transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const cb = dialogConfig.onConfirm;
                      setDialogConfig(null);
                      if (cb) cb();
                    }}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 rounded-md transition-colors cursor-pointer shadow-lg"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDialogConfig(null)}
                  className="px-5 py-2 text-xs font-medium text-white bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] rounded-md transition-colors cursor-pointer"
                >
                  {dialogConfig.confirmText || 'Entendido'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
