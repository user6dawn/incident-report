"""
Create dummy student accounts and give them some of the [SAMPLE] incidents.

    python seed_users.py           # create 20 demo students
    python seed_users.py --clear   # delete every demo student (emails ending in DEMO_DOMAIN)

All demo accounts share the password DEMO_PASSWORD below and are confirmed
immediately. Their emails use a .test domain, so no real mailbox is involved.
Run `python seed.py` first so there are sample incidents to hand out.
"""

from __future__ import annotations

import argparse
import random

from dotenv import load_dotenv

from supabase_rest import Supabase

load_dotenv()

DEMO_DOMAIN = "students.bingham.test"
DEMO_PASSWORD = "Student@2026"  # demo only — every dummy student uses this

NAMES = [
    "Chinedu Okafor", "Aisha Bello", "Emeka Nwosu", "Fatima Abubakar", "Tunde Adeyemi",
    "Ngozi Eze", "Ibrahim Musa", "Blessing Okon", "Samuel Danjuma", "Zainab Yusuf",
    "Chioma Obi", "David Audu", "Halima Sani", "Joseph Akpan", "Grace Ogbu",
    "Usman Garba", "Esther Adebayo", "Kelechi Uche", "Maryam Lawal", "Daniel Ishaya",
]


class AuthAdmin:
    """Supabase Auth admin endpoints (service-role key)."""

    def __init__(self, db: Supabase) -> None:
        self.db = db
        self.base = db.base.replace("/rest/v1", "/auth/v1/admin")

    def list_users(self) -> list[dict]:
        users, page = [], 1
        while True:
            r = self.db.client.get(f"{self.base}/users", params={"page": page, "per_page": 200},
                                   headers=self.db.headers)
            r.raise_for_status()
            batch = r.json().get("users", [])
            users.extend(batch)
            if len(batch) < 200:
                return users
            page += 1

    def create_user(self, email: str, password: str, metadata: dict) -> dict:
        r = self.db.client.post(f"{self.base}/users", headers=self.db.headers, json={
            "email": email, "password": password, "email_confirm": True, "user_metadata": metadata,
        })
        r.raise_for_status()
        return r.json()

    def delete_user(self, user_id: str) -> None:
        r = self.db.client.delete(f"{self.base}/users/{user_id}", headers=self.db.headers)
        r.raise_for_status()


def email_for(name: str) -> str:
    first, last = name.lower().split()
    return f"{first}.{last}@{DEMO_DOMAIN}"


def clear(db: Supabase, auth: AuthAdmin) -> None:
    demo = [u for u in auth.list_users() if (u.get("email") or "").endswith(f"@{DEMO_DOMAIN}")]
    for u in demo:
        # Hand their reports back to "anonymous sample" so the incident data stays intact.
        db.client.patch(f"{db.base}/incidents", params={"reporter_id": f"eq.{u['id']}"},
                        headers=db.headers, json={"reporter_id": None, "is_anonymous": True}).raise_for_status()
        auth.delete_user(u["id"])  # also removes their profile and anonymous links (cascade)
    print(f"Deleted {len(demo)} demo students.")


def create(db: Supabase, auth: AuthAdmin) -> None:
    existing = {u.get("email") for u in auth.list_users()}
    created: list[dict] = []
    for i, name in enumerate(NAMES, start=1):
        email = email_for(name)
        if email in existing:
            continue
        user = auth.create_user(email, DEMO_PASSWORD, {
            "app": "incident",  # tells the database trigger to create an incident profile
            "full_name": name,
            "matric_no": f"BHU/22/04/09/{i:04d}",
        })
        created.append(user)
    print(f"Created {len(created)} demo students ({len(NAMES) - len(created)} already existed).")

    # Give reports to every demo student who has none yet (also finishes an interrupted run).
    demo = [u for u in auth.list_users() if (u.get("email") or "").endswith(f"@{DEMO_DOMAIN}")]
    has_named = {r["reporter_id"] for r in db.select_all("incidents", "reporter_id") if r["reporter_id"]}
    links = db.select_all("anonymous_reports", "incident_id,user_id", order="incident_id")
    has_anon = {r["user_id"] for r in links}
    created = [u for u in demo if u["id"] not in has_named and u["id"] not in has_anon]
    if not created:
        print("Every demo student already has reports.")
        return

    # Hand out unclaimed sample incidents: mostly named reports, some anonymous-but-linked.
    unclaimed = db.client.get(f"{db.base}/incidents", headers=db.headers, params={
        "select": "id", "description": "like.[SAMPLE]*", "reporter_id": "is.null", "order": "id",
    })
    unclaimed.raise_for_status()
    linked = {r["incident_id"] for r in links}
    pool = [r["id"] for r in unclaimed.json() if r["id"] not in linked]
    random.Random(42).shuffle(pool)

    named = anon = 0
    for user in created:
        for _ in range(random.Random(user["id"]).randint(3, 7)):
            if not pool:
                break
            incident_id = pool.pop()
            if random.random() < 0.75:
                db.client.patch(f"{db.base}/incidents", params={"id": f"eq.{incident_id}"}, headers=db.headers,
                                json={"reporter_id": user["id"], "is_anonymous": False}).raise_for_status()
                named += 1
            else:
                db.insert("anonymous_reports", [{"incident_id": incident_id, "user_id": user["id"]}])
                anon += 1
    print(f"Linked {named} named and {anon} anonymous sample reports to them.")
    print(f"Sign in as any of them, e.g. {email_for(NAMES[0])}, with the password in DEMO_PASSWORD (seed_users.py).")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clear", action="store_true")
    args = ap.parse_args()
    db = Supabase()
    auth = AuthAdmin(db)
    clear(db, auth) if args.clear else create(db, auth)


if __name__ == "__main__":
    main()
