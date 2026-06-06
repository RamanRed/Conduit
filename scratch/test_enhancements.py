import requests
import io

base_url = "http://localhost:8000/api"

def test_zero_common_columns():
    print("--- Testing Zero Matching Columns ---")
    csv_content = "unknown_col_1,unknown_col_2\nval1,val2\n"
    file_tuple = ('mismatched.csv', io.StringIO(csv_content), 'text/csv')
    r = requests.post(
        f"{base_url}/ingest",
        files={'file': file_tuple},
        data={'target_table': 'orders_clean'}
    )
    print("Status Code:", r.status_code)
    try:
        res = r.json()
        print("Gateway Status:", res.get('gateway_status'))
        print("Confidence Score:", res.get('confidence_score'))
        print("Proposed Steps:", res.get('proposed_steps'))
        print("Drift Detected:", res.get('drift_detected'))
        print("Generated Code:", res.get('generated_code'))
        print("LLM Model Used:", res.get('llm_model_used'))
    except Exception as e:
        print("Error parsing response:", e)
        print("Raw response:", r.text)

def test_malformed_csv():
    print("\n--- Testing Malformed CSV (ParserError) ---")
    csv_content = 'col1,col2\n"unclosed_quote,val\nrow2,val2\n'
    file_tuple = ('malformed.csv', io.StringIO(csv_content), 'text/csv')
    r = requests.post(
        f"{base_url}/ingest",
        files={'file': file_tuple},
        data={'target_table': 'orders_clean'}
    )
    print("Status Code:", r.status_code)
    try:
        res = r.json()
        print("Error Response Detail:", res.get('detail'))
    except Exception as e:
        print("Error parsing response:", e)
        print("Raw response:", r.text)

def test_empty_csv():
    print("\n--- Testing Empty CSV (EmptyDataError) ---")
    csv_content = '   \n  \n' # Not 0 bytes (which passes magic bytes check), but empty when parsing
    file_tuple = ('empty.csv', io.StringIO(csv_content), 'text/csv')
    r = requests.post(
        f"{base_url}/ingest",
        files={'file': file_tuple},
        data={'target_table': 'orders_clean'}
    )
    print("Status Code:", r.status_code)
    try:
        res = r.json()
        print("Error Response Detail:", res.get('detail'))
    except Exception as e:
        print("Error parsing response:", e)
        print("Raw response:", r.text)

if __name__ == "__main__":
    test_zero_common_columns()
    test_malformed_csv()
    test_empty_csv()
