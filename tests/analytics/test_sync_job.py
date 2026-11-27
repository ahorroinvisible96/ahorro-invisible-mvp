"""Offline unit tests for jobs/supabase-bigquery-sync/main.py (no GCP network needed)."""
import pathlib
import sys
import types
import unittest

# Stub google.cloud and requests so unit tests run hermetically without GCP credentials
_gc = types.ModuleType("google.cloud")
_bq = types.ModuleType("google.cloud.bigquery")


class _SchemaField:
    def __init__(self, name, field_type, mode="NULLABLE"):
        self.name = name
        self.field_type = field_type
        self.mode = mode


_bq.SchemaField = _SchemaField
_gc.bigquery = _bq
_gc.secretmanager = types.ModuleType("google.cloud.secretmanager")
sys.modules.setdefault("google", types.ModuleType("google"))
sys.modules["google.cloud"] = _gc
sys.modules["google.cloud.bigquery"] = _bq
sys.modules["google.cloud.secretmanager"] = _gc.secretmanager
sys.modules["requests"] = types.ModuleType("requests")

JOB_DIR = pathlib.Path(__file__).resolve().parents[2] / "jobs" / "supabase-bigquery-sync"
sys.path.insert(0, str(JOB_DIR))
import main  # noqa: E402


class _FakeDS:
    def __init__(self, location):
        self.location = location


class _FakeClient:
    def __init__(self, locations):
        self.locations = locations
        self.calls = []

    def get_dataset(self, ref):
        self.calls.append(ref)
        if ref in self.locations:
            return _FakeDS(self.locations[ref])
        raise RuntimeError("Not found")


class TestSyncJob(unittest.TestCase):
    def test_resolve_bq_location_uses_v2_datasets_and_never_raw_supabase(self):
        c1 = _FakeClient({"p.raw_supabase_v2": "EU"})
        self.assertEqual(main.resolve_bq_location(c1, "p", "raw_supabase_v2", "analytics_v2", None), "EU")
        self.assertEqual(c1.calls, ["p.raw_supabase_v2"])

        c2 = _FakeClient({})
        self.assertEqual(main.resolve_bq_location(c2, "p", "raw_supabase_v2", "analytics_v2", None), "EU")
        self.assertEqual(c2.calls, ["p.raw_supabase_v2", "p.analytics_v2"])
        self.assertEqual(
            main.resolve_bq_location(c2, "p", "raw_supabase_v2", "analytics_v2", "europe-west3"),
            "europe-west3",
        )

    def test_render_sql_replaces_bank_placeholder(self):
        sql = "SELECT * FROM `{{project}}.{{bank}}.mart_bank_segments` JOIN `{{project}}.{{an}}.params`"
        out = main.render_sql(sql, {"project": "p", "bank": "analytics_bank_v2", "an": "analytics_v2"})
        self.assertEqual(out, "SELECT * FROM `p.analytics_bank_v2.mart_bank_segments` JOIN `p.analytics_v2.params`")

    def test_normalize_rows_enforces_allowlist_and_numeric_precision(self):
        schema = main.S("id:STRING!", "amount:NUMERIC", "meta:STRING")
        rows = main.normalize_rows(
            [{"id": "1", "amount": 12.12345678999, "meta": {"b": 2, "a": 1}, "email": "secret@x.com"}],
            schema,
        )
        self.assertEqual(rows, [{"id": "1", "amount": 12.12345679, "meta": '{"a": 1, "b": 2}'}])

    def test_v2_tables_allowlist_excludes_pii(self):
        forbidden = {"email", "name", "title", "income_range", "user_free_text", "custom_text", "ip", "phone"}
        for tbl, cfg in main.V2_TABLES.items():
            col_names = set(main.cols(cfg["schema"]))
            self.assertFalse(col_names & forbidden, f"{tbl} exposes forbidden columns: {col_names & forbidden}")


if __name__ == "__main__":
    unittest.main()
