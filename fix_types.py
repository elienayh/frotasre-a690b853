import re

def fix_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)

# Fix AllocateDialog.tsx
fix_file('src/components/AllocateDialog.tsx', [
    ('new Date(trip.departure_at)', 'new Date(trip.departure_at || "")'),
    ('new Date(trip.return_at)', 'new Date(trip.return_at || "")'),
    ('p_passengers: trip!.passengers,', 'p_passengers: trip!.passengers || 0,'),
    ('.eq("id", trip!.id)', '.eq("id", trip!.id || "")'),
    ('TRIP_STATUS_LABEL[trip.status]', 'TRIP_STATUS_LABEL[trip.status || "PENDENTE"]'),
    ('tripId={trip.id}', 'tripId={trip.id || ""}'),
    ('requesterId={trip.requester_id}', 'requesterId={trip.requester_id || ""}')
])

# Fix TripForm.tsx
fix_file('src/components/TripForm.tsx', [
    ('.eq("trip_id", trip!.id)', '.eq("trip_id", trip!.id || "")'),
    ('new Date(trip.departure_at)', 'new Date(trip.departure_at || "")'),
    ('new Date(trip.return_at)', 'new Date(trip.return_at || "")'),
    ('.eq("id", trip.id)', '.eq("id", trip.id || "")')
])

# Fix admin.solicitacoes.tsx
fix_file('src/routes/_authenticated/admin.solicitacoes.tsx', [
    ('tripId={t.id}', 'tripId={t.id || ""}'),
    ('tripId={allocating.id}', 'tripId={allocating.id || ""}')
])

