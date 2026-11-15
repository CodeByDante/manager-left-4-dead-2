import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import WorkshopMods from './components/WorkshopMods.jsx';
import GameinfoMods from './components/GameinfoMods.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('workshop');
  const [status, setStatus] = useState(null);
  const [workshopMods, setWorkshopMods] = useState([]);
  const [gameinfo, setGameinfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let statusRes, workshopRes, gameinfoRes;

      if (window.api) {
        statusRes = await window.api.getStatus();
        workshopRes = await window.api.getWorkshopMods();
        gameinfoRes = await window.api.getGameinfoMods();
      } else {
        [statusRes, workshopRes, gameinfoRes] = await Promise.all([
          fetch('/api/status').then(r => r.json()),
          fetch('/api/workshop').then(r => r.json()),
          fetch('/api/gameinfo').then(r => r.json())
        ]);
      }

      setStatus(statusRes);
      setGameinfo(gameinfoRes);

      const convertedMods = gameinfoRes?.convertedMods || [];
      const customMods = gameinfoRes?.customMods || [];
      const activeVersusMods = [...convertedMods, ...customMods];

      const convertedIds = new Set(
        activeVersusMods.map(m => m.workshopId || (m.name ? (m.name.match(/\d{5,}/)?.[0]) : null)).filter(Boolean)
      );

      const rawWorkshop = workshopRes.mods || [];
      const filteredWorkshop = rawWorkshop.filter(w => {
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

      setWorkshopMods(filteredWorkshop);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('No se pudieron obtener los datos locales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 flex flex-col font-sans">
      {/* Header */}
      <Header status={status} loading={loading} onRefresh={fetchData} />

      {/* Error Alert */}
      {error && (
        <div className="max-w-6xl mx-auto w-full px-3 pt-2">
          <div className="dark-card p-2 text-zinc-400 text-[11px] bg-[#0d0d0d] border-[#222222]">
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content & Tabs */}
      <main className="max-w-6xl mx-auto w-full px-3 py-2 flex-1 space-y-2">
        
        {/* Navigation Tabs - Strict Monochrome */}
        <div className="flex items-center gap-1 border-b border-[#1e1e1e] pb-px text-[11px]">
          <button
            onClick={() => setActiveTab('workshop')}
            className={`px-3 py-1 font-medium rounded-t transition-all border-t border-x cursor-pointer ${
              activeTab === 'workshop'
                ? 'bg-[#0d0d0d] text-zinc-100 border-[#1e1e1e] border-b-[#0d0d0d] -mb-px'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-[#0a0a0a]'
            }`}
          >
            Workshop Mods ({workshopMods.length})
          </button>

          <button
            onClick={() => setActiveTab('gameinfo')}
            className={`px-3 py-1 font-medium rounded-t transition-all border-t border-x cursor-pointer ${
              activeTab === 'gameinfo'
                ? 'bg-[#0d0d0d] text-zinc-100 border-[#1e1e1e] border-b-[#0d0d0d] -mb-px'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-[#0a0a0a]'
            }`}
          >
            gameinfo.txt Mods ({gameinfo?.customMods?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'workshop' && (
            <WorkshopMods mods={workshopMods} loading={loading} />
          )}

          {activeTab === 'gameinfo' && (
            <GameinfoMods gameinfo={gameinfo} loading={loading} onRefresh={fetchData} workshopMods={workshopMods} />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] bg-[#070707] py-1.5 px-3 text-center text-[10px] font-mono text-zinc-600 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span>L4D2 Mod Manager</span>
        <span>Monochrome Black Mode</span>
      </footer>
    </div>
  );
}
