"""Extraction: MA_Disc_Golf_Courses1.xlsx -> ma-courses.json.

Kept for provenance and for re-running against a newer revision of the source
workbook. Point SRC at the spreadsheet, run it, then regenerate the migration:

    python3 supabase/seed/extract-ma-courses.py
    node supabase/seed/build-seed-migration.mjs

Requires pandas + openpyxl; neither is a project dependency, since the committed
JSON is what the app build actually needs.
"""
import json
import math
import re
from collections import Counter

import pandas as pd

SRC = 'MA_Disc_Golf_Courses1.xlsx'
OUT = 'supabase/seed/ma-courses.json'

DEFAULT_NAME_RE = re.compile(r'\b(default|standard|regular|main)\b', re.I)

# Hole-by-hole data lives on the "Home Courses" sheet, keyed by course + layout.
HOLE_BLOCKS = [
    ('Jewelry City Disc Golf at Highland Park', 'Sapphire'),
    ('World War 1 Memorial Park', 'White 9'),
]


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def as_int(v):
    v = clean(v)
    return None if v is None else int(v)


def parse_holes(xl):
    """Pull the two hole-by-hole blocks off the Home Courses sheet."""
    df = xl.parse('Home Courses', header=None)
    rows = [[clean(c) for c in r] for _, r in df.iterrows()]
    blocks = {}
    for i, row in enumerate(rows):
        head = row[0]
        if not isinstance(head, str) or not head.startswith('HOLE-BY-HOLE'):
            continue
        holes = []
        for r in rows[i + 2:]:
            if r[0] is None or (isinstance(r[0], str) and r[0].upper() == 'TOTAL'):
                break
            holes.append({
                'hole_number': int(r[0]),
                'distance_ft': as_int(r[1]),
                'par': int(r[2]),
            })
        blocks[len(blocks)] = holes
    return {HOLE_BLOCKS[i]: h for i, h in blocks.items()}


def derive_par(course_holes, layouts, par_low):
    """Course headline par.

    A layout explicitly named Default/Standard/Regular/Main wins; otherwise the
    median of usable layouts at the course's hole count (lower median on ties);
    otherwise the sheet's Par Low. Never invented — null when nothing is sourced.
    """
    usable = [
        lay for lay in layouts
        if lay['status'] == 'ok'
        and lay['total_par'] is not None
        and (course_holes is None or lay['hole_count'] == course_holes)
    ]
    if not usable:
        return (par_low, 'Course roster (Par Low)') if par_low is not None else (None, None)

    def label_for(lay):
        name = lay['name']
        return name if name.lower().endswith('layout') else f'{name} layout'

    named = [lay for lay in usable if DEFAULT_NAME_RE.search(lay['name'])]
    if named:
        pick = min(named, key=lambda lay: lay['total_par'])
        return pick['total_par'], label_for(pick)
    if len(usable) == 1:
        return usable[0]['total_par'], label_for(usable[0])

    pars = sorted(lay['total_par'] for lay in usable)
    median = pars[(len(pars) - 1) // 2]
    return median, 'median of %d sourced layouts' % len(pars)


def main():
    xl = pd.ExcelFile(SRC)
    holes_by_key = parse_holes(xl)

    lay_df = xl.parse('Layouts')
    layouts_by_course = {}
    for _, r in lay_df.iterrows():
        course = clean(r['Course'])
        if course is None:
            continue
        status = (clean(r['Status']) or 'OK').lower()
        name = clean(r['Layout'])
        layouts_by_course.setdefault(course, []).append({
            'name': name,
            'hole_count': as_int(r['Holes']),
            'total_par': as_int(r['Total Par']),
            'length_ft': as_int(r['Length (ft)']),
            'source': clean(r['Source']),
            'status': status,
            'note': clean(r['Note']),
            'retrieved_on': str(clean(r['Retrieved']))[:10] if clean(r['Retrieved']) else None,
            'holes': holes_by_key.get((course, name), []),
        })

    course_df = xl.parse('Courses')
    courses = []
    skipped = []
    for _, r in course_df.iterrows():
        num = clean(r['#'])
        name = clean(r['Course'])
        if num is None or name is None:
            continue
        dup = clean(r['Duplicate / Multi-course'])
        if dup and dup.startswith('RESOLVED duplicate'):
            skipped.append({'name': name, 'reason': dup})
            continue

        holes = as_int(r['Holes'])
        par_low = as_int(r['Par Low'])
        par_high = as_int(r['Par High'])
        layouts = layouts_by_course.get(name, [])
        total_par, par_basis = derive_par(holes, layouts, par_low)
        sheet_source = clean(r['Par Source'])
        par_source = None
        if total_par is not None:
            par_source = f'{par_basis} — {sheet_source}' if sheet_source else par_basis

        courses.append({
            'name': name,
            'city': clean(r['City']),
            'state': 'MA',
            'hole_count': holes,
            'total_par': total_par,
            'par_low': par_low,
            'par_high': par_high,
            'par_source': par_source,
            'par_confidence': (clean(r['Confidence']) or 'unverified').lower(),
            'sourced_on': str(clean(r['Source Date']))[:10] if clean(r['Source Date']) else None,
            'external_url': clean(r['Course URL']),
            'duplicate_note': dup,
            'notes': clean(r['Notes']),
            'layouts': layouts,
        })

    payload = {
        'source': 'Massachusetts Disc Golf Courses - Par Reference (rev 3, compiled 2026-07-31)',
        'roster_source': 'Disc Golf Scene, discgolfscene.com/courses/MA',
        'par_sources': 'PDGA event/player records; UDisc; Town of Franklin Recreation Dept',
        'region': 'MA',
        'courses': courses,
        'skipped_duplicates': skipped,
    }
    with open(OUT, 'w') as f:
        json.dump(payload, f, indent=2)
        f.write('\n')

    with_par = [c for c in courses if c['total_par'] is not None]
    print('courses:', len(courses), '| skipped:', len(skipped))
    print('with par:', len(with_par))
    print('layouts:', sum(len(c['layouts']) for c in courses))
    print('hole rows:', sum(len(l['holes']) for c in courses for l in c['layouts']))
    print('confidence:', Counter(c['par_confidence'] for c in courses))
    for c in with_par:
        print('  %-42s %-16s holes=%-4s par=%-4s range=%s-%s  <- %s' % (
            c['name'], c['city'], c['hole_count'], c['total_par'],
            c['par_low'], c['par_high'], c['par_source'][:60]))


main()
