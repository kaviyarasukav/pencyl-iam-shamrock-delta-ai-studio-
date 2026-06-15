import React, { useState, useEffect } from 'react';
import { useExchange } from '@/contexts/ExchangeContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RefreshCw, Leaf, Globe, AlertTriangle, Eye, Activity, Crosshair, Terminal, Menu, X, User, ChevronLeft, Zap, Settings2, CheckCircle2, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { SlideOutPanel } from '@/components/ui/slide-out-panel';
import TradingPanel from './TradingPanel';
import OrderHistory from './OrderHistory';
import PortfolioSummary from './PortfolioSummary';
import SystemLogs from './SystemLogs';
import { useDeltaData } from '../hooks/useDeltaData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Modular Dashboard Widgets
import { MarketOverview } from './dashboard/MarketOverview';
import { MarketStats } from './dashboard/MarketStats';
import { MarketDepth } from './dashboard/MarketDepth';
import { OrderflowSignals } from './dashboard/OrderflowSignals';
import { CVDVisualizer } from './dashboard/CVDVisualizer';
import { PriceChartSection } from './dashboard/PriceChartSection';
import { IndicatorSettings } from './dashboard/IndicatorSettings';
import { ExecutionSettings } from './dashboard/ExecutionSettings';
import { useIndicatorStore } from '../store/useIndicatorStore';
import { StrategyMonitor } from './dashboard/StrategyMonitor';
import { RiskFunnelMonitor } from './dashboard/RiskFunnelMonitor';
import { MarketSentiment } from './dashboard/MarketSentiment';
import { DOMVisualizer } from './dashboard/DOMVisualizer';
import { MacroContext } from './dashboard/MacroContext';
import { StrategySwitcher } from './dashboard/StrategySwitcher';
import { VisualAnalytics } from './dashboard/VisualAnalytics';
import { useMarketDataWS } from '../hooks/useMarketDataWS';
import { usePerformanceConfig } from '../hooks/usePerformanceConfig';

import { AutopilotDashboard } from './dashboard/AutopilotDashboard';
import { GlobalKillswitch } from './dashboard/GlobalKillswitch';
import { AssetRiskOverrides } from './dashboard/AssetRiskOverrides';
import UserSettings from './UserSettings';

import { AccountDetails } from './dashboard/AccountDetails';

type BundleType = 'intel' | 'macro' | 'flow' | 'math' | 'exec' | 'sys' | 'user' | 'auto';

export default function CryptoDashboard() {
  const { api, hasApiKeys, isTestnet } = useExchange();
  const { showToast } = useToast();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [resolution, setResolution] = useState<string>('1h');
  const [busterLoading, setBusterLoading] = useState(false);
  const [activeBundle, setActiveBundle] = useState<BundleType>('intel');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [macroSubPage, setMacroSubPage] = useState<string>('overview');
  const [showBusterConfirm, setShowBusterConfirm] = useState(false);

  const { 
    tickers, 
    klines, 
    trades, 
    volumeSpikes, 
    cvdData, 
    largeOrders, 
    liquidityShifts, 
    optionsFlow,
    optionsSweeps,
    gammaExposure,
    icebergs,
    spoofing,
    strategySignals,
    macroRegime,
    loading, 
    refreshing 
  } = useDeltaData(selectedSymbol, resolution);

  useMarketDataWS(selectedSymbol, resolution);

  const handleBusterCall = async () => {
    setShowBusterConfirm(true);
  };

  const confirmBusterCall = async () => {
    setShowBusterConfirm(false);
    setBusterLoading(true);
    try {
      await api.cancelAllOrders(selectedSymbol);
      showToast(`Buster Call executed: All open orders for ${selectedSymbol} cancelled.`, 'success');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      showToast(`Buster Call failed: ${msg}`, 'error');
    } finally {
      setBusterLoading(false);
    }
  };

  // Ensure selected symbol exists in tickers
  useEffect(() => {
    if (tickers.length > 0) {
      const exists = tickers.some(t => t.symbol === selectedSymbol);
      if (!exists) {
        const hasDefault = tickers.some(t => t.symbol === 'BTCUSDT');
        setSelectedSymbol(hasDefault ? 'BTCUSDT' : tickers[0].symbol);
      }
    }
  }, [tickers, selectedSymbol]);

  const { isMobile } = usePerformanceConfig();

  // Mobile Swipe Gesture State
  const [dragX, setDragX] = useState(0);
  const swipeThreshold = 50;

  useEffect(() => {
    if (dragX > swipeThreshold && !isMobileMenuOpen) {
      setIsMobileMenuOpen(true);
      setDragX(0);
    }
    if (dragX < -swipeThreshold && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      setDragX(0);
    }
  }, [dragX, isMobileMenuOpen]);

  const selectedTicker = tickers.find(t => t.symbol === selectedSymbol);
  const lastKline = klines[klines?.length - 1 || 0];

  const primaryNavItems = [
    { id: 'intel', label: 'Intel', icon: Eye, color: 'text-blue-500' },
    { id: 'macro', label: 'Macro', icon: Globe, color: 'text-indigo-500' },
    { id: 'flow', label: 'Flow', icon: Activity, color: 'text-orange-500' },
    { id: 'exec', label: 'Exec', icon: Crosshair, color: 'text-green-500' },
    { id: 'auto', label: 'Autopilot', icon: Radar, color: 'text-emerald-500' },
  ];

  const secondaryNavItems = [
    { id: 'sys', label: 'System Logs', icon: Terminal, color: 'text-purple-500', desc: 'View backend execution events' },
    { id: 'user', label: 'Settings', icon: User, color: 'text-pink-500', desc: 'Manage API keys & preferences' },
  ];

  const macroTopics = [
    { id: 'overview', label: 'Global Overview' },
    { id: 'yield', label: 'Yield Spreads' },
    { id: 'sentiment', label: 'Sentiment Index' },
    { id: 'options', label: 'Derivatives GEX' },
  ];

  return (
    <div 
      className="flex h-screen bg-background overflow-hidden relative"
      onPointerMove={(e) => {
        if (isMobile && e.buttons === 1) {
          // Detect rudimentary swipe from edge
          if (e.clientX < 30 && !isMobileMenuOpen) setDragX(100);
          if (e.clientX > 200 && isMobileMenuOpen) setDragX(-100);
        }
      }}
    >
      {/* Mobile Swipe Handle / Trigger */}
      <div 
        className="md:hidden fixed left-0 top-0 bottom-0 w-6 z-[60]"
        onPointerDown={() => setDragX(0)}
      />

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border/50 z-[80] md:hidden p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Leaf className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h1 className="text-sm font-black uppercase tracking-tighter">pencyl'iam</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-4 mt-2">Core Modules</div>
                {primaryNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveBundle(item.id as BundleType);
                      setIsMobileMenuOpen(false);
                      if (item.id === 'macro') setMacroSubPage('overview');
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                      activeBundle === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", activeBundle === item.id ? item.color : "")} />
                    <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
                  </button>
                ))}

                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-4 mt-8">System Tools</div>
                {secondaryNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveBundle(item.id as BundleType);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                      activeBundle === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", activeBundle === item.id ? item.color : "")} />
                    <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {showBusterConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/50 shadow-2xl rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 text-destructive mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-lg font-bold uppercase tracking-wider">Confirm Buster Call</h2>
            </div>
            <p className="text-muted-foreground mb-6 text-sm">
              Are you sure you want to cancel ALL open orders for <span className="font-bold text-foreground">{selectedSymbol}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowBusterConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmBusterCall}>
                Execute Buster Call
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Terminal Sidebar Navigation (Desktop) */}
      <aside 
        className={cn(
          "hidden md:flex flex-col bg-card border-r border-border/50 transition-all duration-300 z-50",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-4 border-b border-border/50 h-20">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <Leaf className="w-6 h-6 text-primary-foreground" />
          </div>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none font-brand">pencyl'iam</h1>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Submodel: yqlon</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {isSidebarOpen && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-2 mt-2">Core</div>}
          {primaryNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveBundle(item.id as BundleType)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all group relative",
                activeBundle === item.id 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6 shrink-0", activeBundle === item.id ? item.color : "group-hover:text-foreground")} />
              {isSidebarOpen && (
                <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
              )}
              {activeBundle === item.id && (
                <motion.div 
                  layoutId="activeSideNav"
                  className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                />
              )}
            </button>
          ))}

          <div className="my-4 border-t border-border/50 pt-4" />
          
          {isSidebarOpen && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-2">System</div>}
          {secondaryNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveBundle(item.id as BundleType)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all group relative",
                activeBundle === item.id 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6 shrink-0", activeBundle === item.id ? item.color : "group-hover:text-foreground")} />
              {isSidebarOpen && (
                <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
              )}
              {activeBundle === item.id && (
                <motion.div 
                  layoutId="activeSideNav"
                  className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                />
              )}
            </button>
          ))}

          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidePanelOpen(true)}
              className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-muted text-muted-foreground transition-all mt-2"
              title="More Options"
            >
              <Zap className="w-6 h-6" />
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-border/50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0">
        {!hasApiKeys && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-amber-500 text-xs shadow-sm z-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-bold uppercase tracking-wider">Trading restricted</span>
              <span className="hidden sm:inline">- Add your Delta Exchange keys via Settings to enable live trading features.</span>
            </div>
            <Button size="sm" variant="outline" className="h-6 text-[10px] uppercase font-bold border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black shrink-0 ml-4" onClick={() => setActiveBundle('user')}>
              Configure Settings
            </Button>
          </div>
        )}
        
        {/* Global Status Bar (Header) */}
        <header className="h-16 md:h-20 flex items-center justify-between px-2 md:px-6 bg-card/30 border-b border-border/50 backdrop-blur-md shrink-0 gap-2 overflow-hidden w-full">
          <div className="flex items-center gap-2 md:gap-6 shrink-0 min-w-0">
            {/* Mobile Logo */}
            <div className="md:hidden flex items-center gap-2 pr-2 border-r border-border/50 relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                <Leaf className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-sm font-black tracking-tighter uppercase leading-none font-brand hidden sm:block truncate">pencyl'iam</h1>
            </div>

            <div className="flex flex-col shrink-0 min-w-0 max-w-[120px] md:max-w-none">
              <span className="hidden md:block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Selected Asset</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base md:text-xl font-black tracking-tight truncate">{selectedSymbol}</span>
                <Badge variant="outline" className="hidden sm:inline-flex bg-primary/5 border-primary/20 text-primary font-mono text-[10px]">
                  {selectedTicker?.lastPrice ? `$${parseFloat(selectedTicker.lastPrice).toLocaleString()}` : '---'}
                </Badge>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-4 border-l border-border/50 pl-6 shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">24h Change</span>
                <span className={cn(
                  "text-sm font-bold font-mono",
                  parseFloat(selectedTicker?.priceChangePercent || '0') >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {selectedTicker?.priceChangePercent || '0.00'}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">24h Volume</span>
                <span className="text-sm font-bold font-mono">
                  ${(parseFloat(selectedTicker?.quoteVolume || '0') / 1000000).toFixed(2)}M
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-none snap-x whitespace-nowrap px-1 justify-end min-w-0">
            {isTestnet ? (
              <Badge variant="outline" className="flex shrink-0 px-2 md:px-3 py-1 bg-purple-500/10 border-purple-500/20 text-purple-500 snap-start">
                <span className="text-[10px] font-bold uppercase tracking-wider">Testnet</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="flex shrink-0 px-2 md:px-3 py-1 bg-blue-500/10 border-blue-500/20 text-blue-500 snap-start">
                <span className="text-[10px] font-bold uppercase tracking-wider">Mainnet</span>
              </Badge>
            )}

            {hasApiKeys ? (
              <Badge variant="outline" className="flex shrink-0 px-2 md:px-3 py-1 bg-green-500/10 border-green-500/20 text-green-500 snap-start">
                <CheckCircle2 className="w-3 h-3 mr-1 md:mr-2" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Connected</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="flex shrink-0 px-2 md:px-3 py-1 bg-amber-500/10 border-amber-500/20 text-amber-500 cursor-pointer snap-start" onClick={() => setActiveBundle('user')}>
                <AlertTriangle className="w-3 h-3 mr-1 md:mr-2" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Keys Missing</span>
              </Badge>
            )}
            
            <Badge variant="outline" className="flex shrink-0 px-2 md:px-3 py-1 bg-background/50 border-primary/20 text-primary snap-start">
              <RefreshCw className={cn("w-3 h-3 mr-1 md:mr-2", refreshing && "animate-spin")} />
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Live Feed</span>
              <span className="text-[10px] font-bold uppercase tracking-wider sm:hidden">Live</span>
            </Badge>

            <Button
              variant="outline"
              size="sm"
              className="px-2 md:px-4 text-[10px] uppercase font-bold tracking-wider flex shrink-0 snap-start h-6 md:h-8"
              onClick={() => useIndicatorStore.getState().toggleSettings()}
            >
              Indicators
            </Button>

            <Button 
              variant="destructive" 
              size="sm" 
              className={cn("font-black text-[10px] uppercase tracking-widest gap-1 md:gap-2 shadow-xl shadow-destructive/20 px-2 md:px-4 shrink-0 snap-start h-6 md:h-8", hasApiKeys ? "animate-pulse hover:animate-none" : "opacity-50 cursor-not-allowed")}
              onClick={handleBusterCall}
              disabled={busterLoading || !hasApiKeys}
            >
              <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Buster Call</span>
              <span className="sm:hidden">Buster</span>
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="bg-background/80 hover:bg-primary/10 border-border/50 transition-colors shrink-0 snap-start h-6 w-6 md:h-8 md:w-8"
              onClick={() => setIsSidePanelOpen(true)}
            >
              <Zap className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground hover:text-primary transition-colors" />
            </Button>
          </div>
        </header>

        {/* Global Slide-Out Panel */}
        <SlideOutPanel 
          isOpen={isSidePanelOpen} 
          onClose={() => setIsSidePanelOpen(false)}
          title="Secondary Modules"
          side="right"
        >
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Advanced Tools
            </h3>

            {secondaryNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveBundle(item.id as BundleType);
                  setIsSidePanelOpen(false);
                }}
                className={cn(
                  "w-full text-left flex items-start gap-4 p-4 rounded-xl transition-all border",
                  activeBundle === item.id 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-card border-border/50 hover:bg-muted"
                )}
              >
                <div className={cn("p-2 rounded-lg bg-background shadow-sm", item.color)}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
                    {item.label}
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}

            <div className="mt-8 pt-6 border-t border-border/30">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Quick Actions
              </h3>
              
              <div className="bg-destructive/5 rounded-xl p-4 border border-destructive/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-destructive mb-2 flex items-center gap-2 relative z-10">
                  <AlertTriangle className="w-4 h-4" /> Global Halt
                </h4>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed relative z-10">
                  Cancel all open orders and halt strategies instantly. Use in case of emergency.
                </p>
                <Button 
                  variant="destructive" 
                  className={cn("w-full text-xs font-bold uppercase tracking-wider relative z-10", hasApiKeys ? "shadow-lg shadow-destructive/20" : "opacity-50 cursor-not-allowed")}
                  onClick={() => {
                    if (!hasApiKeys) return;
                    setIsSidePanelOpen(false);
                    handleBusterCall();
                  }}
                  disabled={busterLoading || !hasApiKeys}
                >
                  Confirm Buster Call
                </Button>
              </div>
            </div>
          </div>
        </SlideOutPanel>

        {/* Dynamic Bundle Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 custom-scrollbar relative z-0">
          <div className="mb-6 w-full max-w-7xl mx-auto">
            <PortfolioSummary />
          </div>
          <AnimatePresence mode="wait">
            {activeBundle === 'intel' && (
              <motion.div
                key="intel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col lg:flex-row gap-6 items-start"
              >
                {/* Watchlist Section */}
                <aside className="w-full lg:w-[320px] xl:w-[350px] shrink-0 space-y-6">
                  <MarketOverview 
                    tickers={tickers} 
                    selectedSymbol={selectedSymbol} 
                    onSelectSymbol={setSelectedSymbol} 
                  />
                  <AccountDetails />
                </aside>

                {/* Main Intel Hub */}
                <div className="flex-1 min-w-0 w-full space-y-6">
                  <MarketStats 
                    ticker={selectedTicker} 
                    lastKline={lastKline} 
                  />
                  
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-8 space-y-6 min-w-0">
                      <PriceChartSection 
                        symbol={selectedSymbol}
                        klines={klines}
                        resolution={resolution}
                        onResolutionChange={setResolution}
                        macroState={macroRegime}
                      />
                    </div>
                    <div className="xl:col-span-4 space-y-6 min-w-0">
                      <MarketDepth />
                      <StrategyMonitor 
                        lastKline={lastKline}
                        cvdData={cvdData}
                        macroState={macroRegime}
                      />
                      <RiskFunnelMonitor />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeBundle === 'macro' && (
              <motion.div
                key="macro"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  {/* Macro Details Sub-Navigation for Mobile/Tablet */}
                  {macroSubPage === 'overview' ? (
                    <div className="lg:col-span-12 xl:col-span-10 xl:col-start-2 space-y-6">
                      <div className="md:hidden grid grid-cols-1 gap-3 mb-6">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Macro Layers</h2>
                        {macroTopics.filter(t => t.id !== 'overview').map(topic => (
                          <button
                            key={topic.id}
                            onClick={() => setMacroSubPage(topic.id)}
                            className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl hover:bg-muted transition-colors group"
                          >
                            <span className="text-sm font-bold uppercase tracking-wider">{topic.label}</span>
                            <Globe className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </button>
                        ))}
                      </div>

                      <MacroContext macroState={macroRegime} />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <MarketSentiment score={macroRegime?.metrics?.sentiment || 0} />
                        <Card className="border-border/50 bg-card shadow-lg p-6">
                          <CardHeader className="p-0 mb-4">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Macro Fundamentals</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <p className="text-sm text-foreground mb-4">Tracking global liquidity and structural trends impacting crypto volatility.</p>
                            <div className="space-y-3 text-[10px] font-mono">
                              <div className="flex justify-between border-b pb-2 border-border/50">
                                <span className="text-muted-foreground">BTC Top Trader L/S</span>
                                <span className="text-primary font-bold">{macroRegime?.metrics?.cot_long_short_ratio || '1.00'}</span>
                              </div>
                              <div className="flex justify-between border-b pb-2 border-border/50">
                                <span className="text-muted-foreground">US Dollar DXY Corr</span>
                                <span className={cn("font-bold", (macroRegime?.metrics?.dxy_correlation || 0) < -0.5 ? "text-green-500" : "text-orange-500")}>
                                  {macroRegime?.metrics?.dxy_correlation || '0.00'}
                                </span>
                              </div>
                              <div className="flex justify-between border-b pb-2 border-border/50">
                                <span className="text-muted-foreground">Hedge Funding Rate</span>
                                <span className="text-primary font-bold">{((macroRegime?.metrics?.funding_rate || 0) * 100).toFixed(4)}%</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="lg:col-span-12 xl:col-span-10 xl:col-start-2">
                       <Button 
                         variant="ghost" 
                         className="mb-4 text-xs font-bold uppercase tracking-widest gap-2"
                         onClick={() => setMacroSubPage('overview')}
                       >
                         <ChevronLeft className="w-4 h-4" /> Back to Overview
                       </Button>
                       
                       <div className="bg-card/50 border border-border/50 rounded-2xl p-6 min-h-[450px]">
                          <div className="flex items-center gap-2 mb-6">
                            <Globe className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold uppercase tracking-widest">
                              {macroTopics.find(t => t.id === macroSubPage)?.label}
                            </h3>
                          </div>
                          
                          {macroSubPage === 'yield' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Current 10Y Yield</p>
                                  <p className="text-2xl font-mono font-bold text-primary">{macroRegime?.metrics?.yield_price || '0.00'}%</p>
                                </div>
                                <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Yield Spread (2Y/10Y)</p>
                                  <p className={cn("text-2xl font-mono font-bold", (macroRegime?.metrics?.yield_spread || 0) < 0 ? "text-red-500" : "text-green-500")}>
                                    {((macroRegime?.metrics?.yield_spread || 0) * 100).toFixed(0)} BPS
                                  </p>
                                </div>
                                <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Yield Z-Score</p>
                                  <p className="text-2xl font-mono font-bold">{macroRegime?.metrics?.yield_z_score || '0.00'}</p>
                                </div>
                              </div>
                              <div className="p-6 bg-muted/20 border border-border/50 rounded-xl text-sm leading-relaxed text-muted-foreground">
                                <p className="font-bold text-foreground mb-2 uppercase tracking-wider">Yield Environment Analysis</p>
                                {((macroRegime?.metrics?.yield_spread || 0) < 0) ? 
                                  "The yield curve is currently INVERTED. Historically, this signals recessionary risk and often leads to RISK-OFF behavior in crypto markets. Monitor for 'un-inversion' which typically precedes major volatility." : 
                                  "The yield curve is in a normal state. Positive term premium supports a stable macro environment for risk assets."
                                }
                              </div>
                            </div>
                          )}

                          {macroSubPage === 'sentiment' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <MarketSentiment score={macroRegime?.metrics?.sentiment || 0} />
                                <div className="bg-card border border-border/50 rounded-xl p-6 flex flex-col justify-center">
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4 tracking-widest">Sentiment Breakdown</h4>
                                  <div className="space-y-4">
                                    <div className="flex justify-between items-center text-xs">
                                      <span>News Sentiment</span>
                                      <span className="font-mono text-primary">{(macroRegime?.metrics?.sentiment || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1">
                                      <div className="bg-primary h-1 rounded-full" style={{ width: `${((macroRegime?.metrics?.sentiment || 0) + 1) * 50}%` }} />
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span>Put/Call Skew</span>
                                      <span className="font-mono text-primary">{macroRegime?.metrics?.put_call_ratio || '1.00'}</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1">
                                      <div className="bg-primary h-1 rounded-full" style={{ width: `${Math.min((macroRegime?.metrics?.put_call_ratio || 1) / 2 * 100, 100)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {macroSubPage === 'options' && (
                            <div className="space-y-6">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Implied Volatility (IV)</p>
                                    <p className="text-2xl font-mono font-bold text-primary">{macroRegime?.metrics?.implied_volatility || '00.0'}%</p>
                                  </div>
                                  <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Market Gamma (Estimate)</p>
                                    <p className="text-2xl font-mono font-bold text-green-500">Positive</p>
                                  </div>
                               </div>
                               <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-start gap-3">
                                 <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                 <p>Gamma exposure analytics are currently derived from CBOE BTC Index options. Detailed GEX profiles require higher-tier Deribit API access. Using VIX and PCR as substitutes.</p>
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeBundle === 'flow' && (
              <motion.div
                key="flow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8">
                      <OrderflowSignals 
                        symbol={selectedSymbol}
                        trades={trades}
                        volumeSpikes={volumeSpikes}
                        largeOrders={largeOrders}
                        liquidityShifts={liquidityShifts}
                        optionsFlow={optionsFlow}
                        optionsSweeps={optionsSweeps}
                        gammaExposure={gammaExposure}
                        icebergs={icebergs}
                        spoofing={spoofing}
                        strategySignals={strategySignals}
                      />
                  </div>
                    <div className="lg:col-span-4 space-y-6">
                      <DOMVisualizer />
                      <MarketDepth />
                      <CVDVisualizer cvdData={cvdData} />
                    </div>
                </div>
              </motion.div>
            )}

            {activeBundle === 'exec' && (
              <motion.div
                key="exec"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                <div className="lg:col-span-4 space-y-6 min-w-0">
                  <StrategySwitcher />
                  <TradingPanel 
                    symbol={selectedSymbol} 
                    currentPrice={trades?.[0]?.price || selectedTicker?.lastPrice || '0'} 
                  />
                </div>
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <VisualAnalytics symbol={selectedSymbol} />
                  <Tabs defaultValue="history" className="w-full bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-4 shadow-xl">
                    <TabsList className="w-full justify-start border-b border-border/50 rounded-none bg-transparent p-0 mb-4 h-auto">
                      <TabsTrigger 
                        value="history" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-xs font-bold uppercase tracking-wider"
                      >
                        Order History
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="history" className="mt-0">
                      <OrderHistory symbol={selectedSymbol} />
                    </TabsContent>
                  </Tabs>
                </div>
              </motion.div>
            )}

            {activeBundle === 'auto' && (
              <motion.div
                key="auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="rounded-2xl bg-emerald-950/20 border border-emerald-900/30 p-4 md:p-6 flex flex-col md:flex-row items-center justify-between shadow-[0_0_30px_rgba(16,185,129,0.05)] text-center md:text-left gap-4 md:gap-0">
                    <div>
                        <h2 className="text-lg md:text-xl font-black uppercase text-emerald-400 tracking-widest flex items-center justify-center md:justify-start gap-2">
                             <Radar className="w-5 h-5 md:w-6 h-6 animate-pulse" /> Autonomous Trading Supervisor
                        </h2>
                        <p className="text-xs md:text-sm text-emerald-500/70 mt-1 font-mono">Manage automated execution strategies, MTF conviction pipelines, and autonomous order routers.</p>
                    </div>
                </div>

                <GlobalKillswitch />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-6">
                        <AutopilotDashboard />
                    </div>
                    <div className="lg:col-span-4 space-y-6">
                        <AssetRiskOverrides />
                        <ExecutionSettings />
                        <RiskFunnelMonitor />
                    </div>
                </div>
              </motion.div>
            )}

            {activeBundle === 'sys' && (
              <motion.div
                key="sys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <SystemLogs />
              </motion.div>
            )}

            {activeBundle === 'user' && (
              <motion.div
                key="user"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <UserSettings />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 flex items-center justify-around p-2 pb-4 shadow-lg">
        {primaryNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveBundle(item.id as BundleType)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-lg transition-all relative",
              activeBundle === item.id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("w-5 h-5 mb-1", activeBundle === item.id ? item.color : "")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            {activeBundle === item.id && (
              <motion.div 
                layoutId="activeNavMobile"
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
              />
            )}
          </button>
        ))}
        
        <button
          onClick={() => setIsSidePanelOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center p-2 rounded-lg transition-all relative",
            secondaryNavItems.some(item => item.id === activeBundle)
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Zap className={cn("w-5 h-5 mb-1", secondaryNavItems.some(item => item.id === activeBundle) ? "text-primary" : "")} />
          <span className="text-[10px] font-bold uppercase tracking-wider">More</span>
          {secondaryNavItems.some(item => item.id === activeBundle) && (
            <motion.div 
              layoutId="activeNavMobile"
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
            />
          )}
        </button>
      </nav>

      <IndicatorSettings />
    </div>
  );
}
