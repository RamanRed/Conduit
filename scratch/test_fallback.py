import requests
import json

base_url = "http://localhost:8000/api"

print("--- Testing Fallback Cache on API Failure ---")
try:
    files = {'file': open('Conduit/db/demo_csvs/clean_orders.csv', 'rb')}
    data = {'target_table': 'orders_clean'}
    r = requests.post(f"{base_url}/ingest", files=files, data=data)
    print("Status Code:", r.status_code)
    res = r.json()
    print("Gateway status:", res.get('gateway_status'))
    print("LLM Model Used:", res.get('llm_model_used'))
    print("Reasoning:", res.get('reasoning'))
    print("Reasoning Note:", res.get('reasoning_note'))
    
    # Verify fallback fields
    if res.get('llm_model_used') == "cached-fallback":
        print("SUCCESS: Fallback cached proposal was returned successfully!")
    else:
        print("FAILURE: Did not fall back to cached proposal.")
except Exception as e:
    print("Error during test:", e)
