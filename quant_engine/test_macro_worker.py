import unittest
from datetime import datetime, timedelta
import json

from macro_worker import MacroRegimeAnalyzer

class TestMacroWorker(unittest.TestCase):
    def setUp(self):
        self.published_messages = []
        def mock_publish(msg):
            self.published_messages.append(msg)
            
        self.analyzer = MacroRegimeAnalyzer(mock_publish)

    def test_evaluate_regime(self):
        # Test RISK_OFF
        self.analyzer.options_data = {"put_call": 1.3}
        self.analyzer.dxy_z_score = 0.5
        self.analyzer.sentiment_score = -0.5
        self.analyzer._evaluate_regime()
        self.assertEqual(self.analyzer.regime, "RISK_OFF")

        # Test RISK_ON
        self.analyzer.options_data = {"put_call": 0.7}
        self.analyzer.dxy_z_score = -0.5
        self.analyzer.sentiment_score = 0.5
        self.analyzer._evaluate_regime()
        self.assertEqual(self.analyzer.regime, "RISK_ON")

        # Test CHOP
        self.analyzer.options_data = {"put_call": 1.0}
        self.analyzer.dxy_z_score = 0.0
        self.analyzer.sentiment_score = 0.0
        self.analyzer._evaluate_regime()
        self.assertEqual(self.analyzer.regime, "CHOP")

    def test_check_killswitch(self):
        # Yield z-score shock
        self.analyzer.yield_z_score = 3.5
        self.analyzer._check_killswitch()
        self.assertTrue(self.analyzer.killswitch_active)

        self.analyzer.yield_z_score = 0.0
        
        # Yield spread inversion shock
        self.analyzer.yield_spread = -0.1
        self.analyzer._check_killswitch()
        self.assertTrue(self.analyzer.killswitch_active)

        self.analyzer.yield_spread = 0.5

        # Calendar event shock
        import datetime
        now = datetime.datetime.utcnow()
        # Event in 5 mins
        self.analyzer.upcoming_events = [now + datetime.timedelta(minutes=5)]
        self.analyzer._check_killswitch()
        self.assertTrue(self.analyzer.killswitch_active)
        
        # Event 30 mins away
        self.analyzer.upcoming_events = [now + datetime.timedelta(minutes=30)]
        self.analyzer._check_killswitch()
        self.assertFalse(self.analyzer.killswitch_active)

    def test_emit_status(self):
        self.analyzer.regime = "RISK_ON"
        self.analyzer.current_dxy = 101.5
        self.analyzer.killswitch_active = False
        self.analyzer._emit_status()
        
        self.assertEqual(len(self.published_messages), 1)
        msg = self.published_messages[0]
        self.assertEqual(msg["type"], "MACRO_REGIME_UPDATE")
        self.assertEqual(msg["state"], "RISK_ON")
        self.assertFalse(msg["killswitch_active"])
        self.assertEqual(msg["metrics"]["dxy_price"], 101.5)

if __name__ == '__main__':
    unittest.main()
