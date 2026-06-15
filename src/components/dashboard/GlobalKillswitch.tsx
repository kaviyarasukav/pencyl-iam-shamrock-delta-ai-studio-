import React, { useState } from 'react';
import { AlertOctagon, XCircle, ShieldAlert } from 'lucide-react';

export function GlobalKillswitch() {
  const [isConfirming, setIsConfirming] = useState(false);

  const triggerKillswitch = async () => {
    try {
      // Trigger a Buster Call for a critical global halt (using "GLOBAL" or looping thru tracked assets)
      // Usually Buster Call API expects a symbol, but we can hit an endpoint or broadcast
      const res = await fetch('/api/buster-call/GLOBAL', { method: 'DELETE' });
      if (!res.ok) throw new Error('Buster Call failed');
      setIsConfirming(false);
      alert("GLOBAL KILLSWITCH DEPLOYED. ALL SYSTEMS HALTED.");
    } catch (e) {
      console.error(e);
      alert("Error deploying killswitch. Check backend.");
    }
  };

  return (
    <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.2)] mb-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-red-500/20 rounded-full">
          <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-red-500 tracking-wider">GLOBAL EXPOSURE / KILLSWITCH</h2>
          <p className="text-red-400/80 text-sm">Disables all algos, cancels all open orders, flattens all positions at market.</p>
        </div>
      </div>
      
      {isConfirming ? (
        <div className="flex gap-2">
          <button 
            onClick={() => setIsConfirming(false)}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded font-bold uppercase hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          <button 
            onClick={triggerKillswitch}
            className="px-6 py-2 bg-red-600 text-white rounded font-bold uppercase tracking-widest hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition animate-pulse"
          >
            CONFIRM FLATTEN
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setIsConfirming(true)}
          className="flex items-center gap-2 px-6 py-3 bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition"
        >
          <AlertOctagon className="w-5 h-5" />
          BUSTER CALL
        </button>
      )}
    </div>
  );
}
