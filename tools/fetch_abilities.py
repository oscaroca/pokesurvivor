#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja de PokeAPI la habilidad principal de cada Pokémon (la del primer hueco,
no la oculta) y sus nombres oficiales, y lo deja en js/data/abilities-dex.js.

    python tools/fetch_abilities.py

Qué hace cada habilidad en el juego no se baja: está en js/data/abilities.js,
a mano. Las que aún no tienen efecto salen en docs/habilidades-pendientes.md
(node tools/abilities_report.js).
"""
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

from fetch_pokedex import API, ROOT, get

OUT = os.path.join(ROOT, 'js', 'data', 'abilities-dex.js')
DEX = os.path.join(ROOT, 'js', 'data', 'pokedex.js')


def name_in(names, lang, fallback):
    for n in names:
        if n['language']['name'] == lang:
            return n['name']
    return fallback


def main():
    dexes = [int(d) for d in re.findall(r'"dex":(\d+)', open(DEX, encoding='utf-8').read())]
    with ThreadPoolExecutor(16) as ex:
        mons = list(ex.map(lambda d: get(f'{API}/pokemon/{d}'), dexes))
    of = {}
    for d, p in zip(dexes, mons):
        if not p:
            raise SystemExit(f'{d}: no disponible')
        first = sorted((a for a in p['abilities'] if not a['is_hidden']), key=lambda a: a['slot'])
        of[d] = (first or p['abilities'])[0]['ability']['name']
    ids = sorted(set(of.values()))
    with ThreadPoolExecutor(16) as ex:
        abil = list(ex.map(lambda a: get(f'{API}/ability/{a}'), ids))
    names = {}
    for a, data in zip(ids, abil):
        en = a.replace('-', ' ').title()
        names[a] = [name_in(data['names'], 'es', en), name_in(data['names'], 'en', en)] if data else [en, en]
    lines = [
        '/* ============ abilities-dex.js — GENERADO, no editar a mano ============',
        ' * Lo produce tools/fetch_abilities.py a partir de PokeAPI.',
        ' *   G.ABILITY_DEX[dex]  = id de su habilidad principal',
        ' *   G.ABILITY_NAME[id]  = [español, inglés]',
        ' * Lo que hace cada una está en data/abilities.js.',
        ' */',
        'G.ABILITY_DEX = {',
    ]
    for d in dexes:
        lines.append(f"  {d}: '{of[d]}',")
    lines += ['};', '', 'G.ABILITY_NAME = {']
    for a in ids:
        lines.append(f'  {json.dumps(a)}: {json.dumps(names[a], ensure_ascii=False)},')
    lines.append('};')
    open(OUT, 'w', encoding='utf-8', newline='\r\n').write('\n'.join(lines) + '\n')
    print(f'{len(dexes)} Pokémon, {len(ids)} habilidades -> {OUT}')


if __name__ == '__main__':
    main()
