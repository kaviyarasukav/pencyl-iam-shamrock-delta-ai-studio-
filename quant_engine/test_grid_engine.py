import unittest
from grid_engine import GridEngine

class TestGridEngine(unittest.TestCase):
    def setUp(self):
        self.engine = GridEngine()

    def test_init_grid(self):
        signals = self.engine.init_grid("BTC/USDT", 50000.0, grid_levels=3, step_pct=0.01, capital=1000)
        
        self.assertIn("BTC/USDT", self.engine.active_grids)
        grid = self.engine.active_grids["BTC/USDT"]
        
        self.assertEqual(grid["center"], 50000.0)
        self.assertEqual(len(grid["buys"]), 3)
        self.assertEqual(len(grid["sells"]), 3)
        
        # Test first buy/sell logic
        # Buy: 50000 * (1 - 0.01) = 49500
        # Sell: 50000 * (1 + 0.01) = 50500
        self.assertAlmostEqual(grid["buys"][0]["price"], 49500.0)
        self.assertAlmostEqual(grid["sells"][0]["price"], 50500.0)
        
        # Test quantities (1000 / 6 = 166.666)
        self.assertAlmostEqual(grid["buys"][0]["qty_usd"], 1000 / 6)
        
        # Should return 2 signals
        self.assertEqual(len(signals), 2)
        self.assertEqual(signals[0]["direction"], "LONG")
        self.assertEqual(signals[1]["direction"], "SHORT")

if __name__ == '__main__':
    unittest.main()
