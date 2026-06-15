import unittest
import asyncio
from unittest.mock import AsyncMock, patch

from arbitrage_engine import ArbitrageEngine

class TestArbitrageEngine(unittest.TestCase):
    def setUp(self):
        # We need to mock ccxt inside arbitrage engine to prevent real API calls
        pass

    @patch('arbitrage_engine.ccxt')
    def test_cross_exchange_arbitrage(self, mock_ccxt):
        mock_ex1 = AsyncMock()
        mock_ex1.fetch_ticker.return_value = {'last': 50000}
        
        mock_ex2 = AsyncMock()
        mock_ex2.fetch_ticker.return_value = {'last': 50500}
        
        # Patching inside the class initialization directly works differently, let's just 
        # initialize and then replace the exchanges
        engine = ArbitrageEngine(primary_exchange='delta', secondary_exchange='kraken')
        engine.ex_primary = mock_ex1
        engine.ex_secondary = mock_ex2

        async def run_test():
            res = await engine.check_cross_exchange_arbitrage("BTC/USDT")
            self.assertIsNotNone(res)
            self.assertEqual(res["subtype"], "CROSS_EXCHANGE")
            self.assertEqual(res["spread_pct"], 500/50000)
            self.assertEqual(res["buy_on"], "PRIMARY")

        asyncio.run(run_test())

    @patch('arbitrage_engine.ccxt')
    def test_no_arbitrage(self, mock_ccxt):
        mock_ex1 = AsyncMock()
        mock_ex1.fetch_ticker.return_value = {'last': 50000}
        
        mock_ex2 = AsyncMock()
        mock_ex2.fetch_ticker.return_value = {'last': 50010}
        
        engine = ArbitrageEngine(primary_exchange='delta', secondary_exchange='kraken')
        engine.ex_primary = mock_ex1
        engine.ex_secondary = mock_ex2

        async def run_test():
            res = await engine.check_cross_exchange_arbitrage("BTC/USDT")
            self.assertIsNone(res)

        asyncio.run(run_test())

    @patch('arbitrage_engine.ccxt')
    def test_triangular_arbitrage(self, mock_ccxt):
        mock_ex1 = AsyncMock()
        # Pair 1: BTC/USDT (ask) => 1 USDT gets 1/50000 BTC
        # Pair 2: ETH/BTC (ask) => 1 BTC gets 1/0.05 ETH = 20 ETH -> Wait, intermediate is ETH
        # Step1: 1/p1  (1 / 50000 = 0.00002 BTC)
        # Step2: step1 / p2 (0.00002 / 0.05 = 0.0004 ETH)
        # Step3: step2 * p3 (0.0004 * 4000 = 1.6 USDT -> 60% profit)
        async def mock_fetch_ticker(symbol):
            if symbol == 'BTC/USDT':
                return {'ask': 50000, 'bid': 49990}
            elif symbol == 'ETH/BTC':
                return {'ask': 0.05, 'bid': 0.049}
            elif symbol == 'ETH/USDT':
                return {'ask': 4100, 'bid': 4000}
            return {}

        mock_ex1.fetch_ticker = mock_fetch_ticker
        
        engine = ArbitrageEngine()
        engine.ex_primary = mock_ex1

        async def run_test():
            res = await engine.check_triangular_arbitrage("BTC", "USDT", "ETH")
            self.assertIsNotNone(res)
            self.assertEqual(res["subtype"], "TRIANGULAR")
            self.assertTrue(res["profit_pct"] > 0)

        asyncio.run(run_test())

if __name__ == '__main__':
    unittest.main()
