import Big from 'big.js';

/**
 * 100% FREE LOCAL PRECISION ENGINE
 * Based strictly on Delta Exchange API Documentation for Filters:
 * https://delta-docs.github.io/apidocs/spot/en/#filters
 */

// Configure Big.js to never use exponential notation (e.g., 1e-7)
// Delta Exchange API rejects exponential notation. It requires strict strings like "0.0000001"
Big.NE = -20; // values with more than 20 decimal places will use exponential
Big.PE = 20;  // values with more than 20 integer places will use exponential

/**
 * PRICE_FILTER Regulation
 * Delta Exchange Rule: price % tickSize == 0
 * We round to the nearest valid tickSize.
 */
export function formatPrice(rawPrice: number | string, tickSize: number | string): string {
  const price = new Big(rawPrice);
  const tick = new Big(tickSize);
  
  // Logic: (Price / TickSize) rounded to nearest whole number, then multiplied by TickSize
  // Rounding mode 1 = Round half up (standard rounding)
  const validPrice = price.div(tick).round(0, 1).times(tick);
  
  // Strip trailing zeros and return as string
  return validPrice.toString();
}

/**
 * LOT_SIZE Regulation
 * Delta Exchange Rule: quantity % stepSize == 0
 * We ALWAYS round DOWN (mode 0) to ensure we never try to sell more than we have.
 */
export function formatQuantity(rawQty: number | string, stepSize: number | string): string {
  const qty = new Big(rawQty);
  const step = new Big(stepSize);
  
  // Logic: (Qty / StepSize) rounded DOWN to whole number, then multiplied by StepSize
  // Rounding mode 0 = Round down (towards zero)
  const validQty = qty.div(step).round(0, 0).times(step);
  
  return validQty.toString();
}

/**
 * MIN_NOTIONAL Regulation
 * Delta Exchange Rule: price * quantity >= minNotional
 * Returns true if the order is large enough to be accepted by Delta Exchange.
 */
export function isValidNotional(price: number | string, qty: number | string, minNotional: number | string): boolean {
  const p = new Big(price);
  const q = new Big(qty);
  const min = new Big(minNotional);
  
  const notional = p.times(q);
  return notional.gte(min); // gte = greater than or equal to
}

/**
 * Safe Math Helpers for Strategies
 * Prevents JavaScript 0.1 + 0.2 = 0.30000000000000004 errors
 */
export function safeAdd(a: number | string, b: number | string): string {
  return new Big(a).plus(new Big(b)).toString();
}

export function safeSub(a: number | string, b: number | string): string {
  return new Big(a).minus(new Big(b)).toString();
}

export function safeMult(a: number | string, b: number | string): string {
  return new Big(a).times(new Big(b)).toString();
}

export function safeDiv(a: number | string, b: number | string): string {
  return new Big(a).div(new Big(b)).toString();
}

/**
 * Dynamic UI Formatting
 * Automatically adjusts decimals based on price magnitude
 */
export function formatDisplayPrice(price: number | string | undefined | null): string {
  if (price === undefined || price === null) return '0.00';
  const p = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(p) || p === 0) return '0.00';
  if (p < 0.0001) return p.toFixed(8);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(3);
  return p.toFixed(2);
}
