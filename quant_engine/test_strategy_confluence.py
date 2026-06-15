import unittest
import pandas as pd
from strategy_confluence import (
    analyze_market_structure,
    SessionManager,
    ValidationEngine,
    VolumeAgent,
    MomentumAgent,
    SMCAgent
)

class TestStrategyConfluence(unittest.TestCase):

    def test_analyze_market_structure(self):
        # We need 200+ rows. We'll create a synthetic dataframe where conditions for LONG are met
        # close > ema50 > ema200, close > vwap, vol > 1.5 * vol_sma
        rows = []
        for i in range(250):
            # To meet close > ema50 > ema200, we just set a steady uptrend
            price = 100 + i * 0.5
            vol = 100
            if i == 249:
                vol = 500  # huge volume spike at the end to trigger vol > 1.5 * vol_sma
            rows.append({
                'High': price + 1,
                'Low': price - 1,
                'Close': price,
                'Volume': vol
            })
            
        df = pd.DataFrame(rows)
        signal, atr = analyze_market_structure(df)
        self.assertEqual(signal, 'LONG')
        self.assertTrue(atr > 0)

    def test_session_manager(self):
        sm = SessionManager()
        res = sm.update()
        self.assertIn("session", res)
        self.assertIn("is_weekend", res)
        self.assertIn("volatility_multiplier", res)

    def test_validation_engine(self):
        ve = ValidationEngine(time_of_lasting=0.1)
        
        # Initially false
        res = ve.validate("test_id", "LONG")
        self.assertFalse(res)
        
        # Sleep and try again should be true
        import time
        time.sleep(0.15)
        res = ve.validate("test_id", "LONG")
        self.assertTrue(res)
        
        # Reset with NONE
        ve.validate("test_id", "NONE")
        self.assertNotIn("test_id", ve.pending_signals)

    def test_volume_agent(self):
        agent = VolumeAgent()
        res = agent.evaluate(None, cvd_slope=0.5, cmf=0.3, vol_climax=False, z_score=4.0, 
                             is_near_val=False, is_breakout_vah=False, is_near_vah=False, 
                             is_breakout_val=False, has_pro_edge=False, threshold_mult=1.0, mean_reversion=False)
        # Should trigger LONG due to cvd_slope > 0 and z_score > 3.0
        self.assertEqual(res, "LONG")
        
        # Climax should veto
        res_veto = agent.evaluate(None, cvd_slope=0.5, cmf=0.3, vol_climax=True, z_score=4.0, 
                             is_near_val=False, is_breakout_vah=False, is_near_vah=False, 
                             is_breakout_val=False, has_pro_edge=False, threshold_mult=1.0, mean_reversion=False)
        self.assertEqual(res_veto, "NONE")

if __name__ == '__main__':
    unittest.main()
