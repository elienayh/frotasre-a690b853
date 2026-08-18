import re

def fix_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)

# Fix src/components/AllocateDialog.tsx line 174
fix_file('src/components/AllocateDialog.tsx', [
    ('tripId={trip.id}', 'tripId={trip.id || ""}')
])

# Fix src/routes/_authenticated/admin.solicitacoes.tsx lines 114, 215
fix_file('src/routes/_authenticated/admin.solicitacoes.tsx', [
    ('tripId={t.id}', 'tripId={t.id || ""}'),
    ('tripId={allocating.id}', 'tripId={allocating.id || ""}')
])
