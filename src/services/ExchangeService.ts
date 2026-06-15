export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

export interface KlineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  price: number;
  volume?: number;
}

export interface TradeData {
  id: string | number;
  orderId: string | number;
  price: string;
  qty: string;
  time: number | string;
  side: 'BUY' | 'SELL';
}

export interface OpenOrder {
  orderId: string | number;
  time: number | string;
  side: 'BUY' | 'SELL';
  price: string;
  origQty: string;
  status: string;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'LIMIT_MAKER' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'TWAP' | 'LIMIT_CHASE';
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
  icebergQty?: number;
  quantity: number;
  leverage?: number;
  marginMode?: 'isolated' | 'cross';
  metadata?: Record<string, any>;
}

export interface OrderResponse {
  success: boolean;
  orderId: string | number;
  message?: string;
}

export interface ExchangeService {
  getTickers(): Promise<TickerData[]>;
  getKlines(symbol: string, interval?: string, limit?: number): Promise<KlineData[]>;
  getOrderBook(symbol: string): Promise<any>;
  getTrades(symbol: string): Promise<any[]>;
  getOpenOrders(symbol: string): Promise<OpenOrder[]>;
  getMyTrades(symbol: string): Promise<TradeData[]>;
  placeOrder(orderRequest: OrderRequest): Promise<OrderResponse>;
  cancelOrder(symbol: string, orderId: string | number): Promise<any>;
  cancelAllOrders(symbol: string): Promise<any>;
  getPortfolio(): Promise<any>;
  getProductDetails?(symbol: string): Promise<any>;
}
