import base64, json, pathlib, re, xml.etree.ElementTree as ET
root = pathlib.Path(__file__).resolve().parents[1]
dest = root / 'frontend/assets/design'
records = []
for source in sorted((root / 'frontend/design/figma-exports').glob('*.svg')):
    tree = ET.parse(source)
    for i, el in enumerate(tree.iter('{http://www.w3.org/2000/svg}image')):
        href = el.get('{http://www.w3.org/1999/xlink}href', el.get('href', ''))
        if not href.startswith('data:'): continue
        header, data = href.split(',', 1)
        extension = 'jpg' if 'jpeg' in header else 'png'
        name = f'{source.stem}-{i}.{extension}'
        (dest/name).write_bytes(base64.b64decode(data))
        records.append({'file': name, 'source': source.name, 'index': i})
(root/'tmp/design-review/assets.json').write_text(json.dumps(records, indent=2))
logo = (root/'frontend/design/figma-exports/24-logo.svg').read_text(encoding='utf-8-sig')
(root/'frontend/src/theme/logoArtwork.ts').write_text('export const logoArtwork = '+json.dumps(logo)+';\n',encoding='utf-8')
print(f'Extracted {len(records)} original image assets without modifying them.')
