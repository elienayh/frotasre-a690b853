import re

file_path = 'src/routes/_authenticated/admin.solicitacoes.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Update TripRow and fetching logic if needed (already updated TripRow in frota.ts)
# Add assigned_driver_user_id to the query if it's missing
if 'assigned_driver_user_id' not in content:
    content = content.replace('vehicle_id, approved_at,', 'vehicle_id, assigned_driver_user_id, approved_at,')

with open(file_path, 'w') as f:
    f.write(content)
