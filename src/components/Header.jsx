import React from 'react';
import { RefreshCw, HardDrive, Gamepad2 } from 'lucide-react';

export default function Header({ status, loading, onRefresh }) {
  return (
    <header className="border-b border-[#1e1e1e] bg-[#0a0a0a] px-3 py-1.5 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-[11px]">
        
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-semibold text-zinc-200 tracking-tight">
            L4D2 Mod Manager
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">v1.0</span>
        </div>

        {/* Path Status & Actions */}
        <div className="flex items-center gap-2">
          <div className="dark-card px-2 py-0.5 flex items-center gap-1.5 text-zinc-400 font-mono text-[10px] bg-[#050505]">
            <HardDrive className="w-3 h-3 text-zinc-600 shrink-0" />
            <span className="truncate max-w-[220px]" title={status?.l4d2BasePath}>
              {status?.l4d2BasePath || 'Cargando...'}
            </span>
          </div>

          <span className="badge">
            {status?.exists ? 'DETECTADO' : 'NO DETECTADO'}
          </span>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="dark-card px-2 py-0.5 text-zinc-300 hover:text-white hover:bg-[#181818] flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors text-[10px]"
            title="Recargar"
          >
            <RefreshCw className={`w-3 h-3 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Recargar</span>
          </button>
        </div>

      </div>
    </header>
  );
}
