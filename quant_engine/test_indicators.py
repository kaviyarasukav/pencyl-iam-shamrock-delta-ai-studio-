import unittest
from indicators import IndicatorEngine

class TestIndicatorEngine(unittest.TestCase):
    def setUp(self):
        self.engine = IndicatorEngine()
        self.sample_candles = [
            {'ts': 1600000000000, 'o': 100, 'h': 105, 'l': 95, 'c': 102, 'v': 1000},
            {'ts': 1600000060000, 'o': 102, 'h': 108, 'l': 101, 'c': 107, 'v': 1200},
            {'ts': 1600000120000, 'o': 107, 'h': 110, 'l': 105, 'c': 106, 'v': 1500},
            {'ts': 1600000180000, 'o': 106, 'h': 109, 'l': 104, 'c': 108, 'v': 1100},
            {'ts': 1600000240000, 'o': 108, 'h': 115, 'l': 107, 'c': 112, 'v': 2000},
        ]

    def test_empty_candles(self):
        res = self.engine.calculate([])
        self.assertEqual(res, {})

    def test_rsi_calculation(self):
        # Even with short data, pandas will return NaNs and we handle it
        configs = [{'id': 'rsi_1', 'type': 'RSI', 'length': 2}]
        self.engine.update_config(configs)
        res = self.engine.calculate(self.sample_candles)
        self.assertIn('price', res)
        self.assertEqual(res['price'], 112)
        # Should have rsi_1 computed
        self.assertIn('rsi_1', res)
        # Because we only have 5 candles and length is 2, there should be some computed values
        self.assertTrue(len(res['rsi_1']) == len(self.sample_candles))

    def test_macd_calculation(self):
        configs = [{'id': 'macd_1', 'type': 'MACD', 'fast_length': 2, 'slow_length': 4, 'signal_length': 2}]
        self.engine.update_config(configs)
        res = self.engine.calculate(self.sample_candles)
        self.assertIn('macd_1', res)
        self.assertIn('macd', res['macd_1'])
        self.assertIn('histogram', res['macd_1'])
        self.assertIn('signal', res['macd_1'])

    def test_bb_calculation(self):
        configs = [{'id': 'bb_1', 'type': 'BB', 'length': 3, 'stdDev': 2.0}]
        self.engine.update_config(configs)
        res = self.engine.calculate(self.sample_candles)
        self.assertIn('bb_1', res)
        self.assertIn('lower', res['bb_1'])
        self.assertIn('mid', res['bb_1'])
        self.assertIn('upper', res['bb_1'])

if __name__ == '__main__':
    unittest.main()
