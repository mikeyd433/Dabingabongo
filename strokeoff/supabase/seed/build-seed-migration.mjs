/**
 * Regenerates supabase/migrations/0006_seed_ma_courses.sql from ma-courses.json.
 *
 *   node supabase/seed/build-seed-migration.mjs
 *
 * The JSON is the source of record (extracted from the compiled MA par
 * reference — see extract-ma-courses.py); the migration is generated so the
 * dataset can be re-derived rather than hand-maintained in SQL.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataPath = join(here, 'ma-courses.json')
const outPath = join(here, '..', 'migrations', '0022_seed_ma_courses.sql')

const data = JSON.parse(readFileSync(dataPath, 'utf8'))

/** Drop null/empty fields so the embedded payload stays readable. */
function compact(value) {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((v) => v !== undefined)
    return items.length ? items : undefined
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const c = compact(v)
      if (c !== undefined) out[k] = c
    }
    return Object.keys(out).length ? out : undefined
  }
  if (value === null || value === '') return undefined
  return value
}

const courses = data.courses.map(compact)
const payload = JSON.stringify({ courses }, null, 1)

if (payload.includes('$seed$')) {
  throw new Error('Payload contains the dollar-quote tag; pick another tag.')
}

const withPar = data.courses.filter((c) => c.total_par != null).length
const layouts = data.courses.reduce((n, c) => n + (c.layouts?.length ?? 0), 0)
const holes = data.courses.reduce(
  (n, c) =>
    n + (c.layouts ?? []).reduce((m, l) => m + (l.holes?.length ?? 0), 0),
  0,
)

const sql = `-- Course directory seed — Massachusetts
--
-- GENERATED FILE. Do not edit by hand: change supabase/seed/ma-courses.json and
-- re-run \`node supabase/seed/build-seed-migration.mjs\`.
--
-- Source: ${data.source}
-- Roster: ${data.roster_source}
-- Par:    ${data.par_sources}
--
-- ${data.courses.length} courses · ${withPar} with a sourced par · ${layouts} layouts · ${holes} hole records.
-- Courses with no sourced par are imported with par left null on purpose — no
-- body assigns par to a disc golf course, and filling blanks with 3 × holes
-- would be a fiction for any course with a par 4 or 5. Those are the rows the
-- in-app editor exists to fill.
${
  data.skipped_duplicates.length
    ? `--\n-- Omitted as confirmed duplicate listings:\n${data.skipped_duplicates
        .map((d) => `--   ${d.name} — ${d.reason}`)
        .join('\n')}\n`
    : ''
}--
-- Idempotent: re-running matches on (name, city) and (course, layout name) and
-- leaves existing rows — including any par a player has since corrected — alone.

do $$
declare
  payload jsonb := $seed$${payload}$seed$;
  c jsonb;
  l jsonb;
  h jsonb;
  cid uuid;
  lid uuid;
begin
  for c in select * from jsonb_array_elements(payload -> 'courses') loop
    select id into cid
      from public.course_directory
      where lower(trim(name)) = lower(trim(c ->> 'name'))
        and lower(coalesce(trim(city), '')) = lower(coalesce(trim(c ->> 'city'), ''));

    if cid is null then
      insert into public.course_directory
        (name, city, state, hole_count, total_par, par_low, par_high, par_source,
         par_confidence, sourced_on, external_url, duplicate_note, notes, is_seed)
      values
        (c ->> 'name',
         c ->> 'city',
         coalesce(c ->> 'state', 'MA'),
         (c ->> 'hole_count')::int,
         (c ->> 'total_par')::int,
         (c ->> 'par_low')::int,
         (c ->> 'par_high')::int,
         c ->> 'par_source',
         coalesce(c ->> 'par_confidence', 'unverified'),
         (c ->> 'sourced_on')::date,
         c ->> 'external_url',
         c ->> 'duplicate_note',
         c ->> 'notes',
         true)
      returning id into cid;
    end if;

    for l in select * from jsonb_array_elements(coalesce(c -> 'layouts', '[]'::jsonb)) loop
      select id into lid
        from public.course_layouts
        where course_id = cid
          and lower(trim(name)) = lower(trim(l ->> 'name'));

      if lid is null then
        insert into public.course_layouts
          (course_id, name, hole_count, total_par, length_ft, source, status, note, is_seed)
        values
          (cid,
           l ->> 'name',
           (l ->> 'hole_count')::int,
           (l ->> 'total_par')::int,
           (l ->> 'length_ft')::int,
           l ->> 'source',
           coalesce(l ->> 'status', 'ok'),
           l ->> 'note',
           true)
        returning id into lid;
      end if;

      -- Hole rows drive the layout total through sync_layout_par().
      for h in select * from jsonb_array_elements(coalesce(l -> 'holes', '[]'::jsonb)) loop
        insert into public.course_holes (layout_id, hole_number, par, distance_ft)
        values (lid,
                (h ->> 'hole_number')::int,
                (h ->> 'par')::int,
                (h ->> 'distance_ft')::int)
        on conflict (layout_id, hole_number) do nothing;
      end loop;
    end loop;
  end loop;
end $$;
`

writeFileSync(outPath, sql)
console.log(
  `wrote ${outPath} — ${data.courses.length} courses, ${withPar} with par, ${layouts} layouts, ${holes} holes`,
)
