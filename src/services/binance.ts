import axios from 'axios';
import { ExchangeService, TickerData, KlineData, TradeData, OrderRequest, OpenOrder, OrderResponse } from './ExchangeService';

export const binanceService: ExchangeService = {
  getTickers: async (): Promise<TickerData[]> => {
    const response = await axios.get('/api/ticker');
    const rawData = response.data;
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((t: any) => ({
      symbol: t.symbol,
      priceChange: t.priceChange || '0',
      priceChangePercent: t.priceChangePercent || '0',
      lastPrice: t.lastPrice || '0',
      volume: t.volume || '0',
      highPrice: t.highPrice || '0',
      lowPrice: t.lowPrice || '0'
    }));
  },

  getKlines: async (symbol: string, interval: string = '1h', limit: number = 24): Promise<KlineData[]> => {
    const response = await axios.get(`/api/klines/${symbol}`, {
      params: { interval, limit }
    });
    const rawData = response.data;
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
    const response = await axios.get(`/api/orderbook/${symbol}`);
    return response.data;
  },

  getTrades: async (symbol: string): Promise<any[]> => {
    const response = await axios.get(`/api/trades/${symbol}`);
    return response.data;
  },
  
  getOpenOrders: async (symbol: string): Promise<OpenOrder[]> => {
    const response = await axios.get(`/api/openOrders/${symbol}`);
    const rawData = response.data;
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
    const response = await axios.get(`/api/myTrades/${symbol}`);
    const rawData = response.data;
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
      const response = await axios.post('/api/order', payload);
      return {
        success: response.data.success,
        orderId: response.data.order?.orderId || 'unknown'
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
    const response = await axios.delete(`/api/order/${symbol}/${orderId}`);
    return response.data;
  },
  
  cancelAllOrders: async (symbol: string): Promise<any> => {
    const response = await axios.delete(`/api/buster-call/${symbol}`);
    return response.data;
  },

  getPortfolio: async (): Promise<any> => {
    const response = await axios.get('/api/wallet-summary');
    return response.data;
  },

  getProductDetails: async (symbol: string): Promise<any> => {
    try {
      const response = await axios.get(`/api/exchangeInfo/${symbol}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 404 && error.code !== 'ERR_NETWORK') {
         console.warn(`[Binance Service] getProductDetails (${symbol}):`, error.message || error);
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
