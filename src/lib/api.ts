import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

class ApiClient {
  private api: AxiosInstance;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  public deltaBaseUrl: string = 'https://api.delta.exchange';

  constructor() {
        this.api = axios.create({
      baseURL: '',
      timeout: 10000, // 10 seconds network timeout
    });

    // Request interceptor for robust error handling wrapper
    this.api.interceptors.request.use(
      (config) => {
        if (config.url) {
           config.url = config.url.replace(/([A-Z]{2,5})USD\b/, '$1USDT');
           if (config.url.startsWith('/api/trades/')) {
             const symbol = config.url.split('/').pop();
             config.url = `${this.deltaBaseUrl}/v2/trades/${symbol}`;
           } else if (config.url.startsWith('/api/orderbook/')) {
             const symbol = config.url.split('/').pop();
             config.url = `${this.deltaBaseUrl}/v2/l2orderbook/${symbol}`;
           }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to manage rate limits, invalid keys, schema validation, and network timeouts gracefully
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        const url = response.config.url || '';
        
        // Schema Validation Layer
        if (url.includes('/trades')) {
            if (response.data && response.data.success !== undefined && !Array.isArray(response.data)) {
                if (response.data.success === false || response.data.error) {
                    console.warn('[Schema Validation] Invalid trades response, substituting empty array:', response.data);
                    response.data = [];
                } else if (response.data.result) {
                    response.data = response.data.result.map((t: any) => ({
                       price: t.price,
                       qty: t.size?.toString() || "0",
                       time: t.timestamp ? t.timestamp / 1000 : Date.now(),
                       isBuyerMaker: t.seller_role === "maker"
                    }));
                }
            } else if (!Array.isArray(response.data)) {
                console.warn('[Schema Validation] Malformed trades data array expected:', response.data);
                response.data = [];
            }
        }
        
        if (url.includes('/l2orderbook')) {
            if (response.data && response.data.success === false) {
                 console.warn('[Schema Validation] Invalid orderbook response, substituting empty book:', response.data);
                 response.data = { lastUpdateId: Date.now(), bids: [], asks: [] };
            } else if (response.data && response.data.result) {
                 const result = response.data.result;
                 response.data = {
                    lastUpdateId: result.last_updated_at || Date.now(),
                    bids: result.buy ? result.buy.map((b: any) => [b.limit_price || b.price, b.size?.toString()]) : [],
                    asks: result.sell ? result.sell.map((a: any) => [a.limit_price || a.price, a.size?.toString()]) : []
                 };
            }
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as AxiosRequestConfig & { _retryCount?: number };
        
        if (!config) {
          return Promise.reject(error);
        }

        config._retryCount = config._retryCount || 0;

        // Handle Network Timeouts
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          if (config._retryCount < this.MAX_RETRIES) {
            config._retryCount += 1;
            await this.delay(this.RETRY_DELAY_MS * config._retryCount);
            return this.api(config);
          }
          console.error('[API Error] Network timeout exceeded max retries.');
        }

        if (error.response) {
          const status = error.response.status;

          // Schema Validation: Suppress malformed bad requests naturally on 400
          if (status === 400 && error.response.config.url?.includes('delta.exchange/v2/')) {
             console.warn(`[Schema/API Warning] Delta API returned 400. Config url: ${error.response.config.url}, data:`, error.response.data);
             if (error.response.config.url.includes('trades')) return Promise.resolve({ data: [] });
             if (error.response.config.url.includes('orderbook')) return Promise.resolve({ data: { lastUpdateId: Date.now(), bids: [], asks: [] } });
          }

          // Handle Invalid Keys (401 Unauthorized)
          if (status === 401) {
            console.error('[API Error] Invalid API keys or lack of permissions.');
            // Optionally dispatch custom event to UI
          }

          // Handle Rate Limits (429 Too Many Requests)
          if (status === 429) {
            console.warn(`[API Warning] Rate limit hit. Retrying in ${this.RETRY_DELAY_MS * 2}ms...`);
            if (config._retryCount < this.MAX_RETRIES) {
              config._retryCount += 1;
              const retryAfter = Number(error.response.headers['retry-after']) * 1000 || this.RETRY_DELAY_MS * 2;
              await this.delay(retryAfter);
              return this.api(config);
            }
          }

          // Handle Server Errors (5xx)
          if (status >= 500) {
             if (config._retryCount < this.MAX_RETRIES) {
                config._retryCount += 1;
                await this.delay(this.RETRY_DELAY_MS * config._retryCount);
                return this.api(config);
             }
             console.error('[API Error] Delta Exchange Server Error.');
          }
        } else if (error.request) {
           // Network error (no response received)
           if (config._retryCount < this.MAX_RETRIES) {
              config._retryCount += 1;
              await this.delay(this.RETRY_DELAY_MS * config._retryCount);
              return this.api(config);
           }
        }

        return Promise.reject(error);
      }
    );
  }

  public setDeltaBaseUrl(isTestnet: boolean) {
    this.deltaBaseUrl = isTestnet ? 'https://testnet-api.delta.exchange' : 'https://api.delta.exchange';
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.get<T>(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.post<T>(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.put<T>(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete<T>(url, config);
    return response.data;
  }
}

export const deltaApiClient = new ApiClient();
export default deltaApiClient;
