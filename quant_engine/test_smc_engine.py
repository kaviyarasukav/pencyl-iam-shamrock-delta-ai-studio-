import unittest
import pandas as pd
from smc_engine import SMCEngine, detect_fractals

class TestSMCEngine(unittest.TestCase):
    def test_detect_fractals(self):
        # Create a tiny dataframe with a clear peak and valley
        data = {
            'high': [10, 11, 12, 11, 10,  9,  8,  9, 10],
            'low':  [ 8,  9, 10,  9,  8,  7,  6,  7,  8],
            'close':[ 9, 10, 11, 10,  9,  8,  7,  8,  9]
        }
        df = pd.DataFrame(data)
        
        df_res = detect_fractals(df, window=2)
        
        # High at index 2 is a pivot high (12 is greater than 11 and 10 on both sides)
        self.assertTrue(df_res.loc[2, 'pivot_high'])
        self.assertFalse(df_res.loc[2, 'pivot_low'])
        
        # Low at index 6 is a pivot low
        self.assertTrue(df_res.loc[6, 'pivot_low'])
        self.assertFalse(df_res.loc[6, 'pivot_high'])

    def test_smc_engine_update(self):
        engine = SMCEngine(ob_lookback=10)
        
        # Just simple directional candles to create an FVG
        candles = [
            {'ts': 1000, 'open': 100, 'high': 105, 'low': 98, 'close': 104, 'volume': 100},
            {'ts': 2000, 'open': 104, 'high': 115, 'low': 103, 'close': 114, 'volume': 100},
            {'ts': 3000, 'open': 114, 'high': 120, 'low': 113, 'close': 118, 'volume': 100},
            {'ts': 4000, 'open': 118, 'high': 125, 'low': 117, 'close': 124, 'volume': 100},
            # Now some structure to test
            {'ts': 5000, 'open': 124, 'high': 126, 'low': 122, 'close': 123, 'volume': 100},
            {'ts': 6000, 'open': 123, 'high': 124, 'low': 110, 'close': 111, 'volume': 100}, # Break of structure low
        ]
        
        # Will fail the len(df) < window * 2 + 1 if window is 5.
        # smc engine has window=5 for fractals. So it needs at least 11 candles
        candles_expanded = candles * 3  # copy them to make it long enough
        for i, c in enumerate(candles_expanded):
            c['ts'] = i * 1000
        
        engine.update(candles_expanded, current_price=120)
        
        state = engine.get_state()
        self.assertIn("fvgs", state)
        self.assertIn("order_blocks", state)

    def test_mitigation_check(self):
        engine = SMCEngine()
        # Mock an order block
        engine.order_blocks = [
            {
                'id': 'OB_BULL_1', 'direction': 'BULLISH', 'status': 'active',
                'bottom_price': 100.0, 'top_price': 105.0
            },
            {
                'id': 'OB_BEAR_1', 'direction': 'BEARISH', 'status': 'active',
                'bottom_price': 200.0, 'top_price': 205.0
            }
        ]
        
        # Price is 150, neither mitigated
        changed = engine.check_mitigation(150.0, 1000)
        self.assertFalse(changed)
        
        # Price drops below bottom of bullish OB -> Mitigated
        changed = engine.check_mitigation(99.0, 1000)
        self.assertTrue(changed)
        self.assertEqual(engine.order_blocks[0]['status'], 'mitigated')
        
        # Price spikes above top of bearish OB -> Mitigated
        changed = engine.check_mitigation(206.0, 1000)
        self.assertTrue(changed)
        self.assertEqual(engine.order_blocks[1]['status'], 'mitigated')

if __name__ == '__main__':
    unittest.main()
