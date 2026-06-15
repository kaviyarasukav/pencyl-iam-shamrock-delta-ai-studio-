import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from './Toast';
import { Save, Key, Shield, Globe, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useExchange } from '@/contexts/ExchangeContext';
import { AccountDetails } from './dashboard/AccountDetails';

export default function UserSettings() {
  const { showToast } = useToast();
  const { refreshSettings, hasApiKeys } = useExchange();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);
  
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasSecretKey, setHasSecretKey] = useState(false);

  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (hasApiKey && hasSecretKey && !useTestnet) {
      fetchTransactions();
    }
  }, [hasApiKey, hasSecretKey, useTestnet]);

  const fetchSettings = async () => {
    try {
      setFetching(true);
      const res = await axios.get('/api/settings');
      setHasApiKey(res.data.hasApiKey);
      setHasSecretKey(res.data.hasSecretKey);
      setUseTestnet(res.data.useTestnet);
      setTelegramBotToken(res.data.telegramBotToken || '');
      setTelegramChatId(res.data.telegramChatId || '');
      setWebhookUrl(res.data.webhookUrl || '');
      // Leave inputs empty, placeholders will indicate status
      setApiKeyInput('');
      setSecretKeyInput('');
    } catch (error) {
      console.error("Failed to load settings", error);
      showToast("Failed to load settings from database", "error");
    } finally {
      setFetching(false);
    }
  };

  const fetchTransactions = async () => {
    if (useTestnet) return;
    try {
      setLoadingTransactions(true);
      const [depRes, withRes] = await Promise.all([
        axios.get('/api/deposits'),
        axios.get('/api/withdrawals')
      ]);
      setDeposits(Array.isArray(depRes.data) ? depRes.data : []);
      setWithdrawals(Array.isArray(withRes.data) ? withRes.data : []);
    } catch (error) {
      console.error("Failed to load transactions", error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearKeys = async () => {
    setLoading(true);
    try {
      await axios.post('/api/settings', { apiKey: '', secretKey: '' });
      showToast("Keys cleared from database.", "success");
      setApiKeyInput('');
      setSecretKeyInput('');
      await axios.post('/api/reconnect');
      await fetchSettings();
      await refreshSettings?.();
      setShowClearConfirm(false);
    } catch (error: any) {
      showToast("Failed to clear keys", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: any = { useTestnet };
      
      if (apiKeyInput !== undefined && apiKeyInput !== '') {
        payload.apiKey = apiKeyInput;
      }
      if (secretKeyInput !== undefined && secretKeyInput !== '') {
        payload.secretKey = secretKeyInput;
      }
      payload.telegramBotToken = telegramBotToken;
      payload.telegramChatId = telegramChatId;
      payload.webhookUrl = webhookUrl;

      await axios.post('/api/settings', payload);
      
      showToast("Settings saved successfully. Reconnecting...", "success");
      
      setApiKeyInput('');
      setSecretKeyInput('');
      
      try {
        await axios.post('/api/reconnect');
        showToast("Successfully reconnected to exchange.", "success");
      } catch (e) {
        showToast("Keys saved, but failed to reconnect immediately. Restart server or refresh.", "error");
      }

      await fetchSettings();
      await refreshSettings?.();
    } catch (error: any) {
      console.error("Failed to save settings", error);
      showToast("Failed to save settings: " + (error.response?.data?.error || error.message), "error");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="p-6 text-muted-foreground flex items-center gap-2"><Globe className="animate-spin w-4 h-4"/> Loading Settings...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black uppercase tracking-tighter">Account Management</h2>
        <p className="text-muted-foreground text-sm">Configure your personal exchange keys and track transactions.</p>
      </div>

      <Tabs defaultValue="keys" className="w-full">
        <TabsList className="flex flex-col sm:grid sm:w-full sm:grid-cols-3 mb-6 h-auto gap-2 sm:gap-0 bg-transparent sm:bg-muted p-0 sm:p-1">
          <TabsTrigger value="keys" className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs bg-muted sm:bg-transparent data-[state=active]:bg-background">API Keys</TabsTrigger>
          <TabsTrigger value="transactions" disabled={!hasApiKey} className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs bg-muted sm:bg-transparent data-[state=active]:bg-background">Transactions</TabsTrigger>
          <TabsTrigger value="integrations" className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs bg-muted sm:bg-transparent data-[state=active]:bg-background">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="keys">
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    Delta Exchange API Credentials
                  </CardTitle>
                  <CardDescription>
                    These keys are encrypted before being stored in your local SQLite database.
                    If empty, the system drops back to Environment Variables.
                  </CardDescription>
                </div>
                {(hasApiKey || hasSecretKey) && (
                  <>
                    {!showClearConfirm ? (
                      <Button variant="destructive" size="sm" onClick={() => setShowClearConfirm(true)} disabled={loading} className="text-[10px] uppercase tracking-widest font-bold">
                        Clear Saved Keys
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-1">Are you sure?</span>
                        <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)} disabled={loading} className="text-[10px] uppercase tracking-widest">
                          Cancel
                        </Button>
                        <Button variant="destructive" size="sm" onClick={clearKeys} disabled={loading} className="text-[10px] uppercase tracking-widest font-bold">
                          Yes, Clear Keys
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">Use Testnet</Label>
                  <p className="text-xs text-muted-foreground">Toggle to trade on Delta Exchange Futures Testnet.</p>
                </div>
                <Switch 
                  checked={useTestnet} 
                  onCheckedChange={setUseTestnet} 
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="font-bold flex items-center gap-2">
                    API Key
                    {hasApiKey && <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full"><Shield className="w-3 h-3" /> Saved</span>}
                  </Label>
                  <Input
                    id="apiKey"
                    placeholder={hasApiKey ? "•••••••••••••••••••••••••••• (Leave blank to keep existing)" : "Enter your Delta Exchange API Key"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secretKey" className="font-bold flex items-center gap-2">
                    Secret Key
                    {hasSecretKey && <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full"><Shield className="w-3 h-3" /> Encrypted & Saved</span>}
                  </Label>
                  <Input
                    id="secretKey"
                    type="password"
                    placeholder={hasSecretKey ? "•••••••••••••••••••••••••••• (Leave blank to keep existing)" : "Enter your Delta Exchange Secret Key"}
                    value={secretKeyInput}
                    onChange={(e) => setSecretKeyInput(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={loading} 
                className="w-full sm:w-auto font-bold uppercase tracking-wider"
              >
                {loading ? <Globe className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save & Apply
              </Button>
            </CardContent>
          </Card>

          {hasApiKeys && (
            <div className="mt-8 max-w-sm">
              <AccountDetails />
            </div>
          )}
        </TabsContent>
        <TabsContent value="transactions">
           <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div>
                   <CardTitle>Transaction History</CardTitle>
                   <CardDescription>Recent deposits and withdrawals on your Delta Exchange account</CardDescription>
                 </div>
                 <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loadingTransactions}>
                   <RefreshCw className={`w-4 h-4 mr-2 ${loadingTransactions ? 'animate-spin' : ''}`} />
                   Refresh
                 </Button>
               </div>
             </CardHeader>
             <CardContent className="space-y-6">
               <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-green-500"><ArrowDownToLine className="w-4 h-4" /> Recent Deposits</h3>
                  {deposits.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="uppercase text-muted-foreground border-b border-border/50">
                          <tr>
                            <th className="pb-2">Asset</th>
                            <th className="pb-2">Amount</th>
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2">TxId</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deposits.map((dep, idx) => (
                            <tr key={idx} className="border-b border-border/50 last:border-0">
                              <td className="py-2 font-bold">{dep.coin}</td>
                              <td className="py-2 font-mono">{dep.amount}</td>
                              <td className="py-2 opacity-80">{new Date(dep.insertTime).toLocaleString()}</td>
                              <td className="py-2">{dep.status === 1 ? <span className="text-green-500">Completed</span> : 'Pending'}</td>
                              <td className="py-2 font-mono text-[10px] truncate max-w-[100px]">{dep.txId || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No recent deposits found.</p>
                  )}
               </div>

               <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-red-500"><ArrowUpFromLine className="w-4 h-4" /> Recent Withdrawals</h3>
                  {withdrawals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="uppercase text-muted-foreground border-b border-border/50">
                          <tr>
                            <th className="pb-2">Asset</th>
                            <th className="pb-2">Amount</th>
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2">Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {withdrawals.map((withd, idx) => (
                            <tr key={idx} className="border-b border-border/50 last:border-0">
                              <td className="py-2 font-bold">{withd.coin}</td>
                              <td className="py-2 font-mono">{withd.amount}</td>
                              <td className="py-2 opacity-80">{withd.applyTime}</td>
                              <td className="py-2">{withd.status === 6 ? <span className="text-green-500">Completed</span> : `Status: ${withd.status}`}</td>
                              <td className="py-2 font-mono text-[10px] truncate max-w-[100px]">{withd.address || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No recent withdrawals found.</p>
                  )}
               </div>
             </CardContent>
           </Card>
        </TabsContent>
        <TabsContent value="integrations">
          <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Notifications & Integrations</CardTitle>
              <CardDescription>Setup Push Notifications and Google Sheets export</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="telegramBotToken" className="font-bold">Telegram Bot Token</Label>
                  <Input
                    id="telegramBotToken"
                    type="password"
                    placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxyz"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramChatId" className="font-bold">Telegram Chat ID</Label>
                  <Input
                    id="telegramChatId"
                    placeholder="e.g. 123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Entries and exits will be pushed to this Telegram chat.</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl" className="font-bold">Google Sheets & Extensions Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Trade data and macro conditions will be POSTed here for journaling.</p>
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={loading} 
                className="w-full sm:w-auto font-bold uppercase tracking-wider mt-4"
              >
                {loading ? <Globe className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Integrations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
