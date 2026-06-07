#!/usr/bin/env python3
"""Trigger API sync from Python"""
import requests
import json

BASE_URL = "http://localhost:8000"
ADMIN_KEY = "SPCH0642"

def trigger_sync():
    """Trigger the /api/admin/sync endpoint"""
    print("🔄 Triggering data sync...\n")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/sync",
            headers={"X-Admin-Key": ADMIN_KEY},
            timeout=300  # 5 minutes timeout
        )
        
        print(f"Status: {response.status_code}")
        result = response.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        if response.status_code == 200:
            print("\n✅ Sync triggered successfully!")
        else:
            print("\n❌ Sync failed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    trigger_sync()
