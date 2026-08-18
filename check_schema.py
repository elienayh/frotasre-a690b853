import os
import json
import requests

def query_supabase(query):
    url = os.environ.get("VITE_SUPABASE_URL") + "/rest/v1/rpc/read_query"
    headers = {
        "apikey": os.environ.get("VITE_SUPABASE_ANON_KEY"),
        "Authorization": f"Bearer {os.environ.get('VITE_SUPABASE_ANON_KEY')}",
        "Content-Type": "application/json"
    }
    payload = {"query": query}
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# Check tables and columns
tables_query = """
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('vehicles', 'vehicle_blocks', 'trip_requests', 'fuel_records')
ORDER BY table_name, ordinal_position;
"""

print(json.dumps(query_supabase(tables_query), indent=2))
