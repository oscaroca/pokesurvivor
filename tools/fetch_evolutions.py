#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja de PokeAPI las cadenas evolutivas y las deja en js/data/evolutions.js.

    python tools/fetch_evolutions.py

Sólo entran evoluciones entre Pokémon que están en la Pokédex del juego (los
que tienen sprite). El nivel es el de los juegos cuando evoluciona por nivel;
si evoluciona por piedra, intercambio, amistad... se le pone un nivel fijo
según la etapa (FALLBACK), para que en una run también se pueda.
"""
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

from fetch_pokedex import API, ROOT, get

OUT = os.path.join(ROOT, 'js', 'data', 'evolutions.js')
DEX = os.path.join(ROOT, 'js', 'data', 'pokedex.js')
# Nivel cuando no evoluciona por nivel: 1ª evolución / 2ª evolución.
FALLBACK = {1: 22, 2: 38}


def dex_ids():
    txt = open(DEX, encoding='utf-8').read()
    return [int(d) for d in re.findall(r'"dex":(\d+)', txt)]


def id_of(url):
    return int(url.rstrip('/').split('/')[-1])


def walk(node, stage, have, out):
    src = id_of(node['species']['url'])
    for nxt in node['evolves_to']:
        dst = id_of(nxt['species']['url'])
        lvls = [d.get('min_level') for d in nxt['evolution_details'] if d.get('min_level')]
        lvl = min(lvls) if lvls else FALLBACK.get(stage, 38)
        if src in have and dst in have:
            out.setdefault(src, []).append({'to': dst, 'lvl': lvl})
        walk(nxt, stage + 1, have, out)


def main():
    have = set(dex_ids())
    with ThreadPoolExecutor(16) as ex:
        species = list(ex.map(lambda d: get(f'{API}/pokemon-species/{d}'), sorted(have)))
    chains = sorted({s['evolution_chain']['url'] for s in species if s and s.get('evolution_chain')})
    with ThreadPoolExecutor(16) as ex:
        data = list(ex.map(get, chains))
    out = {}
    for c in data:
        if c:
            walk(c['chain'], 1, have, out)
    lines = [
        '/* ============ evolutions.js — GENERADO, no editar a mano ============',
        ' * Lo produce tools/fetch_evolutions.py a partir de PokeAPI.',
        ' * dex -> [{ to, lvl }]: en qué evoluciona y a qué nivel de la run.',
        ' * Si hay varias (Eevee, Poliwhirl...), se sortea una al llegar al nivel.',
        ' */',
        'G.EVO = {',
    ]
    for src in sorted(out):
        lines.append(f'  {src}: {json.dumps(out[src], separators=(",", ":"))},')
    lines.append('};')
    open(OUT, 'w', encoding='utf-8', newline='\r\n').write('\n'.join(lines) + '\n')
    print(f'{len(out)} Pokémon con evolución ({len(chains)} cadenas) -> {OUT}')


if __name__ == '__main__':
    main()
