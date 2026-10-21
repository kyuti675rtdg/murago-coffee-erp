"""Phase 1 engine tests — FSM, DAG, fuel/water calculators, payroll, sign-off."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from core.models import Organization, SignatureCredential, Station
from core.signoff import SignOffError, record_dual_signoff, require_different_users
from hr.models import AttendanceEntry, AttendanceSheet, WageType, Worker, WorkerAdvance
from hr_payroll.engine import PayrollError, generate_payroll, verify_attendance_sheet
from processing.fsm import ALLOWED_TRANSITIONS, InvalidTransition, transition
from processing.models import Lot, LotStage
from resources.calculators import (cherry_to_parchment, fuel_ratio,
                                   parchment_to_green, water_ratio)
from traceability.dag import DAGError, blend_lots, split_lot, would_create_cycle

User = get_user_model()


class BaseSetup(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.u1 = User.objects.create_user("officer1", password="x")
        cls.u2 = User.objects.create_user("professional1", password="x")
        cls.org = Organization.objects.create(name="Murago Coffee")
        cls.station = Station.objects.create(
            organization=cls.org, code="MUR", name="Murago Washing Station",
            station_type=Station.StationType.WASHING, altitude_m=2100)

    def make_lot(self, code="MUR-20261021-W-001", weight="1000", process=Lot.ProcessType.WASHED):
        return Lot.objects.create(lot_code=code, station=self.station, process_type=process,
                                  current_weight_kg=Decimal(weight), cherry_kg=Decimal(weight))


class FSMTests(BaseSetup):
    def test_allowed_map_is_strictly_sequential(self):
        stages = list(LotStage.values)
        for i, stage in enumerate(stages):
            expected = [stages[i + 1]] if i + 1 < len(stages) else []
            self.assertEqual(ALLOWED_TRANSITIONS[stage], expected)

    def test_illegal_skip_is_blocked(self):
        lot = self.make_lot()
        with self.assertRaises(InvalidTransition):
            transition(lot, LotStage.PULPING)  # skips Receiving
        lot.refresh_from_db()
        self.assertEqual(lot.current_stage, LotStage.HARVESTING_SORTING)
        self.assertEqual(lot.stage_events.count(), 0)

    def test_backwards_transition_is_blocked(self):
        lot = self.make_lot()
        transition(lot, LotStage.RECEIVING)
        with self.assertRaises(InvalidTransition):
            transition(lot, LotStage.HARVESTING_SORTING)

    def test_legal_full_chain_and_special_timestamps(self):
        lot = self.make_lot()
        chain = [LotStage.RECEIVING, LotStage.PULPING, LotStage.FERMENTING, LotStage.WASHING,
                 LotStage.DRYING, LotStage.CONDITIONING, LotStage.DRY_MILLING, LotStage.BAG_MARKING,
                 LotStage.PACKING, LotStage.STORING, LotStage.EXPORTING]
        for stage in chain:
            transition(lot, stage, actor=self.u1)
        lot.refresh_from_db()
        self.assertEqual(lot.current_stage, LotStage.EXPORTING)
        self.assertEqual(lot.stage_events.count(), len(chain))
        self.assertIsNotNone(lot.pulping_date)
        self.assertIsNotNone(lot.washing_date)
        self.assertIsNone(lot.laid_date)  # washed lot: no laid date
        with self.assertRaises(InvalidTransition):  # terminal stage
            transition(lot, LotStage.EXPORTING)

    def test_natural_lot_gets_laid_date(self):
        lot = self.make_lot(code="MUR-20261021-N-001", process=Lot.ProcessType.NATURAL)
        for stage in [LotStage.RECEIVING, LotStage.PULPING, LotStage.FERMENTING,
                      LotStage.WASHING, LotStage.DRYING]:
            transition(lot, stage)
        lot.refresh_from_db()
        self.assertIsNotNone(lot.laid_date)


class DAGTests(BaseSetup):
    def test_split_ratios_sum_to_one_on_full_split(self):
        parent = self.make_lot(weight="1000")
        c1 = self.make_lot(code="MUR-S1", weight="0")
        c2 = self.make_lot(code="MUR-S2", weight="0")
        edges = split_lot(parent, [(c1, Decimal("600")), (c2, Decimal("400"))])
        self.assertEqual(sum(e.ratio for e in edges), Decimal("1.0000"))
        self.assertEqual([e.ratio for e in edges], [Decimal("0.6000"), Decimal("0.4000")])
        c1.refresh_from_db(); c2.refresh_from_db()
        self.assertEqual(c1.current_weight_kg, Decimal("600"))
        self.assertEqual(c2.current_weight_kg, Decimal("400"))

    def test_split_overdraw_rejected(self):
        parent = self.make_lot(weight="100")
        child = self.make_lot(code="MUR-SX", weight="0")
        with self.assertRaises(DAGError):
            split_lot(parent, [(child, Decimal("101"))])

    def test_blend_lineage_and_weights(self):
        p1 = self.make_lot(code="MUR-P1", weight="500")
        p2 = self.make_lot(code="MUR-P2", weight="500")
        child = self.make_lot(code="MUR-B1", weight="0")
        edges = blend_lots([(p1, Decimal("200")), (p2, Decimal("300"))], child)
        self.assertEqual(len(edges), 2)
        self.assertEqual(edges[0].ratio, Decimal("0.4000"))  # 200/500
        self.assertEqual(edges[1].ratio, Decimal("0.6000"))  # 300/500
        child.refresh_from_db()
        self.assertEqual(child.current_weight_kg, Decimal("500"))

    def test_cycle_prevention(self):
        a = self.make_lot(code="MUR-A", weight="100")
        b = self.make_lot(code="MUR-B", weight="0")
        split_lot(a, [(b, Decimal("100"))])
        self.assertTrue(would_create_cycle(b, a))
        with self.assertRaises(DAGError):
            split_lot(b, [(a, Decimal("50"))])


class CalculatorTests(TestCase):
    def test_fuel_ratio(self):
        result = fuel_ratio(Decimal("20"), Decimal("1000"))
        self.assertEqual(result.ratio, Decimal("0.02000"))
        self.assertFalse(result.is_anomaly)
        self.assertTrue(fuel_ratio(Decimal("30"), Decimal("1000"), max_ratio=Decimal("0.02")).is_anomaly)
        self.assertIsNone(fuel_ratio(Decimal("5"), Decimal("0")).ratio)

    def test_water_ratio_uses_previous_day_pulped_kg(self):
        # 12,000 L consumed today against YESTERDAY's 2,000 kg pulped = 6.0 L/kg.
        result = water_ratio(Decimal("12000"), Decimal("2000"))
        self.assertEqual(result.ratio, Decimal("6.00000"))
        # If today's (wrong) denominator were used the value would differ:
        self.assertNotEqual(result.ratio, water_ratio(Decimal("12000"), Decimal("500")).ratio)
        self.assertTrue(water_ratio(Decimal("12000"), Decimal("2000"), max_ratio=Decimal("5")).is_anomaly)
        self.assertIsNone(water_ratio(Decimal("100"), Decimal("0")).ratio)

    def test_yield_outturns(self):
        y1 = cherry_to_parchment(Decimal("1000"), Decimal("200"))
        self.assertEqual(y1.ratio, Decimal("0.2000"))
        self.assertEqual(y1.pct, Decimal("20.00"))
        self.assertEqual(y1.loss_kg, Decimal("800"))
        y2 = parchment_to_green(Decimal("200"), Decimal("170"))
        self.assertEqual(y2.ratio, Decimal("0.8500"))


class SignOffTests(BaseSetup):
    def test_same_user_rejected(self):
        with self.assertRaises(SignOffError):
            require_different_users(self.u1, self.u1)
        with self.assertRaises(SignOffError):
            record_dual_signoff(document_type="test.Doc", document_id=self.station.id,
                                first_label="Issued By", first_user=self.u1,
                                second_label="Received By", second_user=self.u1)

    def test_pin_verification(self):
        cred = SignatureCredential(user=self.u1)
        cred.set_pin("2468")
        cred.save()
        signoff = record_dual_signoff(document_type="test.Doc", document_id=self.station.id,
                                      first_label="Issued By", first_user=self.u1, first_pin="2468",
                                      second_label="Received By", second_user=self.u2)
        self.assertIsNotNone(signoff.pk)
        with self.assertRaises(SignOffError):
            record_dual_signoff(document_type="test.Doc", document_id=self.station.id,
                                first_label="Issued By", first_user=self.u1, first_pin="9999",
                                second_label="Received By", second_user=self.u2)


class PayrollTests(BaseSetup):
    def _sheet_with_entries(self):
        sheet = AttendanceSheet.objects.create(
            station=self.station, ethiopian_month=2, ethiopian_year=2018)
        daily = Worker.objects.create(worker_code="W-001", full_name="Daily Worker",
                                      station=self.station, wage_type=WageType.DAILY,
                                      wage_rate=Decimal("300"))
        hourly = Worker.objects.create(worker_code="W-002", full_name="Hourly Operator",
                                       station=self.station, kind=Worker.WorkerKind.MACHINE_OPERATOR,
                                       wage_type=WageType.HOURLY, wage_rate=Decimal("50"))
        piece = Worker.objects.create(worker_code="W-003", full_name="Piece Sorter",
                                      station=self.station, kind=Worker.WorkerKind.CHERRY_SORTER,
                                      wage_type=WageType.PIECE, wage_rate=Decimal("2"))
        # daily: 10 present + 1 half = 10.5 days -> 3150
        for day in range(1, 11):
            AttendanceEntry.objects.create(sheet=sheet, worker=daily, day=day,
                                           mark=AttendanceEntry.Mark.PRESENT, hours=Decimal("8"))
        AttendanceEntry.objects.create(sheet=sheet, worker=daily, day=11,
                                       mark=AttendanceEntry.Mark.HALF, hours=Decimal("4"))
        # hourly: 5 days x 8h = 40h -> 2000
        for day in range(1, 6):
            AttendanceEntry.objects.create(sheet=sheet, worker=hourly, day=day,
                                           mark=AttendanceEntry.Mark.PRESENT, hours=Decimal("8"))
        # piece: 1000 pieces -> 2000
        AttendanceEntry.objects.create(sheet=sheet, worker=piece, day=1,
                                       mark=AttendanceEntry.Mark.PRESENT, pieces=Decimal("1000"))
        WorkerAdvance.objects.create(worker=daily, sheet=sheet,
                                     advance_date=timezone.now().date(), amount=Decimal("150"))
        return sheet, daily, hourly, piece

    def test_payroll_blocked_without_dual_verification(self):
        sheet, *_ = self._sheet_with_entries()
        with self.assertRaises(PayrollError):
            generate_payroll(sheet, prepared_by=self.u1)
        # Only ONE signature is still blocked:
        sheet.controlled_by = self.u1
        sheet.save()
        with self.assertRaises(PayrollError):
            generate_payroll(sheet, prepared_by=self.u1)
        # Same user for both signatures is blocked too:
        sheet.verified_by = self.u1
        sheet.save()
        with self.assertRaises(PayrollError):
            generate_payroll(sheet, prepared_by=self.u2)

    def test_attendance_to_payroll_aggregation_math(self):
        sheet, daily, hourly, piece = self._sheet_with_entries()
        verify_attendance_sheet(sheet, controlled_by=self.u1, verified_by=self.u2)
        period = generate_payroll(sheet, prepared_by=self.u1)
        lines = {line.worker.worker_code: line for line in period.lines.all()}
        self.assertEqual(lines["W-001"].total_days, Decimal("10.5"))
        self.assertEqual(lines["W-001"].gross_pay, Decimal("3150.00"))   # 10.5 x 300
        self.assertEqual(lines["W-001"].deductions, Decimal("150"))      # advance
        self.assertEqual(lines["W-001"].net_pay, Decimal("3000.00"))
        self.assertEqual(lines["W-002"].total_hours, Decimal("40"))
        self.assertEqual(lines["W-002"].gross_pay, Decimal("2000.00"))   # 40h x 50
        self.assertEqual(lines["W-003"].gross_pay, Decimal("2000.00"))    # 1000 x 2
        self.assertEqual(period.total_gross, Decimal("7150.00"))
        self.assertEqual(period.total_net, Decimal("7000.00"))
        sheet.refresh_from_db()
        self.assertEqual(sheet.status, AttendanceSheet.Status.LOCKED)

    def test_payroll_approval_requires_distinct_approver(self):
        from hr_payroll.engine import approve_payroll
        sheet, *_ = self._sheet_with_entries()
        verify_attendance_sheet(sheet, controlled_by=self.u1, verified_by=self.u2)
        period = generate_payroll(sheet, prepared_by=self.u1)
        with self.assertRaises(PayrollError):
            approve_payroll(period, approved_by=self.u1)  # same as preparer
        approved = approve_payroll(period, approved_by=self.u2)
        self.assertEqual(approved.status, "approved")
