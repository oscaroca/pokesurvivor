#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Megaevoluciones y regresiones primigenias: datos de PokeAPI y sprites de
SpriteCollab. Lo deja todo en js/data/megas.js y assets/pokemon/{clave}/.

    python tools/fetch_megas.py

- Entran todas las formas -mega / -primal de PokeAPI de los Pokémon del juego.
- Si SpriteCollab tiene la forma con Idle, Walk y Attack, se bajan sus hojas
  (normal y shiny) a assets/pokemon/{clave}/, con clave tipo "6-mega-x", y su
  geometría se añade a G.SPRITE_META desde megas.js.
- Si no, la forma usa el sprite del Pokémon normal con un aura de mega (spr: 0).
- Stats del juego con las mismas fórmulas que tools/fetch_pokedex.py.
"""
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor

from fetch_pokedex import API, ROOT, get
from fetch_sprites import BASE, OUT_ASSETS, RAW, REQUIRED, download_set, fetch, parse_animdata

OUT = os.path.join(ROOT, 'js', 'data', 'megas.js')
DEX = os.path.join(ROOT, 'js', 'data', 'pokedex.js')
ABDEX = os.path.join(ROOT, 'js', 'data', 'abilities-dex.js')
# Lo que hay que llevar para cada forma (si no, Megapiedra).
ITEM = {'groudon-primal': 'red-orb', 'kyogre-primal': 'blue-orb', 'rayquaza-mega': 'dragon-ascent'}


def stats_of(p):
    b = {s['stat']['name']: s['base_stat'] for s in p['stats']}
    return {
        'hp': round(70 + b['hp'] * 0.45),
        'spd': round(78 + b['speed'] * 0.42),
        'atk': round(0.70 + b['attack'] / 100 * 0.55, 2),
        'spa': round(0.70 + b['special-attack'] / 100 * 0.55, 2),
        'bst': sum(b.values()),
    }


def form_folder(tracker, dex, slug):
    """Carpeta de SpriteCollab de esa forma (p. ej. '0001'), si está completa."""
    e = tracker.get(f'{dex:04d}', {})
    suffix = slug.split('-mega')[-1] if '-mega' in slug else ''
    want = 'Primal' if slug.endswith('-primal') else 'Mega' + ('_' + suffix.strip('-').upper() if suffix else '')
    for k, sub in (e.get('subgroups') or {}).items():
        if sub.get('name') == want and REQUIRED <= set(sub.get('sprite_files', {})):
            shiny = sub.get('subgroups', {}).get('0001', {})
            return k, {'Idle', 'Walk'} <= set(shiny.get('sprite_files', {}))
    return None, False


def names(base_es, base_en, slug):
    if slug.endswith('-primal'):
        return f'{base_es} Primigenio', f'Primal {base_en}'
    suf = slug.split('-mega')[-1].strip('-').upper()
    suf = ' ' + suf if suf else ''
    return f'Mega-{base_es}{suf}', f'Mega {base_en}{suf}'


def main():
    txt = open(DEX, encoding='utf-8').read()
    dex_names = {int(d): n for d, n in re.findall(r'"dex":(\d+),"name":"([^"]+)"', txt)}
    known_ab = set(re.findall(r'^  "([a-z0-9-]+)": \[', open(ABDEX, encoding='utf-8').read(), re.M))
    tracker = json.loads(fetch(RAW + '/tracker.json').decode('utf-8'))

    with ThreadPoolExecutor(16) as ex:
        species = dict(zip(dex_names, ex.map(lambda d: get(f'{API}/pokemon-species/{d}'), dex_names)))
    forms = []
    for d, s in species.items():
        if not s:
            continue
        en = next((n['name'] for n in s['names'] if n['language']['name'] == 'en'), dex_names[d])
        for v in s['varieties']:
            slug = v['pokemon']['name']
            if re.search(r'-(mega(-[xyz])?|primal)$', slug):
                forms.append((d, slug, dex_names[d], en))
    with ThreadPoolExecutor(16) as ex:
        pdata = list(ex.map(lambda f: get(f'{API}/pokemon/{f[1]}'), forms))

    out, metas, new_ab = {}, {}, {}
    for (d, slug, es, en), p in zip(forms, pdata):
        if not p:
            continue
        key = f'{d}-' + re.sub(r'^.*?-(mega|primal)', r'\1', slug)
        # Variantes de la misma mega (Tatsugiri, Magearna): sólo la primera.
        if any(o['key'] == key for o in out.get(d, [])):
            continue
        name_es, name_en = names(es, en, slug)
        ab = sorted((a for a in p['abilities'] if not a['is_hidden']), key=lambda a: a['slot']) or p['abilities']
        # Algunas megas nuevas aún no tienen habilidad en PokeAPI: la del Pokémon normal.
        ab = ab[0]['ability']['name'] if ab else None
        folder, has_shiny = form_folder(tracker, d, slug)
        spr, src = 0, None
        if folder:
            tag = f'{d:04d}'
            xml = fetch(f'{BASE}/{tag}/{folder}/AnimData.xml')
            if xml:
                anims, shadow = parse_animdata(xml.decode('utf-8', 'replace'))
                normal = download_set(f'{BASE}/{tag}/{folder}', os.path.join(OUT_ASSETS, key), anims)
                if REQUIRED <= set(normal):
                    meta = {'s': shadow, 'a': normal}
                    if has_shiny:
                        sx = fetch(f'{BASE}/{tag}/{folder}/0001/AnimData.xml')
                        sanims = parse_animdata(sx.decode('utf-8', 'replace'))[0] if sx else anims
                        shiny = download_set(f'{BASE}/{tag}/{folder}/0001', os.path.join(OUT_ASSETS, key, 's'), sanims, normal)
                        if 'Idle' in shiny and 'Walk' in shiny:
                            meta['sh'] = 1
                            diff = {k: v for k, v in shiny.items() if normal.get(k) != v}
                            if diff:
                                meta['sa'] = diff
                            miss = [k for k in normal if k not in shiny]
                            if miss:
                                meta['sm'] = miss
                    metas[key] = meta
                    spr, src = 1, f'{tag}/{folder}'
        o = {'key': key, 'name': name_es, 'en': name_en, 'types': [t['type']['name'] for t in p['types']],
             **stats_of(p), 'ab': ab, 'item': ITEM.get(slug, 'stone'), 'spr': spr}
        if src:
            o['src'] = src             # carpeta de SpriteCollab (para CREDITS.md)
        out.setdefault(d, []).append(o)
        if ab and ab not in known_ab:
            a = get(f'{API}/ability/{ab}')
            pick = lambda l: next((n['name'] for n in a['names'] if n['language']['name'] == l), ab) if a else ab
            new_ab[ab] = [pick('es'), pick('en')]
        print(f'  {key:22} {"sprite" if spr else "aura  "} {name_es}')

    lines = [
        '/* ============ megas.js — GENERADO, no editar a mano ============',
        ' * Lo produce tools/fetch_megas.py (PokeAPI + SpriteCollab).',
        ' *   G.MEGA[dex] = [{ key, name, en, types, hp, spd, atk, spa, bst, ab, item, spr }]',
        ' *     key   clave del sprite (assets/pokemon/{key}/) si spr = 1',
        ' *     spr   0 = no hay sprite: se usa el del Pokémon normal con aura de mega',
        ' *     src   carpeta de SpriteCollab del sprite (para los créditos)',
        " *     item  'stone' (Megapiedra), 'red-orb', 'blue-orb' o 'dragon-ascent'",
        ' */',
        'G.MEGA = {',
    ]
    for d in sorted(out):
        lines.append(f'  {d}: {json.dumps(out[d], ensure_ascii=False, separators=(",", ":"))},')
    lines += ['};', '', '// Geometría de los sprites de las formas (como js/data/sprites-meta.js).', 'Object.assign(G.SPRITE_META, {']
    for k in sorted(metas):
        lines.append(f'  {json.dumps(k)}: {json.dumps(metas[k], separators=(",", ":"))},')
    lines += ['});', '', '// Habilidades que sólo tienen las megas.', 'Object.assign(G.ABILITY_NAME, {']
    for k in sorted(new_ab):
        lines.append(f'  {json.dumps(k)}: {json.dumps(new_ab[k], ensure_ascii=False)},')
    lines.append('});')
    open(OUT, 'w', encoding='utf-8', newline='\r\n').write('\n'.join(lines) + '\n')
    n = sum(len(v) for v in out.values())
    print(f'\n{n} formas ({len(metas)} con sprite, {n - len(metas)} con aura) de {len(out)} Pokémon -> {OUT}')


if __name__ == '__main__':
    main()
