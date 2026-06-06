import requests
import json

base_url = "http://localhost:8000/api"

print("--- Check 1: clean_orders.csv ---")
files = {'file': open('Conduit/db/demo_csvs/clean_orders.csv', 'rb')}
data = {'target_table': 'orders_clean'}
r = requests.post(f"{base_url}/ingest", files=files, data=data)
print(r.status_code)
res = r.json()
print("Gateway status:", res.get('gateway_status'))

proposal_id_auto = res.get('proposal_id')

print("\n--- Check 2: drifted_orders.csv ---")
files = {'file': open('Conduit/db/demo_csvs/drifted_orders.csv', 'rb')}
data = {'target_table': 'orders_clean'}
r = requests.post(f"{base_url}/ingest", files=files, data=data)
res2 = r.json()
print("Gateway status:", res2.get('gateway_status'))
proposal_id_drift = res2.get('proposal_id')

print("\n--- Check 3: conflicted_orders.csv ---")
files = {'file': open('Conduit/db/demo_csvs/conflicted_orders.csv', 'rb')}
data = {'target_table': 'orders_clean'}
r = requests.post(f"{base_url}/ingest", files=files, data=data)
res3 = r.json()
print("Gateway status:", res3.get('gateway_status'))
proposal_id_conf = res3.get('proposal_id')

print("\n--- Check 4: Approve proposal ---")
r = requests.post(f"{base_url}/proposals/{proposal_id_auto}/approve", json={"human_approver_id": "demo_engineer_01"})
print(r.status_code)
print(r.json())

print("\n--- Check 5: Audit ---")
r = requests.get(f"{base_url}/audit")
audit_id = r.json()[0]['id']
r2 = requests.get(f"{base_url}/audit/{audit_id}")
print(r2.json())

print("\n--- Check 6: Sources ---")
r = requests.get(f"{base_url}/sources")
print(r.json())
