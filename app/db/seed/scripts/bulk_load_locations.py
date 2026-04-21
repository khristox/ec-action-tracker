#!/usr/bin/env python3
"""
Bulk load administrative locations from CSV file into the Action Tracker.
Handles hierarchical location data (country → region → district → etc.)
Supports location_mode: 'address' (default) or 'buildings'
"""

import csv
import os
import sys
import time
import asyncio
import logging
import argparse
import getpass
import json
from typing import List, Dict, Optional
from datetime import datetime
import httpx

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-8s | %(message)s')
logger = logging.getLogger(__name__)

LEVELS = {
    0: {"level": 1, "type": "country",   "name_field": "admin0Name_en", "code_field": "admin0Pcode", "mode": "address"},
    1: {"level": 2, "type": "region",    "name_field": "admin1Name_en", "code_field": "admin1Pcode", "mode": "address"},
    2: {"level": 3, "type": "district",  "name_field": "admin2Name_en", "code_field": "admin2Pcode", "mode": "address"},
    3: {"level": 4, "type": "county",    "name_field": "admin3Name_en", "code_field": "admin3Pcode", "mode": "address"},
    4: {"level": 5, "type": "subcounty", "name_field": "admin4Name_en", "code_field": "admin4Pcode", "mode": "address"},
    5: {"level": 6, "type": "parish",    "name_field": "admin5Name_en", "code_field": "admin5Pcode", "mode": "address"},
    6: {"level": 7, "type": "village",   "name_field": "admin6Name_en", "code_field": "admin6Pcode", "mode": "address"},
}

# Building/Facility levels (can be overridden)
BUILDING_LEVELS = {
    0: {"level": 1, "type": "campus",     "name_field": "campus_name",   "code_field": "campus_code", "mode": "buildings"},
    1: {"level": 2, "type": "building",   "name_field": "building_name", "code_field": "building_code", "mode": "buildings"},
    2: {"level": 3, "type": "floor",      "name_field": "floor_name",    "code_field": "floor_code", "mode": "buildings"},
    3: {"level": 4, "type": "room",       "name_field": "room_name",     "code_field": "room_code", "mode": "buildings"},
}

MAX_CONCURRENT = 5
MAX_RETRIES = 5
RETRY_DELAY = 1.0
BATCH_SIZE = 20


class LocationLoader:
    def __init__(self, base_url: str, token: str, mode: str = "address"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api/v1/locations/"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self.mode = mode
        self.created = 0
        self.skipped = 0
        self.errors = 0
        self.failed: List[Dict] = []
        self.cache: Dict[str, Dict] = {}
        self._sem = asyncio.Semaphore(MAX_CONCURRENT)
        self.stats = {
            "start_time": None,
            "end_time": None,
            "levels_processed": {},
        }

    def parse_csv(self, path: str) -> Dict[int, List[Dict]]:
        """Return locations grouped by level, ordered 1→7."""
        cache: Dict[str, Dict] = {}
        parents: Dict[str, str] = {}
        
        levels_config = BUILDING_LEVELS if self.mode == "buildings" else LEVELS

        with open(path, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            logger.info(f"📄 CSV Headers: {list(reader.fieldnames)}")
            
            for row_num, row in enumerate(reader, 2):
                parent_code = None
                for i in range(len(levels_config)):
                    cfg = levels_config[i]
                    name = row.get(cfg["name_field"], "").strip()
                    code = row.get(cfg["code_field"], "").strip()
                    
                    if not name or not code:
                        parent_code = None
                        continue
                    
                    if parent_code:
                        parents[code] = parent_code
                    
                    if code not in cache:
                        cache[code] = {
                            "code": code,
                            "name": name,
                            "level": cfg["level"],
                            "location_type": cfg["type"],
                            "location_mode": cfg.get("mode", self.mode),
                        }
                    
                    parent_code = code

        grouped: Dict[int, List[Dict]] = {}
        for code, loc in cache.items():
            loc["parent_code"] = parents.get(code)
            grouped.setdefault(loc["level"], []).append(loc)

        total = sum(len(v) for v in grouped.values())
        logger.info(f"📊 Parsed {total} unique locations across {len(grouped)} levels")
        for level in sorted(grouped.keys()):
            logger.info(f"   Level {level}: {len(grouped[level])} locations")
        return grouped

    async def _test_endpoint(self, client: httpx.AsyncClient) -> bool:
        """Test if the API endpoint is accessible"""
        try:
            r = await client.get(self.api_url, headers=self.headers)
            if r.status_code in (200, 405):
                logger.info(f"✅ API endpoint accessible: {self.api_url}")
                return True
            else:
                logger.warning(f"⚠️ API endpoint returned {r.status_code}: {self.api_url}")
                return False
        except Exception as e:
            logger.warning(f"⚠️ Cannot access API endpoint: {self.api_url} - {e}")
            return False

    async def _fetch_by_code(self, client: httpx.AsyncClient, code: str) -> Optional[Dict]:
        """GET a location by code; returns slim dict or None."""
        for attempt in range(MAX_RETRIES):
            try:
                url = f"{self.api_url}by-code/{code}"
                r = await client.get(url, headers=self.headers)
                
                if r.status_code == 200:
                    obj = r.json()
                    return {
                        "id": obj["id"],
                        "level": obj["level"],
                        "name": obj["name"],
                        "code": obj["code"],
                        "location_mode": obj.get("location_mode", "address"),
                    }
                elif r.status_code == 404:
                    return None
                elif r.status_code in (429, 502, 503, 504):
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                else:
                    return None
                    
            except Exception as exc:
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                logger.debug(f"fetch_by_code({code}) error: {exc}")
        return None

    async def _post_location(self, client: httpx.AsyncClient, loc: Dict) -> Optional[Dict]:
        """POST a single location."""
        parent_code = loc.get("parent_code")
        parent_info = self.cache.get(parent_code) if parent_code else None

        if parent_code and not parent_info:
            parent_info = await self._fetch_by_code(client, parent_code)
            if parent_info:
                self.cache[parent_code] = parent_info

        if parent_code and not parent_info:
            logger.warning(f"⚠️ Parent not found for {loc['code']} (parent={parent_code})")
            return None

        payload: Dict = {
            "code": loc["code"],
            "name": loc["name"],
            "level": loc["level"],
            "location_type": loc["location_type"],
            "location_mode": loc.get("location_mode", self.mode),
        }
        if parent_info:
            payload["parent_id"] = parent_info["id"]

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = await client.post(self.api_url, json=payload, headers=self.headers)

                if r.status_code == 201:
                    return r.json()

                if r.status_code == 400:
                    error_text = r.text.lower()
                    if "already exists" in error_text or "duplicate" in error_text:
                        existing = await self._fetch_by_code(client, loc["code"])
                        if existing:
                            return existing
                    
                    logger.error(f"❌ {loc['code']}: Validation error - {r.text[:200]}")
                    return None

                if r.status_code == 409:
                    existing = await self._fetch_by_code(client, loc["code"])
                    if existing:
                        return existing
                    return None

                if r.status_code in (429, 502, 503, 504):
                    wait = RETRY_DELAY * attempt
                    logger.warning(f"⏳ {r.status_code} on {loc['code']}, retry {attempt}/{MAX_RETRIES} in {wait}s")
                    await asyncio.sleep(wait)
                    continue

                logger.error(f"❌ {loc['code']}: HTTP {r.status_code} — {r.text[:200]}")
                return None

            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                wait = RETRY_DELAY * attempt
                logger.warning(f"⏳ Network error on {loc['code']}, retry {attempt}/{MAX_RETRIES} in {wait}s: {exc}")
                await asyncio.sleep(wait)

        logger.error(f"❌ Gave up on {loc['code']} after {MAX_RETRIES} attempts")
        return None

    async def _process_location(self, client: httpx.AsyncClient, loc: Dict) -> None:
        """Process one location with concurrency control."""
        async with self._sem:
            if loc["code"] in self.cache:
                self.skipped += 1
                return

            result = await self._post_location(client, loc)

            if result:
                self.cache[loc["code"]] = {
                    "id": result["id"],
                    "level": result["level"],
                    "name": result["name"],
                    "code": result["code"],
                }
                self.created += 1
                if self.created % 20 == 0:
                    logger.info(f"     ... created {self.created} locations so far")
            else:
                self.errors += 1
                self.failed.append(loc)

    async def load(self, csv_file: str) -> Dict[str, int]:
        """Load all locations from CSV file"""
        self.stats["start_time"] = datetime.now()
        
        grouped = self.parse_csv(csv_file)
        
        if not grouped:
            logger.error("No locations parsed from CSV")
            return {"created": 0, "skipped": 0, "errors": 0}

        async with httpx.AsyncClient(timeout=60.0) as client:
            if not await self._test_endpoint(client):
                logger.error(f"❌ API endpoint not accessible: {self.api_url}")
                return {"created": 0, "skipped": 0, "errors": 0}

            for level in sorted(grouped.keys()):
                locs = grouped[level]
                
                levels_config = BUILDING_LEVELS if self.mode == "buildings" else LEVELS
                level_info = None
                for i, cfg in levels_config.items():
                    if cfg["level"] == level:
                        level_info = cfg
                        break
                
                level_name = level_info["type"].capitalize() if level_info else f"Level {level}"
                total_locs = len(locs)
                
                logger.info(f"\n📌 Level {level} — {level_name} ({total_locs} locations)")
                logger.info(f"  Processing...")
                
                # Process in batches
                batch_start = 0
                while batch_start < total_locs:
                    batch_end = min(batch_start + BATCH_SIZE, total_locs)
                    batch = locs[batch_start:batch_end]
                    
                    tasks = [self._process_location(client, loc) for loc in batch]
                    await asyncio.gather(*tasks)
                    
                    batch_start = batch_end
                    
                    if batch_start < total_locs:
                        await asyncio.sleep(0.5)

                # Level statistics
                prev_created = sum(s.get("created", 0) for s in self.stats["levels_processed"].values())
                prev_skipped = sum(s.get("skipped", 0) for s in self.stats["levels_processed"].values())
                prev_errors = sum(s.get("errors", 0) for s in self.stats["levels_processed"].values())
                
                self.stats["levels_processed"][level] = {
                    "name": level_name,
                    "total": total_locs,
                    "created": self.created - prev_created,
                    "skipped": self.skipped - prev_skipped,
                    "errors": self.errors - prev_errors,
                }
                
                logger.info(
                    f"   Level {level} done | "
                    f"✅ created={self.stats['levels_processed'][level]['created']} | "
                    f"⏭️ skipped={self.stats['levels_processed'][level]['skipped']} | "
                    f"❌ errors={self.stats['levels_processed'][level]['errors']}"
                )

        self.stats["end_time"] = datetime.now()
        elapsed = (self.stats["end_time"] - self.stats["start_time"]).total_seconds()
        self._print_summary(elapsed)
        
        return {"created": self.created, "skipped": self.skipped, "errors": self.errors}

    def _print_summary(self, elapsed: float):
        """Print loading summary"""
        logger.info(f"\n{'='*60}")
        logger.info(f"  📊 LOADING COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"  Mode: {self.mode.upper()}")
        logger.info(f"  Duration: {elapsed:.1f}s")
        logger.info(f"  ✅ Created: {self.created}")
        logger.info(f"  ⏭️  Skipped: {self.skipped}")
        logger.info(f"  ❌ Errors: {self.errors}")
        
        if self.failed:
            logger.info(f"\n  Failed locations ({len(self.failed)}):")
            for loc in self.failed[:10]:
                logger.info(f"    • {loc['code']} - {loc['name']} (Level {loc['level']})")
            if len(self.failed) > 10:
                logger.info(f"    ... and {len(self.failed) - 10} more")
        
        if self.failed:
            failed_file = f"failed_locations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(failed_file, 'w') as f:
                json.dump(self.failed, f, indent=2)
            logger.info(f"\n  💾 Failed locations saved to: {failed_file}")
        
        logger.info(f"{'='*60}\n")


# ------------------------------------------------------------------ #
#  Auth + entry point                                                #
# ------------------------------------------------------------------ #

async def get_config_interactive():
    """Get configuration interactively from user"""
    print("\n" + "=" * 60)
    print("  LOCATION BULK LOADER - CONFIGURATION")
    print("=" * 60)
    
    # Get base URL
    default_url = "http://127.0.0.1:8001"
    base_url = input(f"Enter API base URL [{default_url}]: ").strip()
    if not base_url:
        base_url = default_url
    logger.info(f"📁 Base URL: {base_url}")
    
    # Get username
    default_username = "admin"
    username = input(f"Enter username [{default_username}]: ").strip()
    if not username:
        username = default_username
    logger.info(f"👤 Username: {username}")
    
    # Get password (hidden input)
    password = getpass.getpass("Enter password: ")
    if not password:
        logger.error("❌ Password is required")
        sys.exit(1)
    
    # Get mode
    print("\nLocation Mode:")
    print("  1. address (default) - Administrative locations (countries, districts, etc.)")
    print("  2. buildings - Building/facility locations (campuses, buildings, rooms)")
    mode_choice = input("Select mode [1]: ").strip()
    mode = "buildings" if mode_choice == "2" else "address"
    
    return base_url, username, password, mode


async def login(base_url: str, username: str, password: str) -> str:
    """Login and get access token"""
    logger.info("🔐 Authenticating...")
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Try multiple login endpoints
        login_endpoints = [
            f"{base_url}/api/v1/auth/login",
            f"{base_url}/auth/login",
            f"{base_url}/login",
        ]
        
        for endpoint in login_endpoints:
            try:
                # Try form data
                r = await client.post(
                    endpoint,
                    data={"username": username, "password": password},
                )
                
                if r.status_code == 200:
                    data = r.json()
                    token = data.get("access_token") or data.get("token")
                    if token:
                        logger.info("✅ Authenticated successfully")
                        return token
                
                # Try JSON
                r = await client.post(
                    endpoint,
                    json={"username": username, "password": password},
                )
                
                if r.status_code == 200:
                    data = r.json()
                    token = data.get("access_token") or data.get("token")
                    if token:
                        logger.info("✅ Authenticated successfully")
                        return token
                        
            except Exception as e:
                logger.debug(f"Login attempt to {endpoint} failed: {e}")
                continue
        
        logger.error("❌ Login failed - could not authenticate")
        raise SystemExit("Authentication failed")


async def check_server_health(base_url: str) -> bool:
    """Check if the server is running and healthy"""
    health_endpoints = [
        f"{base_url}/health",
        f"{base_url}/api/v1/health",
        f"{base_url}/",
    ]
    
    for endpoint in health_endpoints:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(endpoint)
                if response.status_code < 500:
                    logger.info(f"✅ Server is reachable at {base_url}")
                    return True
        except:
            continue
    
    logger.error(f"❌ Cannot connect to server at {base_url}")
    return False


async def main():
    parser = argparse.ArgumentParser(
        description="Bulk-load administrative locations from CSV file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode (will prompt for all inputs)
  python load_locations.py locations.csv
  
  # Non-interactive mode with all parameters
  python load_locations.py locations.csv --non-interactive --url http://127.0.0.1:8001 --username admin --password yourpass --mode address
        """
    )
    parser.add_argument("csv_file", nargs="?", help="CSV file with location data")
    parser.add_argument("--url", help="API base URL")
    parser.add_argument("--username", help="Admin username")
    parser.add_argument("--password", help="Admin password")
    parser.add_argument("--mode", choices=["address", "buildings"], help="Location mode: address or buildings")
    parser.add_argument("--concurrency", type=int, default=MAX_CONCURRENT,
                        help=f"Max parallel requests (default: {MAX_CONCURRENT})")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE,
                        help=f"Batch size for processing (default: {BATCH_SIZE})")
    parser.add_argument("--non-interactive", action="store_true",
                        help="Run in non-interactive mode (no prompts)")
    
    args = parser.parse_args()
    
    # Check if CSV file is provided
    if not args.csv_file:
        if args.non_interactive:
            logger.error("CSV file path is required in non-interactive mode")
            sys.exit(1)
        
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
    
    # Get configuration
    if args.non_interactive:
        # Non-interactive mode - use command line args
        if not args.url:
            logger.error("❌ --url is required in non-interactive mode")
            sys.exit(1)
        if not args.username:
            logger.error("❌ --username is required in non-interactive mode")
            sys.exit(1)
        if not args.password:
            logger.error("❌ --password is required in non-interactive mode")
            sys.exit(1)
        
        base_url = args.url
        username = args.username
        password = args.password
        mode = args.mode or "address"
    else:
        # Interactive mode - prompt user
        base_url, username, password, mode = await get_config_interactive()
    
    logger.info(f"\n📁 Configuration:")
    logger.info(f"   URL: {base_url}")
    logger.info(f"   Username: {username}")
    logger.info(f"   Mode: {mode}")
    
    # Check server health
    logger.info(f"\n🔍 Checking server health...")
    if not await check_server_health(base_url):
        logger.error("Server is not reachable. Exiting.")
        sys.exit(1)
    
    # Login and get token
    token = await login(base_url, username, password)
    
    # Load locations
    logger.info(f"\n{'='*60}")
    logger.info(f"  🚀 Starting location loader")
    logger.info(f"  Mode: {mode.upper()}")
    logger.info(f"  Concurrency: {args.concurrency}")
    logger.info(f"  Batch size: {args.batch_size}")
    logger.info(f"{'='*60}\n")
    
    loader = LocationLoader(base_url, token, mode=mode)
    loader._sem = asyncio.Semaphore(args.concurrency)
    result = await loader.load(args.csv_file)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n⚠️ Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)