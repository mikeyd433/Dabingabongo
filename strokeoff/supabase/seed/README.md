# Course directory seed

The bundled course directory: 120 Massachusetts courses, 25 with a sourced par,
65 documented layouts, and hole-by-hole pars for 2 of them.

| File                       | What it is                                          |
| -------------------------- | --------------------------------------------------- |
| `ma-courses.json`          | The dataset. Source of record — edit this.          |
| `build-seed-migration.mjs` | Generates `../migrations/0022_seed_ma_courses.sql`. |
| `extract-ma-courses.py`    | Rebuilds the JSON from the source spreadsheet.      |

## Changing the data

```sh
# edit ma-courses.json, then
node supabase/seed/build-seed-migration.mjs
```

The generated migration is idempotent: it matches existing rows on
(name, town) and (course, layout name) and leaves them alone, so re-running it
never clobbers a par someone has corrected in the app.

Correcting a course is normally something you do **in the app**, not here — this
path is for re-importing a whole revised roster.

## What the data does and doesn't claim

Par is a property of a **layout**, not a course. Most Massachusetts courses have
never hosted a sanctioned event, so no body has ever assigned them a par: 95 of
the 120 courses import with `total_par` null, deliberately. Filling those in with
3 × holes would be a fiction for any course with a par 4 or 5, so the directory
leaves them blank and the app's editor exists to fill them.

Where a course has several sourced layouts, its headline par comes from the
layout named Default/Standard/Regular/Main, and otherwise from the median — not
the minimum, which would represent a course by its easiest card. The full spread
is kept in `par_low`/`par_high`. The same rule is implemented in
`src/features/courses/parMath.ts` so recalculating in-app agrees with the import.

Layouts whose sources disagree are imported with a `status` flag rather than
dropped, and they're excluded from the derived headline par. Two listings the
source confirmed as duplicates of another course are omitted; unresolved
"likely the same site" pairs are imported with their note attached.
