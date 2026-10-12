import unittest
import approval
import engine
import simulator

class TestApprovalWorkflow(unittest.TestCase):
    def setUp(self):
        engine.reset()

    def test_nominal_active_plan_has_allocated_kw(self):
        """Active plan is initialized at startup and contains non-zero allocated_kw."""
        active = approval.get_active_plan()
        self.assertIsNotNone(active)
        self.assertIn("loads", active)
        for load in active["loads"]:
            self.assertIn("allocated_kw", load)
            self.assertGreater(load["allocated_kw"], 0.0)
            self.assertIn("need_kw", load)

    def test_propose_limited_supply_4kw_and_approve(self):
        """
        Propose with limited supply (4 kW), approve, and assert /state
        allocated_kw equals proposed_kw for every load (Life support 3.0, Habitat 1.0).
        """
        # Nominal solar noon = 10.0 kW * 0.88 = 8.8 kW solar.
        # Battery min_reserve is 3.0 kWh.
        # If solar_drop_pct=100.0 (solar=0 kW) and battery soc is 7.0 kWh (usable = 7.0 - 3.0 = 4.0 kW max 2.5),
        # Or directly pass solar_drop_pct such that solar = 1.5 kW and battery discharge = 2.5 kW -> 4.0 kW total.
        # At hour 12, peak 10.0, dust 0.12: solar_kw = 8.8 * (1 - solar_drop_pct/100).
        # To get 1.5 kW solar: 1 - solar_drop_pct/100 = 1.5 / 8.8 => solar_drop_pct = (1 - 1.5/8.8)*100 = 82.9545%
        drop_pct = round((1.0 - 1.5 / 8.8) * 100.0, 2)
        proposal = approval.create_proposal(
            solar_drop_pct=drop_pct,
            battery_soc_kwh=16.5, # usable batt = 2.5 kW
            source="test_limited_4kw",
        )
        self.assertEqual(proposal["status"], "pending")
        self.assertAlmostEqual(proposal["available_kw"], 4.0, delta=0.05)

        # Life support gets 3.0 kW and Habitat gets 1.0 kW
        allocs = proposal["allocations"]
        self.assertAlmostEqual(allocs["life_support"], 3.0, places=2)
        self.assertAlmostEqual(allocs["habitat"], 1.0, places=2)
        self.assertAlmostEqual(allocs["comms"], 0.0, places=2)
        self.assertAlmostEqual(allocs["science"], 0.0, places=2)
        self.assertAlmostEqual(allocs["rover"], 0.0, places=2)

        # MUST NOT be blocked even though habitat is only 1.0 kW of 2.0 kW need
        self.assertFalse(proposal.get("is_blocked", False))

        # Approve proposal must succeed
        approved = approval.approve_proposal(proposal["id"], operator_note="Authorized 4kW curtailment")
        self.assertEqual(approved["status"], "approved")

        # Check /state
        state = engine.get_state()
        state_loads = {l["id"]: l for l in state.get("loads", [])}
        self.assertEqual(len(state_loads), 5)

        # Assert /state allocated_kw equals proposed_kw for every load
        self.assertAlmostEqual(state_loads["life_support"]["allocated_kw"], 3.0, places=2)
        self.assertAlmostEqual(state_loads["habitat"]["allocated_kw"], 1.0, places=2)
        self.assertAlmostEqual(state_loads["comms"]["allocated_kw"], 0.0, places=2)
        self.assertAlmostEqual(state_loads["science"]["allocated_kw"], 0.0, places=2)
        self.assertAlmostEqual(state_loads["rover"]["allocated_kw"], 0.0, places=2)

    def test_patch_secondary_loads_and_locking(self):
        """
        PATCH /plan/pending accepts edits for secondary loads, rejects edits to
        locked loads, rejects values above need or supply, and recomputes delta_kw.
        """
        proposal = approval.create_proposal(solar_drop_pct=0.0, source="test_patch")

        # 1. Reject editing locked loads with ValueError (422)
        with self.assertRaises(ValueError) as ctx:
            approval.update_pending_proposal({"life_support": 2.5})
        self.assertIn("locked", str(ctx.exception).lower())

        with self.assertRaises(ValueError) as ctx:
            approval.update_pending_proposal({"habitat": 1.5})
        self.assertIn("locked", str(ctx.exception).lower())

        # 2. Allow editing secondary loads (experiments, communication, rover), including partial and 0
        updated = approval.update_pending_proposal({
            "communication": 0.5,
            "science": 0.0,
            "rover": 0.4,
        })
        self.assertAlmostEqual(updated["allocations"]["comms"], 0.5, places=2)
        self.assertAlmostEqual(updated["allocations"]["science"], 0.0, places=2)
        self.assertAlmostEqual(updated["allocations"]["rover"], 0.4, places=2)

        # Check delta_kw recomputed
        comms_load = next(l for l in updated["loads"] if l["id"] == "comms")
        self.assertIn("delta_kw", comms_load)
        self.assertAlmostEqual(comms_load["proposed_kw"], 0.5, places=2)

        # 3. Reject value above need_kw
        with self.assertRaises(ValueError) as ctx:
            approval.update_pending_proposal({"rover": 5.0})
        self.assertIn("must be between 0.0 and", str(ctx.exception))

        # 4. Reject negative value
        with self.assertRaises(ValueError) as ctx:
            approval.update_pending_proposal({"rover": -0.5})
        self.assertIn("must be between 0.0 and", str(ctx.exception))

    def test_refuse_approval_when_malformed(self):
        """Approval is refused ONLY when proposal is malformed or exceeds supply."""
        proposal = approval.create_proposal(solar_drop_pct=0.0, source="test_malformed")

        # Total exceeds available supply
        approval._pending_plan["allocations"]["rover"] = 50.0
        approval._pending_plan["total_allocated_kw"] = 58.0
        with self.assertRaises(ValueError) as ctx:
            approval.approve_proposal(proposal["id"])
        self.assertIn("exceeds available supply", str(ctx.exception))

        # Reset to valid
        approval.create_proposal(solar_drop_pct=0.0, source="test_malformed_2")
        # Negative allocation
        approval._pending_plan["allocations"]["rover"] = -1.0
        with self.assertRaises(ValueError) as ctx:
            approval.approve_proposal(approval._pending_plan["id"])
        self.assertIn("Negative", str(ctx.exception))


    def test_life_support_alert_nominal_is_inactive(self):
        """Under nominal baseline (3.0 kW Life Support), alert is not active."""
        state = engine.get_state()
        self.assertIn("life_support_alert", state)
        alert = state["life_support_alert"]
        self.assertFalse(alert["active"])
        self.assertAlmostEqual(alert["allocated_kw"], 3.0, places=2)
        self.assertAlmostEqual(alert["threshold_kw"], 3.0, places=2)
        self.assertAlmostEqual(alert["shortfall_kw"], 0.0, places=2)

        # GET /plan/active also includes life_support_alert
        active_plan = approval.get_active_plan()
        self.assertIn("life_support_alert", active_plan)
        self.assertFalse(active_plan["life_support_alert"]["active"])

    def test_life_support_alert_proposal_pending_does_not_activate_alert(self):
        """
        When a proposal with low Life support (e.g. 2.0 kW) is pending,
        the alert MUST NOT be active in /state or /plan/active until approved.
        """
        # Create a severe shortage proposal where supply is 2.0 kW total (Life support gets 2.0 kW)
        proposal = approval.create_proposal(
            solar_drop_pct=99.0, # solar ~ 0.09 kW
            battery_soc_kwh=4.9, # usable batt = 4.9 - 3.0 = 1.9 kW -> available ~ 2.0 kW
            source="test_pending_only",
        )
        self.assertLess(proposal["allocations"]["life_support"], 3.0)

        # Active state should NOT have alert active (pending proposal must not trigger alert)
        state = engine.get_state()
        self.assertFalse(state["life_support_alert"]["active"])
        active_plan = approval.get_active_plan()
        self.assertFalse(active_plan["life_support_alert"]["active"])

    def test_life_support_alert_activates_after_approval_and_logs_once(self):
        """
        After approval of a low Life support allocation, alert becomes active
        and an event is written to audit events exactly once.
        """
        proposal = approval.create_proposal(
            solar_drop_pct=99.0,
            battery_soc_kwh=4.9,
            source="test_severe_drop",
        )
        ls_kw = proposal["allocations"]["life_support"]
        self.assertLess(ls_kw, 3.0)

        events_before = len(approval.get_audit_events())

        # Approve proposal
        approval.approve_proposal(proposal["id"], operator_note="Authorized deficit dispatch")

        # Now active plan has alert = True
        state = engine.get_state()
        self.assertTrue(state["life_support_alert"]["active"])
        self.assertAlmostEqual(state["life_support_alert"]["allocated_kw"], ls_kw, places=2)
        self.assertAlmostEqual(state["life_support_alert"]["shortfall_kw"], 3.0 - ls_kw, places=2)

        active_plan = approval.get_active_plan()
        self.assertTrue(active_plan["life_support_alert"]["active"])

        # Event log contains ALERT_TRIGGERED
        events = approval.get_audit_events()
        alert_events = [e for e in events if e.get("type") == "ALERT_TRIGGERED"]
        self.assertEqual(len(alert_events), 1)
        self.assertIn("Life support below threshold:", alert_events[0]["details"])

        # Multiple state refreshes do NOT log duplicate events
        engine.get_state()
        engine.get_state()
        events_after = approval.get_audit_events()
        self.assertEqual(len(events_after), len(events))

        # Restoring/Approving a nominal plan clears the alert and logs ALERT_CLEARED
        nominal_proposal = approval.create_proposal(solar_drop_pct=0.0, battery_soc_kwh=16.5, source="test_recovery")
        approval.approve_proposal(nominal_proposal["id"], operator_note="Recovered nominal generation")

        state_cleared = engine.get_state()
        self.assertFalse(state_cleared["life_support_alert"]["active"])
        events_cleared = approval.get_audit_events()
        clear_events = [e for e in events_cleared if e.get("type") == "ALERT_CLEARED"]
        self.assertEqual(len(clear_events), 1)

    def test_reject_proposal_leaves_alert_inactive(self):
        """Rejecting a proposal does not trigger any alert."""
        proposal = approval.create_proposal(
            solar_drop_pct=99.0,
            battery_soc_kwh=4.9,
            source="test_reject",
        )
        approval.reject_proposal(proposal["id"], reason="Operator rejected deficit proposal")
        state = engine.get_state()
        self.assertFalse(state["life_support_alert"]["active"])


if __name__ == "__main__":
    unittest.main()

