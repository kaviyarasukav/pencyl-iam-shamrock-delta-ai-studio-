import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Terminal, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SystemLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/journal?limit=100');
      if (Array.isArray(response.data)) {
        setLogs(response.data);
      } else {
        console.error("Expected array but got:", response.data);
        setLogs([]);
      }
    } catch (error) {
      console.error("Failed to fetch logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    const es = new EventSource('/api/stream');
    
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetchLogs = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchLogs();
      }, 500);
    };
    
    es.addEventListener('signal', debouncedFetchLogs);
    es.addEventListener('order', debouncedFetchLogs);
    es.addEventListener('volume_spike', debouncedFetchLogs);
    es.addEventListener('cvd', debouncedFetchLogs);
    es.addEventListener('large_order', debouncedFetchLogs);
    es.addEventListener('liquidity_shift', debouncedFetchLogs);
    es.addEventListener('options_flow', debouncedFetchLogs);
    es.addEventListener('iceberg', debouncedFetchLogs);
    es.addEventListener('options_sweep', debouncedFetchLogs);
    es.addEventListener('gamma_exposure', debouncedFetchLogs);
    es.addEventListener('alpha_signal', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        const formatMsg = `[ALPHA] ${data.action ? data.action : 'SIGNAL_DETECTED'} ${data.symbol || data.path || ''} ${data.subtype || ''} ${data.expected_yield ? 'Yield: ' + data.expected_yield : ''}`;
        setLogs(prev => [{
          timestamp: Date.now(),
          level: 'INFO',
          message: formatMsg
        }, ...prev].slice(0, 100)); // Prepend directly so it shows immediately
      } catch(e) {}
    });

    return () => {
      es.close();
    };
  }, []);

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xl flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" />
          System Journal
        </CardTitle>
        <button onClick={fetchLogs} className="text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-16rem)] w-full">
          <div className="p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[500px]">
              <Table>
              <TableHeader className="sticky top-0 bg-card/90 backdrop-blur-sm z-10">
                <TableRow className="hover:bg-transparent border-b-muted/50">
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, i) => (
                    <TableRow key={i} className="border-b-muted/20">
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.level === 'ERROR' ? 'destructive' : 'outline'} className="text-[10px]">
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] sm:max-w-[300px] break-all sm:truncate" title={log.message}>
                        {log.message}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
