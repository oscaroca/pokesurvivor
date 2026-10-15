#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera CREDITS.md con los artistas de cada sprite descargado.

    python tools/fetch_credits.py

Cada carpeta de SpriteCollab tiene un credits.txt (sin cabecera) con lineas
    fecha <TAB> autor <TAB> ...
donde el autor es un nombre o un ID de Discord ("<@!123...>"). Los IDs se
traducen con el credit_names.txt de la raiz del repo.
"""
import io
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets', 'pokemon')
OUT = os.path.join(ROOT, 'CREDITS.md')


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'pokesurvivor/1.0'})
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.read().decode('utf-8', 'replace')
    except Exception:
        return ''


def main():
    # ID de Discord / alias -> (nombre visible, contacto)
    names = {}
    for line in fetch(f'{RAW}/credit_names.txt').splitlines()[1:]:
        parts = line.split('\t')
        if len(parts) >= 2:
            display = parts[0].strip()
            contact = parts[2].strip() if len(parts) > 2 else ''
            names[parts[1].strip()] = (display, contact)
            names[display] = (display, contact)

    dexes = sorted(int(d) for d in os.listdir(ASSETS) if d.isdigit())
    # Megas y primigenias (tools/fetch_megas.py): clave de la carpeta -> carpeta de SpriteCollab.
    forms = {}
    megas = os.path.join(ROOT, 'js', 'data', 'megas.js')
    if os.path.exists(megas):
        for line in open(megas, encoding='utf-8'):
            m = re.match(r'^  \d+: (\[.*\]),$', line.strip('\r\n'))
            if m:
                for f in json.loads(m.group(1)):
                    if f.get('src') and os.path.isdir(os.path.join(ASSETS, f['key'])):
                        forms[f['key']] = f['src']

    def one(dex):
        # Créditos del sprite normal y del shiny (que puede ser de otro artista).
        if dex in forms:
            src, shiny_src = forms[dex], forms[dex] + '/0001'
        else:
            src, shiny_src = f'{dex:04d}', f'{dex:04d}/0000/0001'
        txt = fetch(f'{RAW}/sprite/{src}/credits.txt')
        if os.path.isdir(os.path.join(ASSETS, str(dex), 's')):
            txt += '\n' + fetch(f'{RAW}/sprite/{shiny_src}/credits.txt')
        authors = []
        for line in txt.splitlines():
            parts = line.split('\t')
            a = parts[1].strip() if len(parts) > 1 else ''
            if a and names.get(a, (a, ''))[0]:
                authors.append(a)
        return dex, authors

    per_artist = {}
    # Lo que ya estaba en CREDITS.md no se quita nunca: si en SpriteCollab cambian
    # el crédito de un sprite, el que tenemos descargado sigue siendo el de antes.
    if os.path.exists(OUT):
        for line in open(OUT, encoding='utf-8'):
            parts = [p.strip() for p in line.strip().strip('|').split('|')]
            if len(parts) == 3 and parts[0] not in ('Artista', '---') and not parts[0].startswith('-'):
                keys = {k.strip() for k in parts[2].split(',') if k.strip()}
                per_artist.setdefault((parts[0], parts[1]), set()).update(int(k) if k.isdigit() else k for k in keys)
    with ThreadPoolExecutor(max_workers=12) as ex:
        for dex, authors in ex.map(one, dexes + sorted(forms)):
            for a in set(authors):
                display, contact = names.get(a, (a, ''))
                per_artist.setdefault((display, contact), set()).add(dex)

    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# Créditos\n\n')
        f.write('## Sprites\n\n')
        f.write('Los sprites estilo *Pokémon Mundo Misterioso* vienen de\n')
        f.write('[SpriteCollab](https://github.com/PMDCollab/SpriteCollab), bajo licencia\n')
        f.write('[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/):\n')
        f.write('uso **no comercial** y con atribución a sus artistas.\n\n')
        f.write('| Artista | Contacto | Sprites (nº de Pokédex; "6-mega-x" = Mega-Charizard X) |\n|---|---|---|\n')
        for (display, contact), dx in sorted(per_artist.items(), key=lambda kv: kv[0][0].lower()):
            nums = ', '.join(str(d) for d in sorted(dx, key=lambda d: (int(str(d).split('-')[0]), str(d))))
            f.write(f'| {display} | {contact} | {nums} |\n')
        f.write('\n## Datos\n\n')
        f.write('Stats base y nombres en español: [PokeAPI](https://pokeapi.co/),\n')
        f.write('descargados una vez y guardados en `js/data/pokedex.js`.\n\n')
        f.write('## Fuente\n\n')
        f.write('[Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (SIL Open Font License 1.1,\n')
        f.write('licencia en `assets/fonts/OFL.txt`). El juego usa una versión modificada,\n')
        f.write('"Pixelify PS", con los números redibujados para distinguirlos mejor\n')
        f.write('(`tools/make_font.py`).\n\n')
        f.write('## Marca\n\n')
        f.write('Pokémon es propiedad de Nintendo, Creatures Inc. y GAME FREAK.\n')
        f.write('Este es un proyecto de fan sin ánimo de lucro.\n')

    print(f'{len(per_artist)} artistas para {len(dexes)} Pokemon -> CREDITS.md')


if __name__ == '__main__':
    main()
