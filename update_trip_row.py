import re

file_path = 'src/lib/frota.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Make TripRow properties optional to fix type errors in admin screens
trip_row_pattern = r'export interface TripRow \{(.*?)\}'
match = re.search(trip_row_pattern, content, re.DOTALL)
if match:
    props = match.group(1).split('\n')
    new_props = []
    for prop in props:
        if ':' in prop and '?' not in prop:
            prop = prop.replace(':', '?:')
        new_props.append(prop)
    new_trip_row = 'export interface TripRow {' + '\n'.join(new_props) + '}'
    content = re.sub(trip_row_pattern, new_trip_row, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
