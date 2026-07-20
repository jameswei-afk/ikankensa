#!/usr/bin/env python3
"""
remove_item.py -- 從網站上完整移除一個已討論完成的品項

會清掉：
  - items 表該筆資料（連動刪除 item_files、comments 資料列）
  - item-files bucket 底下該品項的參考資料檔案（購入仕様書等）
  - comment-uploads bucket 底下該品項留言的附加圖片／檔案

用法：
    python remove_item.py PS-00046            # 先看看會刪什麼
    python remove_item.py PS-00046 --yes       # 實際執行刪除
"""
import argparse
import os
import sys
from pathlib import Path

import requests

from publish import load_dotenv

BUCKETS = ["item-files", "comment-uploads"]


def list_storage_objects(base_url, headers, bucket, prefix):
    resp = requests.post(
        f"{base_url}/storage/v1/object/list/{bucket}",
        headers=headers,
        json={"prefix": prefix, "limit": 1000},
        timeout=30,
    )
    resp.raise_for_status()
    return [f"{prefix}{obj['name']}" for obj in resp.json()]


def remove_storage_objects(base_url, headers, bucket, paths):
    if not paths:
        return
    resp = requests.delete(
        f"{base_url}/storage/v1/object/{bucket}",
        headers=headers,
        json={"prefixes": paths},
        timeout=30,
    )
    resp.raise_for_status()


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="從網站移除一個已討論完成的品項（含檔案、留言附件）")
    parser.add_argument("item_id", help="管理番号，例如 PS-00046")
    parser.add_argument("--yes", action="store_true", help="實際執行刪除（不加這個參數只會預覽）")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    load_dotenv(script_dir / ".env")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("[錯誤] 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，請確認 .env 是否存在。")

    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    item_id = args.item_id

    resp = requests.get(
        f"{url}/rest/v1/items", headers=headers,
        params={"id": f"eq.{item_id}", "select": "id,customer,part_no,part_name"},
    )
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        sys.exit(f"[錯誤] 找不到品項 {item_id}（可能已經刪除過了）")
    item = rows[0]
    print(f"品項：{item['id']}  {item.get('customer','')}  {item.get('part_no','')}  {item.get('part_name','')}")

    files_to_remove = {}
    for bucket in BUCKETS:
        paths = list_storage_objects(url, headers, bucket, f"{item_id}/")
        files_to_remove[bucket] = paths
        print(f"  {bucket}：{len(paths)} 個檔案")

    comments_resp = requests.get(
        f"{url}/rest/v1/comments", headers=headers,
        params={"item_id": f"eq.{item_id}", "select": "id"},
    )
    comments_resp.raise_for_status()
    print(f"  留言：{len(comments_resp.json())} 則")

    if not args.yes:
        print("\n這是預覽，尚未刪除任何東西。確認沒問題後執行：")
        print(f"  python remove_item.py {item_id} --yes")
        return

    for bucket, paths in files_to_remove.items():
        remove_storage_objects(url, headers, bucket, paths)

    del_resp = requests.delete(f"{url}/rest/v1/items", headers=headers, params={"id": f"eq.{item_id}"})
    del_resp.raise_for_status()

    total_files = sum(len(p) for p in files_to_remove.values())
    print(f"\n完成：已移除品項 {item_id}（{total_files} 個檔案、對應留言與附件皆已刪除）")


if __name__ == "__main__":
    main()
