import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Wallet, Shield, CheckCircle2, XCircle, Zap, User, Percent, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountData {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  brokerId?: string;
  updateTime: number;
  accountType: string;
  permissions: string[];
  balances?: Array<{ asset: string, free: string, locked: string }>;
}

export const AccountDetails = () => {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const res = await fetch('/api/account');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch account');
        }
        const data = await res.json();
        setAccount(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
    const interval = setInterval(fetchAccount, 60000); // Update once a minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !account) {
    return (
      <Card className="border-none shadow-xl bg-card/30 backdrop-blur-md animate-pulse">
        <CardContent className="h-48" />
      </Card>
    );
  }

  if (error || !account) {
    return (
      <Card className="border-none shadow-xl bg-card/30 backdrop-blur-md">
        <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground p-6 text-center">
          <Wallet className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">{error || 'Connect API to see account details'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-xl bg-card/30 backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Account Intelligence</CardTitle>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            <Shield className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary italic uppercase tracking-tighter">{account.accountType}</span>
          </div>
        </div>
        <CardDescription className="text-xs">
          Real-time exchange permissions & tier configuration
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Permission Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <PermissionItem 
            label="Trading" 
            active={account.canTrade} 
            icon={<Zap className={cn("w-3 h-3 shrink-0", account.canTrade ? "text-yellow-400" : "text-muted-foreground")} />} 
          />
          <PermissionItem 
            label="Withdrawal" 
            active={account.canWithdraw} 
            icon={<Activity className={cn("w-3 h-3 shrink-0", account.canWithdraw ? "text-cyan-400" : "text-muted-foreground")} />} 
          />
          <PermissionItem 
            label="Deposits" 
            active={account.canDeposit} 
            icon={<Shield className={cn("w-3 h-3 shrink-0", account.canDeposit ? "text-green-400" : "text-muted-foreground")} />} 
          />
          <PermissionItem 
            label="Margin" 
            active={(account.permissions || []).includes('MARGIN')} 
            icon={<Percent className={cn("w-3 h-3 shrink-0", (account.permissions || []).includes('MARGIN') ? "text-purple-400" : "text-muted-foreground")} />} 
          />
        </div>

        {/* Commissions */}
        <div className="bg-background/40 rounded-lg p-3 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Percent className="w-3 h-3" /> Fee Structure
            </span>
            <span className="text-[10px] text-muted-foreground">Standard Tier</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Maker Fee</div>
              <div className="text-lg font-mono font-bold text-emerald-400">
                {(account.makerCommission / 100).toFixed(3)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Taker Fee</div>
              <div className="text-lg font-mono font-bold text-orange-400">
                {(account.takerCommission / 100).toFixed(3)}%
              </div>
            </div>
          </div>
        </div>

        {/* Spot Wallet Balances */}
        {account.balances && account.balances.length > 0 && (
          <div className="bg-background/40 rounded-lg p-3 border border-white/5 space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Wallet className="w-3" /> Wallet Balances
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                Spot
              </span>
            </div>
            
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
              {account.balances
                .filter(bal => parseFloat(bal.free) > 0 || parseFloat(bal.locked) > 0)
                .map(bal => {
                  const freeVal = parseFloat(bal.free);
                  const lockedVal = parseFloat(bal.locked);
                  return (
                    <div key={bal.asset} className="flex justify-between items-center text-xs py-1 border-b border-zinc-500/10 last:border-0 hover:bg-white/5 px-1 rounded transition-colors">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{bal.asset}</span>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-emerald-400">{freeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                        {lockedVal > 0 && (
                          <div className="text-[9px] text-muted-foreground">
                            locked: {lockedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              {account.balances.filter(bal => parseFloat(bal.free) > 0 || parseFloat(bal.locked) > 0).length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-4">
                  No active asset balance on this Spot account.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Permissions List */}
        <div className="flex flex-wrap gap-1.5">
          {(account.permissions || []).map(p => (
            <span key={p} className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-muted text-muted-foreground border border-white/5 uppercase">
              {p}
            </span>
          ))}
        </div>

        <div className="pt-2 text-[9px] text-center text-muted-foreground italic">
          Last Synced: {new Date(account.updateTime).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

const PermissionItem = ({ label, active, icon }: { label: string, active: boolean, icon: React.ReactNode }) => (
  <div className={cn(
    "flex items-center justify-between p-2 rounded-md border transition-all min-w-0 gap-2",
    active ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-white/5 opacity-60"
  )}>
    <div className="flex items-center gap-2 min-w-0">
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tight truncate">{label}</span>
    </div>
    {active ? (
      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
    ) : (
      <XCircle className="w-3 h-3 text-destructive/50 shrink-0" />
    )}
  </div>
);
