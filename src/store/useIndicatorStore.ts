import { create } from 'zustand';
import { IndicatorConfigBase } from '../../shared-contracts/IndicatorConfig';

interface IndicatorState {
  configs: IndicatorConfigBase[];
  isSettingsOpen: boolean;
  
  setConfigs: (configs: IndicatorConfigBase[]) => void;
  updateConfig: (id: string, updates: Partial<IndicatorConfigBase>) => void;
  toggleSettings: () => void;
  fetchConfigs: () => Promise<void>;
  saveConfigs: () => Promise<void>;
}

export const useIndicatorStore = create<IndicatorState>((set, get) => ({
  configs: [],
  isSettingsOpen: false,

  setConfigs: (configs) => set({ configs }),
  
  updateConfig: (id, updates) => set((state) => ({
    configs: state.configs.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),

  fetchConfigs: async () => {
    try {
      const res = await fetch('/api/settings/indicators');
      const data = res.ok ? await res.json() : null;
      if (data) set({ configs: Array.isArray(data) ? data : [] });
    } catch (e) {
      console.error('Failed to fetch indicators', e);
    }
  },

  saveConfigs: async () => {
    try {
      const { configs } = get();
      await fetch('/api/settings/indicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });
    } catch (e) {
      console.error('Failed to save indicators', e);
    }
  }
}));
