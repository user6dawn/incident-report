"""Minimal Supabase (PostgREST) client using the service-role key. Server-side only."""

from __future__ import annotations

import os

import httpx


class Supabase:
    def __init__(self) -> None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)")
        self.base = f"{url.rstrip('/')}/rest/v1"
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        self.client = httpx.Client(timeout=30)

    def select_all(self, table: str, columns: str, page: int = 1000, order: str = "id") -> list[dict]:
        rows, start = [], 0
        while True:
            r = self.client.get(
                f"{self.base}/{table}",
                params={"select": columns, "order": order},
                headers={**self.headers, "Range": f"{start}-{start + page - 1}"},
            )
            r.raise_for_status()
            batch = r.json()
            rows.extend(batch)
            if len(batch) < page:
                return rows
            start += page

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if not rows:
            return
        r = self.client.post(
            f"{self.base}/{table}",
            params={"on_conflict": on_conflict},
            headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=rows,
        )
        r.raise_for_status()

    def insert(self, table: str, rows: list[dict]) -> None:
        for i in range(0, len(rows), 500):
            r = self.client.post(
                f"{self.base}/{table}",
                headers={**self.headers, "Prefer": "return=minimal"},
                json=rows[i:i + 500],
            )
            r.raise_for_status()

    def delete(self, table: str, filters: dict[str, str]) -> None:
        r = self.client.delete(f"{self.base}/{table}", params=filters, headers=self.headers)
        r.raise_for_status()
