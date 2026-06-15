import { deltaApiClient } from '../lib/api';
import { ExchangeService, TickerData, KlineData, TradeData, OrderRequest, OpenOrder, OrderResponse } from './ExchangeService';

export const deltaService: ExchangeService = {
  getTickers: async (): Promise<TickerData[]> => {
    const rawData = await deltaApiClient.get<any>('/api/ticker');
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((t: any) => ({
      symbol: t.symbol,
      priceChange: t.priceChange || '0',
      priceChangePercent: t.priceChangePercent || '0',
      lastPrice: t.lastPrice || '0',
      volume: t.volume || '0',
      quoteVolume: t.quoteVolume || '0',
      highPrice: t.highPrice || '0',
      lowPrice: t.lowPrice || '0'
    }));
  },

  getKlines: async (symbol: string, interval: string = '1h', limit: number = 24): Promise<KlineData[]> => {
    const rawData = await deltaApiClient.get<any>(`/api/klines/${symbol}`, {
      params: { interval, limit }
    });
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((k: any) => {
      const date = new Date(k[0]);
      let timeStr = '';
      if (interval === '1d' || interval === '1w' || interval === '1M') {
        timeStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } else {
        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return {
        time: timeStr,
        ts: k[0],
        open: parseFloat(k[1]) || 0,
        high: parseFloat(k[2]) || 0,
        low: parseFloat(k[3]) || 0,
        close: parseFloat(k[4]) || 0,
        price: parseFloat(k[4]) || 0,
        volume: parseFloat(k[5]) || 0
      };
    });
  },

  getOrderBook: async (symbol: string): Promise<any> => {
    return await deltaApiClient.get<any>(`/api/orderbook/${symbol}`);
  },

  getTrades: async (symbol: string): Promise<any[]> => {
    return await deltaApiClient.get<any>(`/api/trades/${symbol}`);
  },
  
  getOpenOrders: async (symbol: string): Promise<OpenOrder[]> => {
    const rawData = await deltaApiClient.get<any>(`/api/openOrders/${symbol}`);
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((o: any) => ({
      orderId: o.orderId,
      time: o.time,
      side: o.side as 'BUY' | 'SELL',
      price: o.price,
      origQty: o.origQty,
      status: o.status
    }));
  },

  getMyTrades: async (symbol: string): Promise<TradeData[]> => {
    const rawData = await deltaApiClient.get<any>(`/api/myTrades/${symbol}`);
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((t: any) => ({
      id: t.id,
      orderId: t.orderId,
      price: t.price,
      qty: t.qty,
      time: t.time,
      side: t.isBuyer ? 'BUY' : 'SELL'
    }));
  },

  placeOrder: async (orderRequest: OrderRequest): Promise<OrderResponse> => {
    const payload: any = {
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      price: orderRequest.price,
      stopPrice: orderRequest.stopPrice,
      timeInForce: orderRequest.timeInForce,
      icebergQty: orderRequest.icebergQty,
      quantity: orderRequest.quantity
    };
    
    if (orderRequest.metadata) {
      payload.metadata = orderRequest.metadata;
    }
    
    try {
      const response = await deltaApiClient.post<any>('/api/order', payload);
      return {
        success: response.success,
        orderId: response.order?.orderId || 'unknown'
      };
    } catch (error: any) {
      return {
        success: false,
        orderId: '',
        message: error.response?.data?.error || error.message
      };
    }
  },

  cancelOrder: async (symbol: string, orderId: string | number): Promise<any> => {
    return await deltaApiClient.delete<any>(`/api/order/${symbol}/${orderId}`);
  },
  
  cancelAllOrders: async (symbol: string): Promise<any> => {
    return await deltaApiClient.delete<any>(`/api/buster-call/${symbol}`);
  },

  getPortfolio: async (): Promise<any> => {
    return await deltaApiClient.get<any>('/api/wallet-summary');
  },

  getProductDetails: async (symbol: string): Promise<any> => {
    try {
      return await deltaApiClient.get<any>(`/api/exchangeInfo/${symbol}`);
    } catch (error: any) {
      if (error.response?.status !== 404 && error.code !== 'ERR_NETWORK') {
         console.warn(`[Delta Exchange Service] getProductDetails (${symbol}):`, error.message || error);
      }
      // Fallback for minimal UI needs
      return {
        symbol,
        quoting_asset: { symbol: 'USDT' },
        settling_asset: { symbol: 'USDT' },
        filters: [
          { filterType: 'PRICE_FILTER', tickSize: '0.01' },
          { filterType: 'LOT_SIZE', stepSize: '0.00001' }
        ]
      };
    }
  }
};
