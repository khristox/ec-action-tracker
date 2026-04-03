#!/usr/bin/env python3
"""
Bulk load administrative locations from CSV file into the Action Tracker.
Handles hierarchical location data (country → region → district → etc.)
"""

import csv
import os
import sys
import time
import asyncio
import logging
import argparse
import getpass
from typing import List, Dict, Optional
import httpx

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s')
logger = logging.getLogger(__name__)

LEVELS = {
    0: {"level": 1, "type": "country",   "name_field": "admin0Name_en", "code_field": "admin0Pcode"},
    1: {"level": 2, "type": "region",    "name_field": "admin1Name_en", "code_field": "admin1Pcode"},
    2: {"level": 3, "type": "district",  "name_field": "admin2Name_en", "code_field": "admin2Pcode"},
    3: {"level": 4, "type": "county",    "name_field": "admin3Name_en", "code_field": "admin3Pcode"},
    4: {"level": 5, "type": "subcounty", "name_field": "admin4Name_en", "code_field": "admin4Pcode"},
    5: {"level": 6, "type": "parish",    "name_field": "admin5Name_en", "code_field": "admin5Pcode"},
    6: {"level": 7, "type": "village",   "name_field": "admin6Name_en", "code_field": "admin6Pcode"},
}

MAX_CONCURRENT = 10   # parallel requests per level
MAX_RETRIES    = 3    # per-location retry attempts
RETRY_DELAY    = 1.0  # seconds between retries


class LocationLoader:
    def __init__(self, base_url: str, token: str):
        self.base_url  = base_url.rstrip('/')
        self.api_url   = f"{self.base_url}/api/v1/locations/"
        self.headers   = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self.created  = 0
        self.skipped  = 0
        self.errors   = 0
        self.failed: List[Dict] = []                 # permanently failed
        self.cache: Dict[str, Dict] = {}             # code -> {id, level, name, code}
        self._sem = asyncio.Semaphore(MAX_CONCURRENT)

    # ------------------------------------------------------------------ #
    #  CSV parsing                                                         #
    # ------------------------------------------------------------------ #

    def parse_csv(self, path: str) -> Dict[int, List[Dict]]:
        """Return locations grouped by level, ordered 1→7."""
        cache: Dict[str, Dict] = {}
        parents: Dict[str, str] = {}

        with open(path, encoding='utf-8') as f:
            for row in csv.DictReader(f):
                parent_code = None
                for i in range(7):
                    cfg  = LEVELS[i]
                    name = row.get(cfg["name_field"], "").strip()
                    code = row.get(cfg["code_field"],  "").strip()
                    if not name or not code:
                        parent_code = None   # reset — hierarchy broken here
                        continue
                    if parent_code:
                        parents[code] = parent_code
                    if code not in cache:
                        cache[code] = {
                            "code": code, "name": name,
                            "level": cfg["level"], "location_type": cfg["type"],
                        }
                    parent_code = code

        grouped: Dict[int, List[Dict]] = {}
        for code, loc in cache.items():
            loc["parent_code"] = parents.get(code)
            grouped.setdefault(loc["level"], []).append(loc)

        total = sum(len(v) for v in grouped.values())
        logger.info(f"📊 Parsed {total} unique locations across {len(grouped)} levels")
        return grouped

    # ------------------------------------------------------------------ #
    #  API helpers                                                         #
    # ------------------------------------------------------------------ #

    async def _fetch_by_code(self, client: httpx.AsyncClient, code: str) -> Optional[Dict]:
        """GET a location by code; returns slim dict or None."""
        try:
            r = await client.get(
                f"{self.api_url}by-code/{code}",
                headers=self.headers,
            )
            if r.status_code == 200:
                obj = r.json()
                return {"id": obj["id"], "level": obj["level"],
                        "name": obj["name"],  "code": obj["code"]}
        except Exception as exc:
            logger.debug(f"fetch_by_code({code}) error: {exc}")
        return None

    async def _post_location(self, client: httpx.AsyncClient, loc: Dict) -> Optional[Dict]:
        """
        POST a single location.  Returns the created object dict, or None on failure.
        Handles 201 (created) and 400-already-exists (idempotent).
        """
        parent_code = loc.get("parent_code")
        parent_info = self.cache.get(parent_code) if parent_code else None

        # Parent must be in cache before we can POST the child
        if parent_code and not parent_info:
            parent_info = await self._fetch_by_code(client, parent_code)
            if parent_info:
                self.cache[parent_code] = parent_info

        if parent_code and not parent_info:
            logger.warning(f"⚠️  Parent not found for {loc['code']} (parent={parent_code})")
            return None

        payload: Dict = {
            "code":          loc["code"],
            "name":          loc["name"],
            "level":         loc["level"],
            "location_type": loc["location_type"],
        }
        if parent_info:
            payload["parent_id"] = parent_info["id"]

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = await client.post(self.api_url, json=payload, headers=self.headers)

                if r.status_code == 201:
                    return r.json()

                if r.status_code == 400 and "already exists" in r.text.lower():
                    # Treat as success — fetch the real record so we have its id
                    existing = await self._fetch_by_code(client, loc["code"])
                    if existing:
                        return existing
                    return None   # shouldn't happen

                if r.status_code in (429, 502, 503, 504):
                    wait = RETRY_DELAY * attempt
                    logger.warning(f"⏳ {r.status_code} on {loc['code']}, retry {attempt}/{MAX_RETRIES} in {wait}s")
                    await asyncio.sleep(wait)
                    continue

                # Any other non-2xx — log and give up
                logger.error(f"❌ {loc['code']}: HTTP {r.status_code} — {r.text[:120]}")
                return None

            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                wait = RETRY_DELAY * attempt
                logger.warning(f"⏳ Network error on {loc['code']}, retry {attempt}/{MAX_RETRIES} in {wait}s: {exc}")
                await asyncio.sleep(wait)

        logger.error(f"❌ Gave up on {loc['code']} after {MAX_RETRIES} attempts")
        return None

    # ------------------------------------------------------------------ #
    #  Core load loop                                                      #
    # ------------------------------------------------------------------ #

    async def _process_location(self, client: httpx.AsyncClient, loc: Dict) -> None:
        """Process one location with concurrency control."""
        async with self._sem:
            if loc["code"] in self.cache:
                self.skipped += 1
                return

            result = await self._post_location(client, loc)

            if result:
                self.cache[loc["code"]] = {
                    "id":    result["id"],
                    "level": result["level"],
                    "name":  result["name"],
                    "code":  result["code"],
                }
                if result.get("_was_existing"):
                    self.skipped += 1
                else:
                    self.created += 1
                    logger.info(f"✅ {loc['location_type'].capitalize()}: {loc['name']} ({loc['code']})")
            else:
                self.errors += 1
                self.failed.append(loc)

    async def load(self, csv_file: str) -> Dict[str, int]:
        grouped = self.parse_csv(csv_file)
        t0 = time.time()

        async with httpx.AsyncClient(timeout=30.0) as client:
            for level in sorted(grouped.keys()):
                locs = grouped[level]
                level_name = LEVELS[level - 1]["type"].capitalize()
                logger.info(f"\n📌 Level {level} — {level_name} ({len(locs)} locations)")

                # Fan out all locations at this level concurrently (semaphore caps it)
                await asyncio.gather(*[
                    self._process_location(client, loc) for loc in locs
                ])

                logger.info(
                    f"   Level {level} done | "
                    f"created={self.created} skipped={self.skipped} errors={self.errors}"
                )

        elapsed = time.time() - t0

        if self.failed:
            logger.warning(f"\n⚠️  {len(self.failed)} locations permanently failed:")
            for loc in self.failed:
                logger.warning(f"   • {loc['code']} ({loc['name']}, level {loc['level']})")

        logger.info(
            f"\n{'='*55}\n"
            f"  ✅ Done in {elapsed:.1f}s\n"
            f"     Created : {self.created}\n"
            f"     Skipped : {self.skipped}\n"
            f"     Errors  : {self.errors}\n"
            f"{'='*55}"
        )
        return {"created": self.created, "skipped": self.skipped, "errors": self.errors}


# ------------------------------------------------------------------ #
#  Auth + entry point                                                  #
# ------------------------------------------------------------------ #

def get_config_from_user(base_url: Optional[str] = None,
                         username: Optional[str] = None,
                         password: Optional[str] = None) -> tuple:
    """Prompt user for configuration with defaults"""
    is_interactive = sys.stdin.isatty()
    
    # Get base URL
    if not base_url:
        default_url = "http://localhost:8001"
        if is_interactive:
            print("\n" + "=" * 60)
            print("  LOCATION BULK LOADER - CONFIGURATION")
            print("=" * 60)
            base_url = input(f"Enter API base URL [{default_url}]: ").strip() or default_url
        else:
            base_url = default_url
        logger.info(f"📁 Base URL: {base_url}")
    
    # Get username
    if not username:
        default_username = "admin"
        if is_interactive:
            username = input(f"Enter username [{default_username}]: ").strip() or default_username
        else:
            username = default_username
        logger.info(f"📁 Username: {username}")
    
    # Get password (with hidden input)
    if not password:
        default_password = "Admin123!"
        if is_interactive:
            password = getpass.getpass(f"Enter password [{default_password}]: ") or default_password
        else:
            password = default_password
        logger.info(f"📁 Password: {'*' * len(password)}")
    
    return base_url, username, password


async def login(base_url: str, username: str, password: str) -> str:
    """Login and get access token"""
    logger.info("🔐 Logging in...")
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # Try form data first
            r = await client.post(
                f"{base_url}/api/v1/auth/login",
                data={"username": username, "password": password},
            )
            
            # If form data fails, try JSON
            if r.status_code != 200:
                r = await client.post(
                    f"{base_url}/api/v1/auth/login",
                    json={"username": username, "password": password},
                )
            
            if r.status_code != 200:
                logger.error(f"Login failed ({r.status_code}): {r.text[:200]}")
                raise SystemExit("Authentication failed. Please check your credentials.")
            
            data = r.json()
            token = data.get("access_token")
            if not token:
                logger.error("No access token in response")
                raise SystemExit("Authentication failed: No token received")
            
            logger.info("✅ Authenticated successfully")
            return token
            
        except httpx.ConnectError:
            logger.error(f"❌ Cannot connect to server at {base_url}")
            logger.error("   Make sure the FastAPI server is running:")
            logger.error("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8001")
            raise SystemExit("Connection failed")
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            raise SystemExit(f"Login failed: {e}")


async def check_server_health(base_url: str) -> bool:
    """Check if the server is running and healthy"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try to hit the health check endpoint
            response = await client.get(f"{base_url}/health")
            if response.status_code == 200:
                logger.info(f"✅ Server is healthy at {base_url}")
                return True
            else:
                logger.warning(f"⚠️ Server returned status {response.status_code}")
                return False
    except httpx.ConnectError:
        logger.error(f"❌ Cannot connect to server at {base_url}")
        logger.error("   Make sure the FastAPI server is running:")
        logger.error("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8001")
        return False
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        return False


async def main():
    parser = argparse.ArgumentParser(
        description="Bulk-load administrative locations from CSV file",
        epilog="If no arguments are provided, you will be prompted for them."
    )
    parser.add_argument("csv_file", nargs="?", help="CSV file with location data")
    parser.add_argument("--url", help="API base URL (default: http://localhost:8001)")
    parser.add_argument("--username", help="Admin username (default: admin)")
    parser.add_argument("--password", help="Admin password (default: Admin123)")
    parser.add_argument("--concurrency", type=int, default=MAX_CONCURRENT,
                        help=f"Max parallel requests (default: {MAX_CONCURRENT})")
    parser.add_argument("--non-interactive", action="store_true",
                        help="Run in non-interactive mode (use defaults or command line args)")
    
    args = parser.parse_args()
    
    # Check if CSV file is provided
    if not args.csv_file:
        if args.non_interactive:
            logger.error("CSV file path is required in non-interactive mode")
            sys.exit(1)
        
        # Prompt for CSV file
        print("\n" + "=" * 60)
        print("  LOCATION BULK LOADER - FILE SELECTION")
        print("=" * 60)
        csv_file = input("Enter path to CSV file: ").strip()
        if not csv_file:
            logger.error("CSV file path is required")
            sys.exit(1)
        args.csv_file = csv_file
    
    # Check if CSV file exists
    if not os.path.exists(args.csv_file):
        logger.error(f"File not found: {args.csv_file}")
        sys.exit(1)
    
    # Get configuration (prompt if not provided)
    base_url, username, password = get_config_from_user(
        args.url, args.username, args.password
    )
    
    # Check server health
    logger.info(f"🔍 Checking server health at {base_url}...")
    if not await check_server_health(base_url):
        logger.error("Server is not reachable. Exiting.")
        logger.info("\n📝 To start the server:")
        logger.info("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8001")
        sys.exit(1)
    
    # Login and get token
    token = await login(base_url, username, password)
    
    # Load locations
    loader = LocationLoader(base_url, token)
    loader._sem = asyncio.Semaphore(args.concurrency)
    await loader.load(args.csv_file)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n⚠️ Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)