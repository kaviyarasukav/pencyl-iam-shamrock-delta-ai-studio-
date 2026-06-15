import unittest
import asyncio
from unittest.mock import MagicMock

from autopilot_manager import AutopilotManager

class TestAutopilotManager(unittest.TestCase):
    def setUp(self):
        self.symbol_states = {}
        self.symbol_states_lock = asyncio.Lock()
        self.published_messages = []
        
        def mock_publish(msg):
            self.published_messages.append(msg)
            
        self.autopilot = AutopilotManager(self.symbol_states, self.symbol_states_lock, mock_publish)
        self.autopilot.conviction_threshold = 80

    def test_start_stop(self):
        self.assertFalse(self.autopilot.is_running)
        self.autopilot.start()
        self.assertTrue(self.autopilot.is_running)
        self.autopilot.stop()
        self.assertFalse(self.autopilot.is_running)

    def test_evaluate_asset_high_conviction_long(self):
        # Mock Confluence Engine
        mock_c_engine = MagicMock()
        mock_c_engine.get_mtf_bias.return_value = "LONG"
        mock_c_engine.is_volume_climax.return_value = False
        mock_c_engine.get_delta_divergence.return_value = "BULLISH_DIVERGENCE"
        mock_c_engine.evaluate_playbook_combos.return_value = (True, {"direction": "LONG", "metadata": {"playbook_combo": "TestCombo"}})
        
        market_state = {
            "macro_regime": "RISK_ON",
            "current_price": 50000,
            "order_blocks": {"bullish": [[49500, 50500]], "bearish": []},
            "last_z_score": -3.0,
            "macro_metrics": {"hurst": 0.4} # Choppy
        }
        mock_c_engine.market_state = market_state
        
        state = {"confluence_engine": mock_c_engine}
        
        async def run_test():
            await self.autopilot._evaluate_asset("BTC/USDT", state)
            
            # Since conviction should be very high, it should trigger a STRATEGY_SIGNAL
            signals = [m for m in self.published_messages if m["type"] == "STRATEGY_SIGNAL"]
            self.assertTrue(len(signals) > 0)
            self.assertEqual(signals[0]["direction"], "LONG")
            self.assertEqual(signals[0]["symbol"], "BTC/USDT")

        asyncio.run(run_test())

    def test_evaluate_asset_high_conviction_short(self):
        mock_c_engine = MagicMock()
        mock_c_engine.get_mtf_bias.return_value = "SHORT"
        mock_c_engine.is_volume_climax.return_value = False
        mock_c_engine.get_delta_divergence.return_value = "BEARISH_DIVERGENCE"
        mock_c_engine.evaluate_playbook_combos.return_value = (True, {"direction": "SHORT", "metadata": {"playbook_combo": "TestCombo"}})
        
        market_state = {
            "macro_regime": "RISK_OFF",
            "current_price": 50000,
            "order_blocks": {"bullish": [], "bearish": [[49500, 50500]]},
            "last_z_score": 3.0,
            "macro_metrics": {"hurst": 0.4} # Choppy
        }
        mock_c_engine.market_state = market_state
        
        state = {"confluence_engine": mock_c_engine}
        
        async def run_test():
            await self.autopilot._evaluate_asset("ETH/USDT", state)
            
            signals = [m for m in self.published_messages if m["type"] == "STRATEGY_SIGNAL"]
            self.assertTrue(len(signals) > 0)
            self.assertEqual(signals[0]["direction"], "SHORT")
            self.assertEqual(signals[0]["symbol"], "ETH/USDT")

        asyncio.run(run_test())

if __name__ == '__main__':
    unittest.main()
