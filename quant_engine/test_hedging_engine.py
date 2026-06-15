import unittest
import asyncio
from unittest.mock import patch, AsyncMock

from hedging_engine import DeltaNeutralHedgingEngine

class TestHedgingEngine(unittest.TestCase):
    def setUp(self):
        pass

    @patch('hedging_engine.ccxt')
    def test_emergency_delta_hedge(self, mock_ccxt):
        engine = DeltaNeutralHedgingEngine()
        
        res = engine.emergency_delta_hedge("BTC/USDT", "SELL", 10000.0, 50000.0)
        self.assertIsNotNone(res)
        self.assertEqual(res["type"], "HEDGE_ACTION")
        self.assertEqual(res["target_qty"], 10000.0 / 50000.0)
        self.assertEqual(res["legs"][0]["side"], "SELL")

    @patch('hedging_engine.ccxt')
    def test_calculate_hedge_size(self, mock_ccxt):
        engine = DeltaNeutralHedgingEngine()
        # 10k capital, 5k for spot, price is 50k -> 0.1 qty
        qty = engine.calculate_hedge_size(10000.0, 50000.0)
        self.assertAlmostEqual(qty, 0.1)

    @patch('hedging_engine.ccxt')
    def test_generate_hedge_signal_enter(self, mock_ccxt):
        engine = DeltaNeutralHedgingEngine()
        
        mock_futures = AsyncMock()
        # 0.0001 per 8hr -> 0.0003 per day -> ~10.95% annual -> Over 10% threshold
        mock_futures.fetch_funding_rate.return_value = {'fundingRate': 0.0001}
        engine.futures_exchange = mock_futures

        async def run_test():
            res = await engine.generate_hedge_signal("BTC/USDT", 10000.0, 50000.0)
            self.assertIsNotNone(res)
            self.assertEqual(res["action"], "ENTER")
            self.assertEqual(res["target_qty"], 0.1)
            self.assertIn("BTC/USDT", engine.positions)

        asyncio.run(run_test())

    @patch('hedging_engine.ccxt')
    def test_generate_hedge_signal_exit(self, mock_ccxt):
        engine = DeltaNeutralHedgingEngine()
        engine.positions["BTC/USDT"] = {"status": "HEDGED", "qty": 0.1, "entry_price": 50000.0}
        
        mock_futures = AsyncMock()
        # negative yield -> Should exit
        mock_futures.fetch_funding_rate.return_value = {'fundingRate': -0.0001}
        engine.futures_exchange = mock_futures

        async def run_test():
            res = await engine.generate_hedge_signal("BTC/USDT", 10000.0, 50000.0)
            self.assertIsNotNone(res)
            self.assertEqual(res["action"], "EXIT")
            self.assertNotIn("BTC/USDT", engine.positions)

        asyncio.run(run_test())

if __name__ == '__main__':
    unittest.main()
