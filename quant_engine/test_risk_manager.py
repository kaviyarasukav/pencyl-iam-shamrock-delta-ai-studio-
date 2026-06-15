import unittest
from datetime import datetime
import time

from risk_manager import RiskManager

class TestRiskManager(unittest.TestCase):
    def setUp(self):
        self.rm = RiskManager(account_size=10000.0)

    def test_initialization(self):
        self.assertEqual(self.rm.account_size, 10000.0)
        self.assertEqual(self.rm.daily_high_water_mark, 10000.0)

    def test_update_account_size(self):
        self.rm.update_account_size(10500.0)
        self.assertEqual(self.rm.account_size, 10500.0)
        self.assertEqual(self.rm.daily_high_water_mark, 10500.0)
        
        self.rm.update_account_size(9500.0)
        # Should not update high water mark if size decreases
        self.assertEqual(self.rm.account_size, 9500.0)
        self.assertEqual(self.rm.daily_high_water_mark, 10500.0)

    def test_calculate_trade_parameters_strict(self):
        params_long = self.rm.calculate_trade_parameters_strict("LONG", 100.0, 2.0)
        self.assertEqual(params_long["stop_loss"], 96.0)
        self.assertEqual(params_long["take_profit"], 108.0)
        
        params_short = self.rm.calculate_trade_parameters_strict("SHORT", 100.0, 2.0)
        self.assertEqual(params_short["stop_loss"], 104.0)
        self.assertEqual(params_short["take_profit"], 92.0)

    def test_add_and_remove_trade(self):
        self.rm.add_trade("trade1", "BTC/USDT", "LONG", 50000.0, 49000.0, 53000.0, 51000.0)
        self.assertIn("trade1", self.rm.active_trades)
        
        # Test removal
        self.rm.remove_trade("trade1")
        self.assertNotIn("trade1", self.rm.active_trades)

    def test_drawdown_veto(self):
        # 5% max drawdown default
        self.rm.update_account_size(10000.0)
        self.assertFalse(self.rm.is_vetoed())
        
        self.rm.update_account_size(9400.0) # > 5% drawdown
        self.assertTrue(self.rm.is_vetoed())

    def test_trigger_killswitch(self):
        self.assertFalse(self.rm.killswitch_active)
        self.rm.trigger_killswitch("test")
        self.assertTrue(self.rm.killswitch_active)
        self.assertTrue(self.rm.is_vetoed())

if __name__ == '__main__':
    unittest.main()
