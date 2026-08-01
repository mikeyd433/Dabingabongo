-- Course directory seed — Massachusetts
--
-- GENERATED FILE. Do not edit by hand: change supabase/seed/ma-courses.json and
-- re-run `node supabase/seed/build-seed-migration.mjs`.
--
-- Source: Massachusetts Disc Golf Courses - Par Reference (rev 3, compiled 2026-07-31)
-- Roster: Disc Golf Scene, discgolfscene.com/courses/MA
-- Par:    PDGA event/player records; UDisc; Town of Franklin Recreation Dept
--
-- 120 courses · 25 with a sourced par · 65 layouts · 27 hole records.
-- Courses with no sourced par are imported with par left null on purpose — no
-- body assigns par to a disc golf course, and filling blanks with 3 × holes
-- would be a fiction for any course with a par 4 or 5. Those are the rows the
-- in-app editor exists to fill.
--
-- Omitted as confirmed duplicate listings:
--   Amesbury Pines — RESOLVED duplicate - PDGA records one course, 'Amesbury Pines at Town Park'. See Town Park row.
--   Amesbury Pines Disc Golf — RESOLVED duplicate - PDGA records one course, 'Amesbury Pines at Town Park'. See Town Park row.
--
-- Idempotent: re-running matches on (name, city) and (course, layout name) and
-- leaves existing rows — including any par a player has since corrected — alone.

do $$
declare
  payload jsonb := $seed${
 "courses": [
  {
   "name": "501 Disc Golf LLC",
   "city": "Warren",
   "state": "MA",
   "hole_count": 18,
   "total_par": 55,
   "par_low": 55,
   "par_high": 55,
   "par_source": "Green layout — PDGA player 97375 details",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/5875/501-disc-golf-llc",
   "layouts": [
    {
     "name": "Green",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 5324,
     "source": "PDGA player 97375 details",
     "status": "ok",
     "note": "Length cross-confirmed by DGCourseReview (5,324 ft)",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "508 International",
   "city": "Charlton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5956/508-international"
  },
  {
   "name": "Ace Shores at Harbor Point",
   "city": "Boston",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13861/ace-shores-at-harbor-point"
  },
  {
   "name": "Allen Tree Farm DGC",
   "city": "Westfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11152/allen-tree-farm-dgc"
  },
  {
   "name": "Arsenal on the Charles",
   "city": "Watertown",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/4928/arsenal-on-the-charles"
  },
  {
   "name": "Barre Falls",
   "city": "Barre",
   "state": "MA",
   "hole_count": 18,
   "total_par": 58,
   "par_low": 56,
   "par_high": 58,
   "par_source": "Default / Barre Falls Dam layout — PDGA player 203952 details; PDGA players 97375, 47932, 34436, 97252; PDGA players 97375, 9",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/489/barre-falls",
   "layouts": [
    {
     "name": "Default / Barre Falls Dam",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 5361,
     "source": "PDGA players 97375, 47932, 34436, 97252",
     "status": "ok",
     "note": "Highly consistent across 6+ records",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "June 2022 Layout Update",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 5425,
     "source": "PDGA player 203952 details",
     "status": "ok",
     "note": "NEWEST record - course re-cut to par 56. Likely current.",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Regular",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 6392,
     "source": "PDGA players 97375, 91684",
     "status": "conflict",
     "note": "Same par as Default but 1,031 ft longer - unclear if a distinct layout",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Borderland State Park",
   "city": "Easton",
   "state": "MA",
   "hole_count": 18,
   "total_par": 54,
   "par_low": 54,
   "par_high": 56,
   "par_source": "median of 2 sourced layouts — PDGA event 54592; PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/493/borderland-state-park",
   "notes": "HOME COURSE.",
   "layouts": [
    {
     "name": "Blue Tees to White Baskets",
     "hole_count": 19,
     "total_par": 57,
     "length_ft": 6202,
     "source": "PDGA player results detail",
     "status": "ok",
     "note": "19-hole layout",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blue to White",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 6310,
     "source": "PDGA player results detail",
     "status": "conflict",
     "note": "Par agrees across 3 records; length varies 6,000 / 6,310 / 6,500 ft",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "White Tees to Blue Baskets",
     "hole_count": 19,
     "total_par": 59,
     "length_ft": 7082,
     "source": "PDGA player results detail",
     "status": "ok",
     "note": "19-hole layout",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "White to Blue",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 6907,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "White to White",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 5145,
     "source": "PDGA event 54592 (Borderland Fall League)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Bosquet DGC",
   "city": "Pittsfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3811/bosquet-dgc"
  },
  {
   "name": "Boxboro Regency",
   "city": "Boxborough",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11753/boxboro-regency",
   "duplicate_note": "Likely same site as 'Boxborough Regency Temp Course'"
  },
  {
   "name": "Boxborough Regency Temp Course",
   "city": "Boxborough",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12864/boxborough-regency-temp-course",
   "duplicate_note": "Likely same site as 'Boxboro Regency'"
  },
  {
   "name": "Boxford State Forest",
   "city": "Boxford",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11957/boxford-state-forest"
  },
  {
   "name": "Bridge School",
   "city": "Lexington",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13342/bridge-school"
  },
  {
   "name": "Buffumville Lake",
   "city": "Charlton",
   "state": "MA",
   "hole_count": 18,
   "total_par": 58,
   "par_low": 58,
   "par_high": 58,
   "par_source": "median of 2 sourced layouts — PDGA player 203952 details; PDGA players 45097, 91684, 97252; PDGA players 97375, 47932, 1",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/490/buffumville-lake",
   "notes": "PDGA lists two courses here (David Stidham Memorial + Amateur) under one listing",
   "layouts": [
    {
     "name": "David Stidham Memorial - 2019 Ladies Tees",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 5900,
     "source": "PDGA player 203952 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "David Stidham Memorial - Buff Longs",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 6200,
     "source": "PDGA players 97375, 47932, 123253",
     "status": "ok",
     "note": "Par very stable at 58 across many records",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "David Stidham Memorial - Default",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 10041,
     "source": "PDGA players 45097, 91684, 97252",
     "status": "conflict",
     "note": "10,041 ft is implausible - same layout appears at 5,500 / 6,200 / 6,936 ft elsewhere. Treat length as bad data; par 58 is sound.",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Burgess Park",
   "city": "Marstons Mills",
   "state": "MA",
   "hole_count": 18,
   "total_par": 54,
   "par_low": 54,
   "par_high": 54,
   "par_source": "median of 2 sourced layouts — PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/498/burgess-park",
   "layouts": [
    {
     "name": "Blue Layout (A pins)",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 5100,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Gold Layout (B pins)",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 5360,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Buttery Brook Disc Golf",
   "city": "South Hadley",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/14031/buttery-brook-disc-golf"
  },
  {
   "name": "Camp Shepard",
   "city": "Westfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3566/camp-shepard"
  },
  {
   "name": "Cape Cod Community College",
   "city": "West Barnstable",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/504/cape-cod-community-college"
  },
  {
   "name": "Charlton Woods",
   "city": "Charlton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3799/charlton-woods"
  },
  {
   "name": "Clement Farm",
   "city": "Haverhill",
   "state": "MA",
   "hole_count": 18,
   "total_par": 58,
   "par_low": 57,
   "par_high": 59,
   "par_source": "Regular layout — PDGA player 91684 details; PDGA player 97375 details; PDGA players 97375, 47932",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/5415/clement-farm",
   "layouts": [
    {
     "name": "Blue Layout B Pins",
     "hole_count": 18,
     "total_par": 57,
     "length_ft": 5280,
     "source": "PDGA player 97375 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Orange B Pins",
     "hole_count": 18,
     "total_par": 59,
     "length_ft": 6491,
     "source": "PDGA players 97375, 47932",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Regular layout",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 5969,
     "source": "PDGA player 91684 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Coggshall Park",
   "city": "Fitchburg",
   "state": "MA",
   "hole_count": 18,
   "total_par": 56,
   "par_low": 56,
   "par_high": 56,
   "par_source": "Default Layout — PDGA player 91684 details; PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/2762/coggshall-park",
   "layouts": [
    {
     "name": "Default Layout",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 5278,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Standard",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 5216,
     "source": "PDGA player 91684 details",
     "status": "ok",
     "note": "Par stable at 56; length recorded as 5,216 / 5,278 / 5,600 ft",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Cold Spring Disc Golf",
   "city": "Belchertown",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11936/cold-spring-disc-golf"
  },
  {
   "name": "Crane Hill",
   "city": "Wilbraham",
   "state": "MA",
   "hole_count": 18,
   "total_par": 56,
   "par_low": 56,
   "par_high": 58,
   "par_source": "median of 2 sourced layouts — PDGA player 97375 details",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/2633/crane-hill",
   "layouts": [
    {
     "name": "A",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 5364,
     "source": "PDGA player 97375 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "B",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 6661,
     "source": "PDGA player 97375 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Crooked Birch DGC",
   "city": "West Brookfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8592/crooked-birch-dgc"
  },
  {
   "name": "Dacey Fields",
   "city": "Franklin",
   "state": "MA",
   "hole_count": 18,
   "total_par": 62,
   "par_low": 62,
   "par_high": 62,
   "par_source": "median of 3 sourced layouts — PDGA player 72611 details; PDGA player results detail; Town of Franklin Recreation Dept, f",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/4040/dacey-fields",
   "notes": "HOME COURSE.",
   "layouts": [
    {
     "name": "Blue",
     "hole_count": 18,
     "total_par": 62,
     "length_ft": 6185,
     "source": "PDGA player 72611 details",
     "status": "ok",
     "note": "Third independent record agreeing on par 62",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blue (professional) tees",
     "hole_count": 18,
     "total_par": 62,
     "source": "Town of Franklin Recreation Dept, franklinma.gov/354",
     "status": "ok",
     "note": "OPERATOR SOURCE - resolves the PDGA 60-vs-62 conflict in favor of 62",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blues",
     "hole_count": 18,
     "total_par": 62,
     "length_ft": 6298,
     "source": "PDGA player results detail",
     "status": "ok",
     "note": "Agrees with town figure",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blues (older record)",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 5726,
     "source": "PDGA player results detail",
     "status": "superseded",
     "note": "Shorter length and lower par; predates current layout. Do not use.",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Daniels Farm Pop Up Course",
   "city": "Blackstone",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13504/daniels-farm-pop-up-course"
  },
  {
   "name": "Devens DGC",
   "city": "Devens",
   "state": "MA",
   "hole_count": 18,
   "total_par": 56,
   "par_low": 56,
   "par_high": 60,
   "par_source": "The General - General standard layout — PDGA event 37256; PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/492/devens-dgc",
   "notes": "Multi-course site: 'The General' + 'The Hill' are separate courses, both listed",
   "layouts": [
    {
     "name": "The General - Commander",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 8000,
     "source": "PDGA event 37256 (D54 at Devens)",
     "status": "uncertain",
     "note": "A separately-listed 'The Commander' shows par 68 / 9,685 ft. May be a different or rebuilt course.",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "The General - General plus Hill",
     "hole_count": 36,
     "total_par": 110,
     "length_ft": 10000,
     "source": "PDGA event 37256 (D54 at Devens)",
     "status": "ok",
     "note": "36-hole composite; excluded from 18-hole stats",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "The General - General standard",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 5693,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Devens the Hill",
   "city": "Devens",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12901/devens-the-hill",
   "notes": "Multi-course site: separate course at Devens, not a duplicate"
  },
  {
   "name": "Dufresne Park",
   "city": "Granby",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8231/dufresne-park"
  },
  {
   "name": "Endicott Park",
   "city": "Danvers",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/10911/endicott-park"
  },
  {
   "name": "Faxon Park",
   "city": "Quincy",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11480/faxon-park"
  },
  {
   "name": "Flatrock",
   "city": "Athol",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/488/flatrock"
  },
  {
   "name": "Flynt Park",
   "city": "Monson",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6943/flynt-park",
   "duplicate_note": "Likely same site as 'Mountainside DGC at Flynt Park' - par data recorded under that name"
  },
  {
   "name": "Forward Strides Temporary Course",
   "city": "Templeton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6074/forward-strides-temporary-course"
  },
  {
   "name": "Goodnow Park",
   "city": "Princeton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/501/goodnow-park"
  },
  {
   "name": "Gordon College",
   "city": "Hamilton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5311/gordon-college"
  },
  {
   "name": "Green River Disc Golf",
   "city": "Greenfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11583/green-river-disc-golf"
  },
  {
   "name": "Hartsuff Disc Golf Park",
   "city": "Rockland",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5270/hartsuff-disc-golf-park"
  },
  {
   "name": "Hawkins Woods",
   "city": "Plainville",
   "state": "MA",
   "hole_count": 18,
   "total_par": 60,
   "par_low": 60,
   "par_high": 60,
   "par_source": "Default Layout — PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/7708/hawkins-woods",
   "notes": "HOME COURSE.",
   "layouts": [
    {
     "name": "Default Layout",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 6661,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "HCC Disc Golf Course",
   "city": "Holyoke",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/495/hcc-disc-golf-course",
   "duplicate_note": "Likely same site as 'Holyoke Community College'"
  },
  {
   "name": "Hillside Park Disc Golf",
   "city": "Boylston",
   "state": "MA",
   "hole_count": 18,
   "total_par": 61,
   "par_low": 61,
   "par_high": 61,
   "par_source": "Main Layout — PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/11734/hillside-park-disc-golf",
   "layouts": [
    {
     "name": "Main Layout",
     "hole_count": 18,
     "total_par": 61,
     "length_ft": 6428,
     "source": "PDGA player results detail",
     "status": "ok",
     "note": "PDGA name 'Hillside Disc Golf Course'; Boylston location confirmed",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Hodges Village Dam",
   "city": "Oxford",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/2630/hodges-village-dam"
  },
  {
   "name": "Holyoke Community College",
   "city": "Holyoke",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3951/holyoke-community-college",
   "duplicate_note": "Likely same site as 'HCC Disc Golf Course'"
  },
  {
   "name": "Jewelry City Disc Golf at Highland Park",
   "city": "Attleboro",
   "state": "MA",
   "hole_count": 18,
   "total_par": 60,
   "par_low": 60,
   "par_high": 60,
   "par_source": "Sapphire layout — UDisc course page, layout 146034",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/12498/jewelry-city-disc-golf-at-highland-park",
   "notes": "HOME COURSE.",
   "layouts": [
    {
     "name": "Sapphire",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 6597,
     "source": "UDisc course page, layout 146034",
     "status": "ok",
     "note": "Hole-by-hole verified: pars sum to exactly 60, distances to 6,598 vs 6,597 listed",
     "retrieved_on": "2026-07-31",
     "holes": [
      {
       "hole_number": 1,
       "distance_ft": 241,
       "par": 3
      },
      {
       "hole_number": 2,
       "distance_ft": 316,
       "par": 3
      },
      {
       "hole_number": 3,
       "distance_ft": 293,
       "par": 3
      },
      {
       "hole_number": 4,
       "distance_ft": 276,
       "par": 3
      },
      {
       "hole_number": 5,
       "distance_ft": 823,
       "par": 5
      },
      {
       "hole_number": 6,
       "distance_ft": 324,
       "par": 3
      },
      {
       "hole_number": 7,
       "distance_ft": 325,
       "par": 3
      },
      {
       "hole_number": 8,
       "distance_ft": 268,
       "par": 3
      },
      {
       "hole_number": 9,
       "distance_ft": 618,
       "par": 4
      },
      {
       "hole_number": 10,
       "distance_ft": 575,
       "par": 4
      },
      {
       "hole_number": 11,
       "distance_ft": 293,
       "par": 3
      },
      {
       "hole_number": 12,
       "distance_ft": 535,
       "par": 4
      },
      {
       "hole_number": 13,
       "distance_ft": 278,
       "par": 3
      },
      {
       "hole_number": 14,
       "distance_ft": 249,
       "par": 3
      },
      {
       "hole_number": 15,
       "distance_ft": 285,
       "par": 3
      },
      {
       "hole_number": 16,
       "distance_ft": 229,
       "par": 3
      },
      {
       "hole_number": 17,
       "distance_ft": 438,
       "par": 4
      },
      {
       "hole_number": 18,
       "distance_ft": 232,
       "par": 3
      }
     ]
    }
   ]
  },
  {
   "name": "King Philip Middle School",
   "city": "Norfolk",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8447/king-philip-middle-school"
  },
  {
   "name": "Kirvin Park Disc Golf",
   "city": "Pittsfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12715/kirvin-park-disc-golf"
  },
  {
   "name": "Little Harbor Country Club",
   "city": "Wareham",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/10114/little-harbor-country-club"
  },
  {
   "name": "Little River - Private",
   "city": "Oxford",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/9452/little-river-private"
  },
  {
   "name": "Louisa Lake",
   "city": "Milford",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11125/louisa-lake"
  },
  {
   "name": "Luther Hill Park",
   "city": "Spencer",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3172/luther-hill-park"
  },
  {
   "name": "Maple Hill",
   "city": "Leicester",
   "state": "MA",
   "hole_count": 18,
   "total_par": 56,
   "par_low": 55,
   "par_high": 60,
   "par_source": "median of 7 sourced layouts — PDGA event 89372; PDGA event 97106; PDGA player 123253 details; PDGA player 97375 details;",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/496/maple-hill",
   "notes": "One course, 5-6 named configurations",
   "layouts": [
    {
     "name": "Blues",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 6775,
     "source": "PDGA event 89372 (Maple Hill Open)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Checkered Flag (Mass Grand Prix)",
     "hole_count": 18,
     "total_par": 57,
     "length_ft": 6081,
     "source": "PDGA event 97106 (Mass Grand Prix)",
     "status": "conflict",
     "note": "Same layout name also recorded as par 55 / 6,206 ft - layout re-cut between years",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Checkered Flag (alt. record)",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 6206,
     "source": "PDGA player results detail",
     "status": "conflict",
     "note": "Conflicts with par 57 / 6,081 ft above",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Diamonds (A Pins)",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 7125,
     "source": "PDGA event 89372 (Maple Hill Open)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Golds (MVP Hole 10/17)",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 8898,
     "source": "PDGA event 97106 (Mass Grand Prix)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Old Glory Layout",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 5720,
     "source": "PDGA player 97375 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Reds",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 4173,
     "source": "PDGA event 89372 (Maple Hill Open)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "White Layout 2021",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 5795,
     "source": "PDGA player 123253 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Whites",
     "hole_count": 18,
     "total_par": 56,
     "length_ft": 5332,
     "source": "PDGA event 89372 (Maple Hill Open)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Meadowbrook Orchards",
   "city": "Sterling",
   "state": "MA",
   "hole_count": 18,
   "total_par": 61,
   "par_low": 60,
   "par_high": 61,
   "par_source": "median of 2 sourced layouts — PDGA player 203952 details; PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/8963/meadowbrook-orchards",
   "layouts": [
    {
     "name": "Blue Layout",
     "hole_count": 18,
     "total_par": 61,
     "length_ft": 7341,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blue Layout (alt. record)",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 7068,
     "source": "PDGA player 203952 details",
     "status": "conflict",
     "note": "Conflicts with par 61 / 7,341 ft - layout likely re-cut between seasons",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blue Layout with long 1",
     "hole_count": 18,
     "total_par": 61,
     "length_ft": 7363,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Meat Bone DGC",
   "city": "Haverhill",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8482/meat-bone-dgc"
  },
  {
   "name": "Middlesex Green",
   "city": "Concord",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5249/middlesex-green"
  },
  {
   "name": "Mile Marker 63 Disc Golf",
   "city": "East Brookfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12632/mile-marker-63-disc-golf"
  },
  {
   "name": "Mitteneague Park",
   "city": "West Springfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8110/mitteneague-park"
  },
  {
   "name": "Mountainside DGC at Flynt Park",
   "city": "Monson",
   "state": "MA",
   "hole_count": 18,
   "total_par": 63,
   "par_low": 58,
   "par_high": 63,
   "par_source": "median of 3 sourced layouts — PDGA player 47932 details; PDGA players 97375, 47932",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/8710/mountainside-dgc-at-flynt-park",
   "duplicate_note": "Likely same site as 'Flynt Park'",
   "layouts": [
    {
     "name": "Coral",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 5423,
     "source": "PDGA players 97375, 47932",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Gold",
     "hole_count": 18,
     "total_par": 63,
     "length_ft": 6656,
     "source": "PDGA player 47932 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Golds, Alt 1/5/9/11",
     "hole_count": 18,
     "total_par": 63,
     "length_ft": 7051,
     "source": "PDGA player 47932 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "MVPL Temp",
   "city": "Lowell",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12127/mvpl-temp"
  },
  {
   "name": "Nantucket DGC",
   "city": "Nantucket Island",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/4436/nantucket-dgc"
  },
  {
   "name": "New England Disc Golf Center",
   "city": "Southwick",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6709/new-england-disc-golf-center"
  },
  {
   "name": "Newton Hill",
   "city": "Worcester",
   "state": "MA",
   "hole_count": 18,
   "total_par": 58,
   "par_low": 58,
   "par_high": 59,
   "par_source": "median of 2 sourced layouts — PDGA events 33177, 41113; PDGA events 59582, 72360; PDGA events 62968, 72360",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/2838/newton-hill",
   "layouts": [
    {
     "name": "Default Layout",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 5361,
     "source": "PDGA events 33177, 41113",
     "status": "conflict",
     "note": "Identical par AND length to Barre Falls Default (58 / 5,361 ft). Possible PDGA data contamination - verify on site.",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Reds",
     "hole_count": 18,
     "total_par": 59,
     "length_ft": 5530,
     "source": "PDGA events 62968, 72360",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Silvers",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 5115,
     "source": "PDGA events 59582, 72360",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "NGE Sports Performance",
   "city": "Fitchburg",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11793/nge-sports-performance"
  },
  {
   "name": "Normandy Farms Campground",
   "city": "Foxboro",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/494/normandy-farms-campground"
  },
  {
   "name": "Northampton State Hospital",
   "city": "Northampton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/499/northampton-state-hospital"
  },
  {
   "name": "Novak Estates Country Club",
   "city": "Framingham",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/10113/novak-estates-country-club"
  },
  {
   "name": "Oak Grove (Temporary)",
   "city": "Millis",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/9794/oak-grove-temporary"
  },
  {
   "name": "Oak Middle School",
   "city": "Shrewsbury",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/4992/oak-middle-school"
  },
  {
   "name": "Oak Ridge",
   "city": "Gill",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8302/oak-ridge"
  },
  {
   "name": "Oakcrest Cove",
   "city": "Sandwich",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/9270/oakcrest-cove",
   "duplicate_note": "Likely same site as 'Oakcrest Cove DGC'"
  },
  {
   "name": "Oakcrest Cove DGC",
   "city": "Sandwich",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8903/oakcrest-cove-dgc",
   "duplicate_note": "Likely same site as 'Oakcrest Cove'"
  },
  {
   "name": "Oakholm Disc Golf",
   "city": "Brookfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/10180/oakholm-disc-golf"
  },
  {
   "name": "Olin College DGC",
   "city": "Needham",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3629/olin-college-dgc"
  },
  {
   "name": "Orchard Hill",
   "city": "Amherst",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6255/orchard-hill"
  },
  {
   "name": "Parker Middle School DGC",
   "city": "Chelmsford",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/10589/parker-middle-school-dgc"
  },
  {
   "name": "Petersham Country Club",
   "city": "Petersham",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3695/petersham-country-club"
  },
  {
   "name": "Polar Park",
   "city": "Worcester",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13343/polar-park"
  },
  {
   "name": "Prescott Woods",
   "city": "Sharon",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/14000/prescott-woods"
  },
  {
   "name": "Pro Chemical & Dye",
   "city": "Fall River",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12619/pro-chemical-and-dye"
  },
  {
   "name": "Pye Brook",
   "city": "Topsfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6568/pye-brook",
   "duplicate_note": "Likely same site as 'Pye Brook Park'"
  },
  {
   "name": "Pye Brook Park",
   "city": "Topsfield",
   "state": "MA",
   "hole_count": 20,
   "total_par": 61,
   "par_low": 61,
   "par_high": 61,
   "par_source": "Default Layout — PDGA player 72611 details",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/503/pye-brook-park",
   "duplicate_note": "Likely same site as 'Pye Brook'",
   "layouts": [
    {
     "name": "Default Layout",
     "hole_count": 20,
     "total_par": 61,
     "length_ft": 6429,
     "source": "PDGA player 72611 details",
     "status": "ok",
     "note": "20-hole course. Excluded from 18-hole stats but the par is sound.",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Pyramids",
   "city": "Leicester",
   "state": "MA",
   "hole_count": 18,
   "total_par": 56,
   "par_low": 55,
   "par_high": 64,
   "par_source": "median of 4 sourced layouts — PDGA event 15351; PDGA event 58528; PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/497/pyramids",
   "layouts": [
    {
     "name": "Bigger Longer Harder",
     "hole_count": 18,
     "total_par": 60,
     "length_ft": 5918,
     "source": "PDGA event 58528",
     "status": "ok",
     "note": "Same figures also appear as 'Added OB Tournament Layout'",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blues",
     "hole_count": 18,
     "total_par": 64,
     "length_ft": 6366,
     "source": "PDGA player results detail",
     "status": "conflict",
     "note": "Also recorded at 6,692 ft, same par",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Golds",
     "hole_count": 18,
     "total_par": 64,
     "source": "PDGA event 15351 (Pyramids Invasion)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Silvers",
     "hole_count": 18,
     "total_par": 56,
     "source": "PDGA event 15351 (Pyramids Invasion)",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Whites",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 5059,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Red Apple Disc Golf",
   "city": "Phillipston",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/14019/red-apple-disc-golf"
  },
  {
   "name": "Reds Farm",
   "city": "Upton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12593/reds-farm"
  },
  {
   "name": "Riverhead Field",
   "city": "Oak Bluffs",
   "state": "MA",
   "hole_count": 18,
   "total_par": 54,
   "par_low": 54,
   "par_high": 58,
   "par_source": "median of 2 sourced layouts — PDGA player 34436 details; PDGA player 47932 details",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/500/riverhead-field",
   "layouts": [
    {
     "name": "Blue",
     "hole_count": 18,
     "total_par": 58,
     "length_ft": 6151,
     "source": "PDGA player 47932 details",
     "status": "conflict",
     "note": "Same layout, same length recorded elsewhere at par 55",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Blue (alt. record)",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 6151,
     "source": "PDGA player 34436 details",
     "status": "conflict",
     "note": "Conflicts with par 58 above",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Red",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 4981,
     "source": "PDGA player 34436 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Red (4green)",
     "hole_count": 18,
     "total_par": 57,
     "length_ft": 5178,
     "source": "PDGA player 47932 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Roc Run",
   "city": "Ashland",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/9578/roc-run"
  },
  {
   "name": "Rockland Golf Course",
   "city": "Rockland",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5710/rockland-golf-course"
  },
  {
   "name": "Royal Plaza Trade Center",
   "city": "Marlborough",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13688/royal-plaza-trade-center"
  },
  {
   "name": "Royalston Fish and Game",
   "city": "Phillipston",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/7676/royalston-fish-and-game"
  },
  {
   "name": "Ruel Field Disc Golf Course",
   "city": "Oxford",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13348/ruel-field-disc-golf-course"
  },
  {
   "name": "Ryder Ridge",
   "city": "Shirley",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8547/ryder-ridge"
  },
  {
   "name": "School Street Park DGC",
   "city": "Agawam",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/7975/school-street-park-dgc"
  },
  {
   "name": "Scouting Woods",
   "city": "Peabody",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/4543/scouting-woods"
  },
  {
   "name": "Sheffield Town Park",
   "city": "Sheffield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/12317/sheffield-town-park"
  },
  {
   "name": "Silver Hill National",
   "city": "Concord",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5296/silver-hill-national"
  },
  {
   "name": "Simonds Park",
   "city": "Burlington",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/2696/simonds-park"
  },
  {
   "name": "Sky Pines at Innovation Academy Charter School",
   "city": "Tyngsborough",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/9077/sky-pines-at-innovation-academy-charter-school"
  },
  {
   "name": "SSDG - East Bridgewater",
   "city": "East Bridgewater",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8160/ssdg-east-bridgwater"
  },
  {
   "name": "SSDG - Veterans Memorial Disc Golf Course",
   "city": "Rockland",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6612/ssdg-veterans-memorial-disc-golf-course"
  },
  {
   "name": "Sunnymede DGC",
   "city": "Middleboro",
   "state": "MA",
   "hole_count": 18,
   "total_par": 55,
   "par_low": 55,
   "par_high": 55,
   "par_source": "Blue - Green layout — PDGA player results detail",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/5931/sunnymede-dgc",
   "layouts": [
    {
     "name": "Blue - Green",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 6048,
     "source": "PDGA player results detail",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Teamworks (Acton)",
   "city": "Acton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11578/teamworks"
  },
  {
   "name": "Teamworks (Seekonk)",
   "city": "Seekonk",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11741/teamworks"
  },
  {
   "name": "The Boneyard",
   "city": "Hubbardston",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/3624/the-boneyard"
  },
  {
   "name": "The Expo Disc Golf Course",
   "city": "Boxboro",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/11827/the-expo-disc-golf-course"
  },
  {
   "name": "The Highlands of Conway",
   "city": "Conway",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/491/the-highlands-of-conway"
  },
  {
   "name": "The Hunt Club",
   "city": "Medfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/2714/the-hunt-club"
  },
  {
   "name": "The International Golf Club",
   "city": "Bolton",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6772/the-international-golf-club"
  },
  {
   "name": "The School Yahd",
   "city": "West Boylston",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/13679/the-school-yahd"
  },
  {
   "name": "Town Park (Amesbury Pines)",
   "city": "Amesbury",
   "state": "MA",
   "hole_count": 18,
   "total_par": 54,
   "par_low": 54,
   "par_high": 54,
   "par_source": "Amesbury Pines at Town Park - Default layout — PDGA players 97375, 34436, 72611",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/487/town-park-amesbury-pines",
   "duplicate_note": "CANONICAL of the 3 Amesbury listings - PDGA name 'Amesbury Pines at Town Park'",
   "layouts": [
    {
     "name": "Amesbury Pines at Town Park - Alternate",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 5200,
     "source": "PDGA players 97375, 34436, 72611",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    },
    {
     "name": "Amesbury Pines at Town Park - Default",
     "hole_count": 18,
     "total_par": 54,
     "length_ft": 5233,
     "source": "PDGA players 97375, 34436, 72611",
     "status": "ok",
     "note": "PDGA treats the Amesbury listings as ONE course - resolves the 3-listing cluster",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Tully Lake",
   "city": "Royalston",
   "state": "MA",
   "hole_count": 18,
   "total_par": 57,
   "par_low": 57,
   "par_high": 57,
   "par_source": "Default Layout — PDGA players 97375, 47932, 34436, 97252",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/502/tully-lake",
   "layouts": [
    {
     "name": "Default Layout",
     "hole_count": 18,
     "total_par": 57,
     "length_ft": 5943,
     "source": "PDGA players 97375, 47932, 34436, 97252",
     "status": "ok",
     "note": "Most consistently recorded course in the set - 8+ matching records",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "UMass Dartmouth DGC",
   "city": "Dartmouth",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/7065/umass-dartmouth-dgc"
  },
  {
   "name": "University of Massachusetts - Amherst",
   "city": "Amherst",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/4174/university-of-massachusetts-amherst"
  },
  {
   "name": "US Bunting Club",
   "city": "Lowell",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/10453/us-bunting-club"
  },
  {
   "name": "Vietnam Veterans Park",
   "city": "Billerica",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8486/vietnam-veterans-park"
  },
  {
   "name": "Webster Fish and Game Club",
   "city": "Webster",
   "state": "MA",
   "hole_count": 18,
   "total_par": 55,
   "par_low": 55,
   "par_high": 55,
   "par_source": "Default Layout — PDGA player 123253 details",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/3755/webster-fish-and-game-club",
   "layouts": [
    {
     "name": "Default Layout",
     "hole_count": 18,
     "total_par": 55,
     "length_ft": 5000,
     "source": "PDGA player 123253 details",
     "status": "ok",
     "retrieved_on": "2026-07-31"
    }
   ]
  },
  {
   "name": "Westy Acres",
   "city": "Greenfield",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8143/westy-acres"
  },
  {
   "name": "Wilbraham and Monson Academy",
   "city": "Wilbraham",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/5062/wilbraham-and-monson-academy"
  },
  {
   "name": "Wildcat Woods (Private course)",
   "city": "Weston",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/9938/wildcat-woods-private-course"
  },
  {
   "name": "Windsor Lake DGC",
   "city": "North Adams",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6293/windsor-lake-dgc"
  },
  {
   "name": "Winnekenni Castle",
   "city": "Haverhill",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/6913/winnekenni-castle"
  },
  {
   "name": "Woods of Westminster",
   "city": "Westminster",
   "state": "MA",
   "par_confidence": "unverified",
   "external_url": "https://www.discgolfscene.com/course/8084/woods-of-westminster"
  },
  {
   "name": "World War 1 Memorial Park",
   "city": "North Attleboro",
   "state": "MA",
   "hole_count": 9,
   "total_par": 27,
   "par_low": 27,
   "par_high": 27,
   "par_source": "White 9 layout — UDisc course page, layout 18717",
   "par_confidence": "verified",
   "sourced_on": "2026-07-31",
   "external_url": "https://www.discgolfscene.com/course/4477/world-war-1-memorial-park",
   "notes": "HOME COURSE.",
   "layouts": [
    {
     "name": "White 9",
     "hole_count": 9,
     "total_par": 27,
     "length_ft": 2218,
     "source": "UDisc course page, layout 18717",
     "status": "ok",
     "note": "Hole-by-hole verified: nine par 3s = 27; distances sum to 2,217 vs 2,218 listed",
     "retrieved_on": "2026-07-31",
     "holes": [
      {
       "hole_number": 1,
       "distance_ft": 270,
       "par": 3
      },
      {
       "hole_number": 2,
       "distance_ft": 314,
       "par": 3
      },
      {
       "hole_number": 3,
       "distance_ft": 259,
       "par": 3
      },
      {
       "hole_number": 4,
       "distance_ft": 263,
       "par": 3
      },
      {
       "hole_number": 5,
       "distance_ft": 157,
       "par": 3
      },
      {
       "hole_number": 6,
       "distance_ft": 268,
       "par": 3
      },
      {
       "hole_number": 7,
       "distance_ft": 192,
       "par": 3
      },
      {
       "hole_number": 8,
       "distance_ft": 215,
       "par": 3
      },
      {
       "hole_number": 9,
       "distance_ft": 279,
       "par": 3
      }
     ]
    }
   ]
  }
 ]
}$seed$;
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
