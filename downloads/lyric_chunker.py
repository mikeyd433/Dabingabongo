# --------------------------------------------------------------------------
# GENERATED FILE — do not edit. Built from the lyric_chunker/ package by
# scripts/build_single_file.py. Edit the package modules instead.
# --------------------------------------------------------------------------
bl_info = {
    "name": "Lyric Chunker",
    "author": "Mikey D",
    "version": (2, 3, 0),
    "blender": (4, 2, 0),
    "location": "3D Viewport > Sidebar (N) > Lyric Chunker",
    "description": "Delimited lyrics to per-syllable stills with a timing manifest",
    "category": "Object",
}


# ===== splitting.py ===============================================

"""Lyric line splitting (spec addendum §9).

Pure logic, no bpy — unit-testable outside Blender.

Rules:
  1. Split the line on whitespace into words.
  2. Split each word on the delimiter into chunks.
  3. Whitespace is always a chunk boundary; the delimiter creates
     sub-word splits.
  4. Discard zero-length chunks; warn if any were produced (usually a
     doubled delimiter typo).

The delimiter is configurable, default ``|``. Hyphens are literal
characters — they no longer split (and the old ``\\-`` escape is gone).
"""

DEFAULT_DELIMITER = "|"


def split_line(raw, delimiter=DEFAULT_DELIMITER):
    """Split one delimited lyric line.

    Returns ``(words, warnings)`` where ``words`` is a list of words,
    each word a list of chunk strings, and ``warnings`` is a list of
    human-readable strings for anything discarded.
    """
    words = []
    warnings = []
    for word in raw.split():
        parts = word.split(delimiter) if delimiter else [word]
        chunks = [p for p in parts if p]
        if len(chunks) != len(parts):
            warnings.append(
                f"'{word}' produced a zero-length chunk (doubled or stray "
                f"'{delimiter}'?) — discarded"
            )
        if chunks:
            words.append(chunks)
    return words, warnings


def flat_chunks(words):
    """Flatten the word/chunk structure into the left-to-right chunk list."""
    return [chunk for word in words for chunk in word]


def full_text(words):
    """The line as it should render, delimiters stripped, single-spaced."""
    return " ".join("".join(word) for word in words)


def prefix_text(words, chunk_index):
    """Text of everything before flat chunk ``chunk_index`` (0-based),
    including the space separating a preceding word — i.e. the exact
    string the chunk's glyphs follow in the full line."""
    out = []
    seen = 0
    for w, word in enumerate(words):
        for chunk in word:
            if seen == chunk_index:
                return "".join(out)
            out.append(chunk)
            seen += 1
        out.append(" ")
    return "".join(out)


def parse_block(text, delimiter=DEFAULT_DELIMITER, start_index=1):
    """Parse a multi-line lyrics block (§5.3).

    One lyric line per row; blank rows are skipped and do not consume a
    line number. Returns ``(lines, warnings)`` where ``lines`` is a list
    of ``(line_number, raw_text, words)`` tuples numbered from
    ``start_index``.
    """
    lines = []
    warnings = []
    number = start_index
    for row, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip():
            continue
        words, w = split_line(raw, delimiter)
        warnings.extend(f"row {row}: {msg}" for msg in w)
        if not words:
            warnings.append(f"row {row}: no chunks after splitting — skipped")
            continue
        lines.append((number, raw.strip(), words))
        number += 1
    return lines, warnings


# ===== manifest.py ================================================

"""JSON manifest read/write and output naming (spec addendum §1).

Pure logic, no bpy — unit-testable outside Blender.

One manifest per line, written into that line's output folder as
``Line<N>.json`` next to the chunk PNGs. ``manifest_version`` increments
on breaking schema change; never reuse a version number for a changed
shape. ``song.json`` at the output root is reserved for the v1.5
cross-line index — do not use that filename for anything else.
"""

import json

MANIFEST_VERSION = 1

# Single source of truth for the add-on version; blender_manifest.toml
# must match (the single-file build script asserts it).
ADDON_ID = "lyric_chunker"
ADDON_VERSION = "2.3.0"

RESERVED_FILENAMES = {"song.json"}


def fmt_num(n, pad):
    return f"{n:02d}" if pad else str(n)


def line_dirname(line_no, pad=False):
    return f"Line{fmt_num(line_no, pad)}"


def chunk_name(line_no, chunk_no, pad=False):
    return f"Line{fmt_num(line_no, pad)}_Chunk{fmt_num(chunk_no, pad)}"


def chunk_filename(line_no, chunk_no, pad=False):
    return chunk_name(line_no, chunk_no, pad) + ".png"


def manifest_filename(line_no, pad=False):
    return line_dirname(line_no, pad) + ".json"


def build_chunk_entry(
    index,
    name,
    text,
    filename,
    world_position,
    screen_position,
    bbox_px,
    offset_x,
    manual_offset_x=0.0,
    start_seconds=None,
    start_frame=None,
    timing_source="none",
):
    """One entry for the ``chunks`` array.

    ``start_seconds`` is the canonical timing value (survives fps
    changes); ``start_frame`` is derived convenience only. No end times —
    chunk visibility duration is a comp-side decision (§4.5).
    ``bbox_px`` is [x_min, y_min, x_max, y_max] with origin at
    bottom-left, matching Blender's camera view and Fusion.
    """
    return {
        "index": index,
        "name": name,
        "text": text,
        "filename": filename,
        "world_position": [round(v, 6) for v in world_position],
        "screen_position": [round(v, 6) for v in screen_position],
        "bbox_px": list(bbox_px),
        "offset_x": round(offset_x, 6),
        "manual_offset_x": round(manual_offset_x, 6),
        "start_seconds": None if start_seconds is None else round(start_seconds, 4),
        "start_frame": start_frame,
        "timing_source": timing_source,
    }


def build_manifest(
    generator,
    project,
    render,
    line,
    chunks,
    verification=None,
    rendered_at=None,
):
    return {
        "manifest_version": MANIFEST_VERSION,
        "generator": generator,
        "project": project,
        "render": render,
        "line": line,
        "chunks": chunks,
        "verification": verification or {"run": False},
        "rendered_at": rendered_at,
    }


def write_manifest(path, manifest):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def read_manifest(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    version = data.get("manifest_version")
    if version != MANIFEST_VERSION:
        raise ValueError(
            f"manifest_version {version!r} in {path} — this add-on reads "
            f"version {MANIFEST_VERSION}"
        )
    return data


def seconds_to_frame(seconds, fps, fps_base=1.0):
    """Derived start_frame; start_seconds stays the source of truth."""
    if seconds is None:
        return None
    return round(seconds * (fps / fps_base))


# ===== timing_srt.py ==============================================

"""SRT parsing and weighted chunk distribution (spec addendum §4.2, §4.4).

Pure logic, no bpy — unit-testable outside Blender.

SRT is the primary import target: it carries start *and* end times, so
the line span is known rather than guessed. Subtitle entries map to
lines **in order** — the entry at file position N supplies line N's
span (with the §5.3 start-index offset, lines 12–20 map to entries
12–20). SRT text is NOT used as lyric content; the delimited text block
stays the source of truth.

Import produces a scaffold, not final timing (§4.1) — the user
fine-tunes in Fusion.
"""

import re

# Weight floor for distribution: without it, chunks like "a" or "ed"
# collapse to near-zero duration and land on top of their neighbour.
MIN_WEIGHT = 2

_TIMESTAMP_RE = re.compile(
    r"(\d+):([0-5]?\d):([0-5]?\d)[,.](\d{1,3})"
)
_TIMING_LINE_RE = re.compile(
    r"^\s*(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)"
)


class SrtParseError(ValueError):
    pass


def timestamp_to_seconds(stamp):
    m = _TIMESTAMP_RE.fullmatch(stamp.strip())
    if not m:
        raise SrtParseError(f"bad SRT timestamp: {stamp!r}")
    h, mi, s, ms = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(s) + int(ms.ljust(3, "0")) / 1000.0


def parse_srt(text):
    """Parse SRT text into ``[{"start": s, "end": s, "text": str}, ...]``
    in file order. Tolerates missing index lines, ``.`` millisecond
    separators, and BOM. Raises SrtParseError on a malformed timing line.
    """
    entries = []
    block = []
    for raw in text.lstrip("﻿").splitlines() + [""]:
        if raw.strip():
            block.append(raw)
            continue
        if not block:
            continue
        entries.append(_parse_block(block, position=len(entries) + 1))
        block = []
    return entries


def _parse_block(block, position):
    idx = 0
    # Optional numeric index line.
    if idx < len(block) and block[idx].strip().isdigit():
        idx += 1
    if idx >= len(block):
        raise SrtParseError(f"SRT entry {position}: no timing line")
    m = _TIMING_LINE_RE.match(block[idx])
    if not m:
        raise SrtParseError(
            f"SRT entry {position}: expected 'start --> end', got "
            f"{block[idx].strip()!r}"
        )
    start = timestamp_to_seconds(m.group(1))
    end = timestamp_to_seconds(m.group(2))
    if end < start:
        raise SrtParseError(f"SRT entry {position}: end before start")
    return {
        "start": start,
        "end": end,
        "text": "\n".join(line.strip() for line in block[idx + 1:]),
    }


def entry_for_line(entries, line_no):
    """Entry supplying line ``line_no`` (1-based, in file order), or None."""
    if 1 <= line_no <= len(entries):
        return entries[line_no - 1]
    return None


def distribute(start_seconds, end_seconds, chunk_texts, min_weight=MIN_WEIGHT):
    """Distribute chunk start times across a line span, weighted by chunk
    character length (§4.4). Returns one start time per chunk; the first
    chunk starts at ``start_seconds``. Character count is a proxy for
    sung duration, not a measure of it — the result is a scaffold.
    """
    weights = [max(len(text), min_weight) for text in chunk_texts]
    total = sum(weights)
    span = end_seconds - start_seconds
    cursor = start_seconds
    starts = []
    for w in weights:
        starts.append(cursor)
        cursor += span * (w / total)
    return starts


# ===== timing_markers.py ==========================================

"""Timeline-marker timing and source precedence (spec addendum §4.3, §4.4).

Pure logic, no bpy — markers arrive as plain ``(name, frame)`` tuples so
this module is unit-testable outside Blender.

Markers are the only route to genuine chunk-level timing: the user
scrubs the song in the VSE and taps ``M`` along to the vocal. Matching
rules, in priority order:

  1. Named markers — a marker named ``Line1_Chunk1`` binds to that chunk
     directly (zero-padding in the marker name is tolerated).
  2. Positional fallback — if no named markers exist, markers map to
     chunks in chronological order.
  3. Count mismatch — warn with specifics, apply what matches, leave the
     rest at timing_source "none".

Precedence when SRT timing is also present: markers win per chunk;
chunks without a marker fall back to SRT distribution within their line.
"""

import re

CHUNK_MARKER_RE = re.compile(r"^Line0*(\d+)_Chunk0*(\d+)$", re.IGNORECASE)


def match_markers(markers, chunk_keys, fps):
    """Map markers to chunks.

    ``markers``: list of ``(name, frame)`` tuples.
    ``chunk_keys``: ordered list of ``(line_no, chunk_no)`` for every
    chunk being timed, in line/chunk order.
    ``fps``: effective frames per second (fps / fps_base).

    Returns ``(times, warnings)`` where ``times`` maps
    ``(line_no, chunk_no) -> start_seconds`` for matched chunks only.
    """
    warnings = []
    times = {}
    named = []
    for name, frame in markers:
        m = CHUNK_MARKER_RE.match(name.strip())
        if m:
            named.append(((int(m.group(1)), int(m.group(2))), frame))

    if named:
        chunk_set = set(chunk_keys)
        for key, frame in named:
            if key not in chunk_set:
                warnings.append(
                    f"marker Line{key[0]}_Chunk{key[1]} matches no generated "
                    "chunk — ignored"
                )
                continue
            if key in times:
                warnings.append(
                    f"duplicate marker for Line{key[0]}_Chunk{key[1]} — "
                    "keeping the earliest"
                )
                times[key] = min(times[key], frame / fps)
                continue
            times[key] = frame / fps
        return times, warnings

    if markers:
        ordered = sorted(frame for _, frame in markers)
        if len(ordered) != len(chunk_keys):
            warnings.append(
                f"{len(ordered)} markers, {len(chunk_keys)} chunks — applied "
                "what matches in order; the rest keep timing_source 'none'"
            )
        for key, frame in zip(chunk_keys, ordered):
            times[key] = frame / fps
    return times, warnings


def resolve_line_timing(
    line_no,
    chunk_texts,
    marker_times,
    srt_entry,
    distribute,
):
    """Combine marker and SRT timing for one line (§4.4 precedence).

    ``marker_times``: ``(line_no, chunk_no) -> seconds`` from
    :func:`match_markers`.
    ``srt_entry``: ``{"start": s, "end": s}`` or None.
    ``distribute``: the weighted distribution function
    (:func:`timing_srt.distribute`), injected to keep this module free of
    import direction concerns.

    Returns ``(chunk_times, line_span, line_source)`` where
    ``chunk_times`` is a list of ``(start_seconds_or_None, source)`` per
    chunk, ``line_span`` is ``(start, end)`` or ``(None, None)``, and
    ``line_source`` is "srt", "marker", or "none".
    """
    srt_starts = None
    if srt_entry is not None:
        srt_starts = distribute(srt_entry["start"], srt_entry["end"], chunk_texts)

    chunk_times = []
    any_marker = False
    for i in range(len(chunk_texts)):
        key = (line_no, i + 1)
        if key in marker_times:
            chunk_times.append((marker_times[key], "marker"))
            any_marker = True
        elif srt_starts is not None:
            chunk_times.append((srt_starts[i], "srt"))
        else:
            chunk_times.append((None, "none"))

    if srt_entry is not None:
        line_span = (srt_entry["start"], srt_entry["end"])
        line_source = "srt"
    elif any_marker:
        marked = [t for t, src in chunk_times if src == "marker"]
        line_span = (min(marked), None)
        line_source = "marker"
    else:
        line_span = (None, None)
        line_source = "none"
    return chunk_times, line_span, line_source


# ===== measure.py =================================================

"""Prefix width measurement via a temporary Text object (spec addendum §2.3).

Widths are read from the depsgraph-evaluated object — text dimensions
are not valid until evaluation.

Refinement over the plain cumulative-prefix method: each chunk's offset
is measured as

    offset_i = max_x(prefix + chunk_i) - max_x(chunk_i alone)

with both bodies measured LEFT-aligned. Subtracting the chunk's own
extent means word-separating spaces (which have no ink and would vanish
from a trailing-space measurement) are always interior to the measured
body, and the kerning pair straddling the chunk boundary is captured in
the offset. The residual §2.4 error is only the glyphs' own rendering,
which is identical either way.

Alignment: chunks are built LEFT/BASELINE-aligned and the template's
alignment is folded into a single base offset, measured by comparing the
full line's evaluated bounds under the template's alignment vs
LEFT/BASELINE. This keeps offsets measured against the same origin they
are applied to.
"""

import bpy


TEMP_MEASURE_NAME = "LC_measure_temp"

FONT_METRIC_ATTRS = (
    "size",
    "shear",
    "space_character",
    "space_word",
    "space_line",
    "small_caps_scale",
    "resolution_u",
    "extrude",
    "bevel_depth",
    "bevel_resolution",
    "offset",
)


def copy_font_metrics(src_data, dst_data):
    """Copy everything that affects glyph placement/extents from one text
    datablock to another."""
    if src_data.font is not None:
        dst_data.font = src_data.font
    for attr in FONT_METRIC_ATTRS:
        setattr(dst_data, attr, getattr(src_data, attr))


def evaluated_bounds(context, obj):
    """(min_x, min_y, max_x, max_y) of the evaluated object's local
    bound_box. Returns zeros for empty geometry."""
    context.view_layer.update()
    deps = context.evaluated_depsgraph_get()
    eval_obj = obj.evaluated_get(deps)
    corners = eval_obj.bound_box
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    return min(xs), min(ys), max(xs), max(ys)


class TextMeasurer:
    """Temporary Text object for width measurement. Use as a context
    manager so the temp object is always cleaned up."""

    def __init__(self, context, template, align_x='LEFT', align_y='BOTTOM_BASELINE'):
        self.context = context
        curve = bpy.data.curves.new(TEMP_MEASURE_NAME, type='FONT')
        if template is not None and template.type == 'FONT':
            copy_font_metrics(template.data, curve)
        curve.align_x = align_x
        curve.align_y = align_y
        self.obj = bpy.data.objects.new(TEMP_MEASURE_NAME, curve)
        self.obj.hide_render = True
        context.scene.collection.objects.link(self.obj)

    def bounds(self, body):
        self.obj.data.body = body
        return evaluated_bounds(self.context, self.obj)

    def max_x(self, body):
        return self.bounds(body)[2]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        data = self.obj.data
        bpy.data.objects.remove(self.obj, do_unlink=True)
        bpy.data.curves.remove(data)
        return False


def measure_layout(context, template, words):
    """Measure per-chunk X offsets and the alignment base offset.

    Returns ``(offsets, base)``: ``offsets`` is one local-space X offset
    per flat chunk, relative to the LEFT/BASELINE origin of the full
    line; ``base`` is the ``(x, y)`` translation that maps that origin
    into the template's alignment, so a chunk's final local position is
    ``(base_x + offset_i, base_y)``.
    """
    chunks = flat_chunks(words)
    line = full_text(words)

    with TextMeasurer(context, template) as m:
        offsets = []
        for i, chunk in enumerate(chunks):
            # The line up to and including this chunk, spaces intact.
            body = prefix_text(words, i) + chunk
            offsets.append(m.max_x(body) - m.max_x(chunk))
        left_bounds = m.bounds(line)

    base = (0.0, 0.0)
    if template is not None and template.type == 'FONT':
        with TextMeasurer(
            context,
            template,
            align_x=template.data.align_x,
            align_y=template.data.align_y,
        ) as m:
            aligned_bounds = m.bounds(line)
        base = (
            aligned_bounds[0] - left_bounds[0],
            aligned_bounds[1] - left_bounds[1],
        )
    return offsets, base


# ===== comp/settings_gen.py =======================================

"""Fusion node-graph generation from a line manifest (spec addendum §6).

Pure logic, no bpy — runs standalone (``scripts/generate_comp.py``) or
from inside Blender later.

Emits Fusion's clipboard ``.setting`` text: paste it into a Fusion comp
and the full per-chunk graph appears, replicating the reference
workflow captured from the Salizar_Brenda comp:

    Loader -> ColorGain -> Transform -> Merge chain

Per chunk, at its (line-local) start frame S:
  - ColorGain: Gain Green/Blue keyframed from (1.0, 1.0) at S to
    (0.4, 0.05) at S+1 — a one-frame flip from white to the highlight
    orange. Red and Alpha stay 1.0.
  - Transform: Center rides a 3-point PolyPath (rest, dip -0.015, rest)
    whose Displacement spline is keyed 0 -> 0.5 -> 1 at S, S+1, S+4 —
    byte-for-byte the structure of the hand-animated reference bounce.

Delivery is the §6.3 clipboard route. The reference comp uses MediaIn
nodes fed by the Media Pool; generated graphs use Loader nodes reading
the PNGs from disk, which avoids Media Pool IDs that cannot be
fabricated from outside Resolve. EXPERIMENTAL until pasted Loaders are
confirmed to render on the Fusion page of the target Resolve install —
if they do not, the fallback is pasting everything except the Loaders
and connecting Media Pool imports by hand.
"""

import re

DEFAULT_HIGHLIGHT_GAIN = (1.0, 0.4, 0.05)
DEFAULT_DIP_DEPTH = 0.015
DEFAULT_DIP_IN = 1
DEFAULT_DIP_OUT = 3

# ViewInfo grid spacing, roughly matching the hand-built reference layout.
_COL_X = 110.0
_ROW_Y = 33.0


def _join_clip_path(png_dir, filename):
    """Join using the clip dir's own separator style — the path is
    consumed by Resolve on the user's machine, not this one."""
    sep = "\\" if ("\\" in png_dir or re.match(r"^[A-Za-z]:", png_dir)) else "/"
    return png_dir.rstrip("/\\") + sep + filename


def _lua_str(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def _num(value):
    text = f"{float(value):.6f}".rstrip("0").rstrip(".")
    return text if text else "0"


def line_local_frames(doc):
    """Per-chunk start frames relative to the line's own start, for
    comps that live on a per-line timeline clip starting at frame 0.

    Returns (frames, warnings): one int per chunk. Chunks without
    timing land at 0 and produce a warning.
    """
    warnings = []
    render = doc.get("render", {})
    fps = render.get("fps", 24) / render.get("fps_base", 1.0)
    line = doc.get("line", {})
    starts = [c.get("start_frame") for c in doc["chunks"]]
    if line.get("start_seconds") is not None:
        base = round(line["start_seconds"] * fps)
    else:
        timed = [s for s in starts if s is not None]
        base = min(timed) if timed else 0
    frames = []
    for chunk, start in zip(doc["chunks"], starts):
        if start is None:
            warnings.append(
                f"{chunk['name']}: no timing (timing_source "
                f"{chunk.get('timing_source', 'none')!r}) — placed at frame 0"
            )
            frames.append(0)
        else:
            frames.append(max(0, start - base))
    return frames, warnings


def comp_length(doc, frames):
    render = doc.get("render", {})
    fps = render.get("fps", 24) / render.get("fps_base", 1.0)
    line = doc.get("line", {})
    if line.get("start_seconds") is not None and line.get("end_seconds") is not None:
        return max(1, round((line["end_seconds"] - line["start_seconds"]) * fps))
    return max(frames) + round(fps) if frames else round(fps)


def _loader(name, filename, length, pos):
    return f"""\
\t\t{name} = Loader {{
\t\t\tClips = {{
\t\t\t\tClip {{
\t\t\t\t\tID = "Clip1",
\t\t\t\t\tFilename = {_lua_str(filename)},
\t\t\t\t\tFormatID = "PNGFormat",
\t\t\t\t\tStartFrame = 0,
\t\t\t\t\tLengthSetManually = true,
\t\t\t\t\tTrimIn = 0,
\t\t\t\t\tTrimOut = 0,
\t\t\t\t\tExtendFirst = 0,
\t\t\t\t\tExtendLast = {length},
\t\t\t\t\tLoop = 0,
\t\t\t\t\tAspectMode = 0,
\t\t\t\t\tDepth = 0,
\t\t\t\t\tGlobalStart = 0,
\t\t\t\t\tGlobalEnd = {length}
\t\t\t\t}}
\t\t\t}},
\t\t\tInputs = {{
\t\t\t\t["Gamut.SLogVersion"] = Input {{ Value = FuID {{ "SLog2" }}, }},
\t\t\t}},
\t\t\tViewInfo = OperatorInfo {{ Pos = {{ {_num(pos[0])}, {_num(pos[1])} }} }},
\t\t}},
"""


def _spline(name, color, keyframes, locked_y=False):
    flags = "Linear = true, LockedY = true" if locked_y else "Linear = true"
    frames = ",\n".join(
        f"\t\t\t\t[{frame}] = {{ {_num(value)}, Flags = {{ {flags} }} }}"
        for frame, value in keyframes
    )
    return f"""\
\t\t{name} = BezierSpline {{
\t\t\tSplineColor = {{ Red = {color[0]}, Green = {color[1]}, Blue = {color[2]} }},
\t\t\tKeyFrames = {{
{frames}
\t\t\t}}
\t\t}},
"""


def _color_gain(name, source, start, dip_in, highlight, pos):
    """ColorGain with Green/Blue gain keyframed white -> highlight."""
    parts = [f"""\
\t\t{name} = ColorGain {{
\t\t\tInputs = {{
\t\t\t\tInput = Input {{ SourceOp = {_lua_str(source)}, Source = "Output", }},
\t\t\t\tGainRed = Input {{ Value = {_num(highlight[0])}, }},
\t\t\t\tGainGreen = Input {{ SourceOp = {_lua_str(name + "_Green")}, Source = "Value", }},
\t\t\t\tGainBlue = Input {{ SourceOp = {_lua_str(name + "_Blue")}, Source = "Value", }},
\t\t\t}},
\t\t\tViewInfo = OperatorInfo {{ Pos = {{ {_num(pos[0])}, {_num(pos[1])} }} }},
\t\t}},
"""]
    parts.append(_spline(
        name + "_Green", (16, 164, 16),
        [(start, 1.0), (start + dip_in, highlight[1])],
    ))
    parts.append(_spline(
        name + "_Blue", (16, 16, 164),
        [(start, 1.0), (start + dip_in, highlight[2])],
    ))
    return "".join(parts)


def _transform(name, source, start, dip_in, dip_out, depth, pos):
    """Transform whose Center rides a 3-point PolyPath (rest, -depth,
    rest) via a Displacement spline keyed 0 -> 0.5 -> 1 at S, S+dip_in,
    S+dip_in+dip_out — the exact structure of the reference comp's
    hand-animated bounce, so it edits identically in the spline editor."""
    path = name + "Path"
    return f"""\
\t\t{name} = Transform {{
\t\t\tInputs = {{
\t\t\t\tInput = Input {{ SourceOp = {_lua_str(source)}, Source = "Output", }},
\t\t\t\tCenter = Input {{ SourceOp = {_lua_str(path)}, Source = "Position", }},
\t\t\t}},
\t\t\tViewInfo = OperatorInfo {{ Pos = {{ {_num(pos[0])}, {_num(pos[1])} }} }},
\t\t}},
\t\t{path} = PolyPath {{
\t\t\tDrawMode = "InsertAndModify",
\t\t\tInputs = {{
\t\t\t\tDisplacement = Input {{
\t\t\t\t\tSourceOp = {_lua_str(path + "Displacement")},
\t\t\t\t\tSource = "Value",
\t\t\t\t}},
\t\t\t\tPolyLine = Input {{
\t\t\t\t\tValue = Polyline {{
\t\t\t\t\t\tPoints = {{
\t\t\t\t\t\t\t{{ Linear = true, LockY = true, X = 0, Y = 0 }},
\t\t\t\t\t\t\t{{ Linear = true, LockY = true, X = 0, Y = {_num(-depth)} }},
\t\t\t\t\t\t\t{{ Linear = true, LockY = true, X = 0, Y = 0 }}
\t\t\t\t\t\t}}
\t\t\t\t\t}},
\t\t\t\t}}
\t\t\t}},
\t\t}},
""" + _spline(
        path + "Displacement", (255, 0, 255),
        [(start, 0.0), (start + dip_in, 0.5), (start + dip_in + dip_out, 1.0)],
        locked_y=True,
    )


def _merge(name, background, foreground, pos):
    return f"""\
\t\t{name} = Merge {{
\t\t\tInputs = {{
\t\t\t\tBackground = Input {{ SourceOp = {_lua_str(background)}, Source = "Output", }},
\t\t\t\tForeground = Input {{ SourceOp = {_lua_str(foreground)}, Source = "Output", }},
\t\t\t\tPerformDepthMerge = Input {{ Value = 0, }},
\t\t\t}},
\t\t\tViewInfo = OperatorInfo {{ Pos = {{ {_num(pos[0])}, {_num(pos[1])} }} }},
\t\t}},
"""


def generate_line_setting(
    doc,
    png_dir,
    highlight=DEFAULT_HIGHLIGHT_GAIN,
    dip_depth=DEFAULT_DIP_DEPTH,
    dip_in=DEFAULT_DIP_IN,
    dip_out=DEFAULT_DIP_OUT,
):
    """Build the pasteable node-graph text for one line manifest.

    ``png_dir`` is the directory holding the chunk PNGs (normally the
    manifest's own folder). Returns ``(text, warnings)``. The graph ends
    at the last Merge (or the single chunk's Transform) — wire that to
    MediaOut after pasting.
    """
    chunks = doc["chunks"]
    if not chunks:
        raise ValueError("manifest has no chunks")
    frames, warnings = line_local_frames(doc)
    length = comp_length(doc, frames)

    tools = []
    branch_tips = []
    for row, (chunk, start) in enumerate(zip(chunks, frames)):
        base = chunk["name"]
        y = row * _ROW_Y
        loader = f"Load_{base}"
        color = f"Color_{base}"
        move = f"Move_{base}"
        tools.append(_loader(
            loader, _join_clip_path(png_dir, chunk["filename"]), length,
            (0.0, y),
        ))
        tools.append(_color_gain(color, loader, start, dip_in, highlight, (_COL_X, y)))
        tools.append(_transform(move, color, start, dip_in, dip_out, dip_depth, (2 * _COL_X, y)))
        branch_tips.append(move)

    line_no = doc["line"]["index"]
    current = branch_tips[0]
    for i, tip in enumerate(branch_tips[1:], start=1):
        merge = f"Merge_Line{line_no}_{i}"
        tools.append(_merge(
            merge, current, tip,
            (3 * _COL_X + i * 40.0, (i + 0.5) * _ROW_Y),
        ))
        current = merge

    text = (
        "{\n"
        "\tTools = ordered() {\n"
        + "".join(tools)
        + "\t},\n"
        f"\tActiveTool = {_lua_str(current)}\n"
        "}\n"
    )
    return text, warnings


# ===== properties.py ==============================================

"""Scene state, add-on preferences, and shared helpers."""

import textwrap

import bpy
from bpy.props import (
    BoolProperty,
    CollectionProperty,
    FloatProperty,
    IntProperty,
    PointerProperty,
    StringProperty,
)
from bpy.types import AddonPreferences, PropertyGroup


# Resolves to the extension's full module path when installed as an
# Extension, the package name in a dev checkout, and the module name in
# the flattened single-file build.
ADDON_KEY = __package__ or "lyric_chunker"

DEFAULT_VERIFY_THRESHOLD = 2


def set_status(context, message, error=False):
    props = context.scene.lyric_chunker
    props.status = message
    props.status_error = error


def status_lines(props, width=44, max_rows=6):
    return textwrap.wrap(props.status, width=width)[:max_rows]


def get_prefs(context):
    addon = context.preferences.addons.get(ADDON_KEY)
    return addon.preferences if addon is not None else None


def verify_threshold(context):
    prefs = get_prefs(context)
    if prefs is None:
        return DEFAULT_VERIFY_THRESHOLD
    return prefs.verify_threshold


def active_camera(context):
    props = context.scene.lyric_chunker
    return props.camera_object or context.scene.camera


def _poll_camera(self, obj):
    return obj.type == 'CAMERA'


def _poll_font(self, obj):
    return obj.type == 'FONT'


def _sync_selected_line(self, context):
    """Keep line_number pointing at the selected list row so the
    Generate/Render Line N buttons target what's highlighted."""
    if 0 <= self.lyric_line_index < len(self.lyric_lines):
        self.line_number = self.start_index + self.lyric_line_index


class LCLyricLine(PropertyGroup):
    text: StringProperty(name="Line", default="")


class LCStylePreset(PropertyGroup):
    """Named style configuration captured from the template object (§5.2)."""
    name: StringProperty(name="Name", default="Preset")
    font_path: StringProperty(default="")
    size: FloatProperty(default=1.0)
    extrude: FloatProperty(default=0.0)
    bevel_depth: FloatProperty(default=0.0)
    bevel_resolution: IntProperty(default=4)
    shear: FloatProperty(default=0.0)
    space_character: FloatProperty(default=1.0)
    space_word: FloatProperty(default=1.0)
    align_x: StringProperty(default='LEFT')
    align_y: StringProperty(default='BOTTOM_BASELINE')
    material_name: StringProperty(default="")


class LyricChunkerProps(PropertyGroup):
    lyrics_text: PointerProperty(
        name="Lyrics",
        description=(
            "Text datablock with one delimited lyric line per row (edit it "
            "in the Text Editor). Leave empty to use the single-line field"
        ),
        type=bpy.types.Text,
    )
    line_text: StringProperty(
        name="Lyric Line",
        description=(
            "Single delimited lyric line, e.g. 'Some|thing wick|ed this "
            "way comes'. The delimiter splits syllables, whitespace splits "
            "words, hyphens are literal"
        ),
        default="",
    )
    delimiter: StringProperty(
        name="Delimiter",
        description=(
            "Sub-word split marker. '|' never appears in sung text, which "
            "is why it is the default"
        ),
        default=DEFAULT_DELIMITER,
        maxlen=8,
    )
    lyric_lines: CollectionProperty(type=LCLyricLine)
    lyric_line_index: IntProperty(default=0, update=_sync_selected_line)
    start_index: IntProperty(
        name="Start Index",
        description=(
            "Line number of the first row in the lyrics list, so lines "
            "12-20 can be rendered without renumbering (also offsets SRT "
            "entry mapping)"
        ),
        default=1,
        min=1,
        update=_sync_selected_line,
    )
    line_number: IntProperty(
        name="Line Number",
        description="Target line for single-line generate/render/verify",
        default=1,
        min=1,
    )
    force_uppercase: BoolProperty(
        name="Force Uppercase",
        description="Uppercase the text before generating",
        default=True,
    )
    template_object: PointerProperty(
        name="Template",
        description=(
            "Styled text object to copy font, extrude, bevel, materials, "
            "placement, and alignment from"
        ),
        type=bpy.types.Object,
        poll=_poll_font,
    )
    camera_object: PointerProperty(
        name="Camera",
        description="Camera to render through (falls back to the scene camera)",
        type=bpy.types.Object,
        poll=_poll_camera,
    )
    output_root: StringProperty(
        name="Output Root",
        description="Renders save to <output root>/Line#/Line#_Chunk#.png",
        subtype='DIR_PATH',
        default="",
    )
    zero_pad: BoolProperty(
        name="Zero-pad Numbers",
        description="Name as Line01_Chunk01 instead of Line1_Chunk1",
        default=False,
    )
    srt_path: StringProperty(
        name="SRT File",
        description=(
            "Subtitle file supplying line start/end times; entry N maps to "
            "line N in order. Text content still comes from the lyrics "
            "block, not the SRT"
        ),
        subtype='FILE_PATH',
        default="",
    )
    use_markers: BoolProperty(
        name="Use Timeline Markers",
        description=(
            "Read chunk timing from timeline markers. A marker named "
            "Line1_Chunk1 binds directly; unnamed markers map to chunks in "
            "order. Markers win over SRT per chunk"
        ),
        default=True,
    )
    style_presets: CollectionProperty(type=LCStylePreset)
    style_preset_index: IntProperty(default=0)
    active_preset: StringProperty(
        description="Name of the last applied style preset, recorded in manifests",
        default="",
    )
    status: StringProperty(default="Ready")
    status_error: BoolProperty(default=False)
    last_line: IntProperty(default=0)
    is_rendering: BoolProperty(default=False)
    render_cancel: BoolProperty(default=False)
    progress: StringProperty(default="")


class LyricChunkerPreferences(AddonPreferences):
    bl_idname = ADDON_KEY

    verify_threshold: IntProperty(
        name="Verify Threshold",
        description=(
            "Maximum per-pixel delta (0-255 scale) for Verify Line to pass"
        ),
        default=DEFAULT_VERIFY_THRESHOLD,
        min=0,
        max=255,
    )

    def draw(self, context):
        self.layout.prop(self, "verify_threshold")


# ===== presets.py =================================================

"""Style presets (spec addendum §5.2): save and load named style
configurations (font, size, extrude, bevel, material, alignment) on the
scene. The active preset name is recorded in each manifest's
``project.style_preset``."""

import bpy
from bpy.types import Operator, UIList


PRESET_FIELDS = (
    "size",
    "extrude",
    "bevel_depth",
    "bevel_resolution",
    "shear",
    "space_character",
    "space_word",
    "align_x",
    "align_y",
)


def capture_preset(preset, template):
    data = template.data
    preset.font_path = data.font.filepath if data.font is not None else ""
    for field in PRESET_FIELDS:
        setattr(preset, field, getattr(data, field))
    mats = [s.material for s in template.material_slots if s.material]
    preset.material_name = mats[0].name if mats else ""


def apply_preset(preset, template):
    """Write a preset onto the template object. Returns warnings."""
    warnings = []
    data = template.data
    if preset.font_path:
        try:
            data.font = bpy.data.fonts.load(preset.font_path, check_existing=True)
        except RuntimeError:
            warnings.append(f"font file unresolved: {preset.font_path}")
    for field in PRESET_FIELDS:
        setattr(data, field, getattr(preset, field))
    if preset.material_name:
        mat = bpy.data.materials.get(preset.material_name)
        if mat is None:
            warnings.append(f"material '{preset.material_name}' not found")
        else:
            data.materials.clear()
            data.materials.append(mat)
    return warnings


class LC_UL_style_presets(UIList):
    def draw_item(self, context, layout, data, item, icon, active_data,
                  active_prop, index):
        layout.prop(item, "name", text="", emboss=False, icon='PRESET')


class LC_OT_preset_save(Operator):
    bl_idname = "lyric_chunker.preset_save"
    bl_label = "Save Preset"
    bl_description = "Capture the template object's current style as a named preset"

    def execute(self, context):
        props = context.scene.lyric_chunker
        template = props.template_object
        if template is None or template.type != 'FONT':
            set_status(context, "Pick a text template object first", error=True)
            self.report({'ERROR'}, "Pick a text template object first")
            return {'CANCELLED'}
        preset = props.style_presets.add()
        preset.name = f"Preset {len(props.style_presets)}"
        capture_preset(preset, template)
        props.style_preset_index = len(props.style_presets) - 1
        props.active_preset = preset.name
        set_status(context, f"Saved style preset '{preset.name}'")
        return {'FINISHED'}


class LC_OT_preset_apply(Operator):
    bl_idname = "lyric_chunker.preset_apply"
    bl_label = "Apply Preset"
    bl_description = "Apply the selected preset to the template object"

    def execute(self, context):
        props = context.scene.lyric_chunker
        template = props.template_object
        if template is None or template.type != 'FONT':
            set_status(context, "Pick a text template object first", error=True)
            self.report({'ERROR'}, "Pick a text template object first")
            return {'CANCELLED'}
        if not (0 <= props.style_preset_index < len(props.style_presets)):
            set_status(context, "No preset selected", error=True)
            return {'CANCELLED'}
        preset = props.style_presets[props.style_preset_index]
        warnings = apply_preset(preset, template)
        props.active_preset = preset.name
        message = f"Applied style preset '{preset.name}'"
        if warnings:
            message += f" — {'; '.join(warnings)}"
            for w in warnings:
                self.report({'WARNING'}, w)
        set_status(context, message, error=False)
        return {'FINISHED'}


class LC_OT_preset_remove(Operator):
    bl_idname = "lyric_chunker.preset_remove"
    bl_label = "Remove Preset"
    bl_description = "Delete the selected preset"

    def execute(self, context):
        props = context.scene.lyric_chunker
        index = props.style_preset_index
        if not (0 <= index < len(props.style_presets)):
            return {'CANCELLED'}
        name = props.style_presets[index].name
        props.style_presets.remove(index)
        props.style_preset_index = min(index, len(props.style_presets) - 1)
        if props.active_preset == name:
            props.active_preset = ""
        set_status(context, f"Removed style preset '{name}'")
        return {'FINISHED'}


# ===== ops_setup.py ===============================================

"""Set Up Scene (spec addendum §5.0).

Optional and strictly non-destructive: never modifies existing objects,
creates everything inside a dedicated ``LyricChunker`` collection with an
``LC_`` name prefix, and warns instead of creating a second camera when
the scene already has one. The panel works fully in a hand-built scene —
this button is never required.
"""

import math

import bpy
from bpy.types import Operator


SETUP_COLL_NAME = "LyricChunker"
TEMPLATE_NAME = "LC_Template"
CAMERA_NAME = "LC_Camera"
LIGHT_NAME = "LC_Sun"
MATERIAL_NAME = "LC_White"


def default_material():
    """White Principled BSDF matching the project's house material:
    metallic 0, roughness 0.5, alpha 1 — lit by the scene, tinted in
    Fusion."""
    mat = bpy.data.materials.get(MATERIAL_NAME)
    if mat is None:
        mat = bpy.data.materials.new(MATERIAL_NAME)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = 0.5
    return mat


# The project's house style (from the reference Text object): Georgia
# Bold Italic, extrude 0.12, round bevel 0.03 @ resolution 4, character
# spacing 1.1, word spacing 1.4, Left / Top Baseline alignment.
HOUSE_STYLE = {
    "extrude": 0.12,
    "bevel_depth": 0.03,
    "bevel_resolution": 4,
    "space_character": 1.1,
    "space_word": 1.4,
    "align_x": 'LEFT',
    "align_y": 'TOP_BASELINE',
}

# Where Georgia Bold Italic usually lives, per platform. If none of
# these resolve, the template falls back to Blender's built-in font and
# the operator says so — the style is otherwise identical.
HOUSE_FONT_CANDIDATES = (
    "C:\\Windows\\Fonts\\georgiaz.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf",
    "/Library/Fonts/Georgia Bold Italic.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Georgia_Bold_Italic.ttf",
)


def load_house_font():
    for path in HOUSE_FONT_CANDIDATES:
        try:
            return bpy.data.fonts.load(path, check_existing=True)
        except RuntimeError:
            continue
    return None


def apply_house_style(curve):
    for attr, value in HOUSE_STYLE.items():
        setattr(curve, attr, value)


def _setup_collection(context):
    coll = bpy.data.collections.get(SETUP_COLL_NAME)
    if coll is None:
        coll = bpy.data.collections.new(SETUP_COLL_NAME)
    if coll.name not in context.scene.collection.children:
        context.scene.collection.children.link(coll)
    return coll


class LC_OT_setup_scene(Operator):
    bl_idname = "lyric_chunker.setup_scene"
    bl_label = "Set Up Scene"
    bl_description = (
        "Create a camera framed for one line of text, a minimal light, and "
        "a default template text object — all inside a LyricChunker "
        "collection, never touching existing objects"
    )
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        scene = context.scene
        props = scene.lyric_chunker
        coll = _setup_collection(context)
        created = []
        notes = []

        if scene.camera is not None:
            notes.append(
                f"scene already has camera '{scene.camera.name}' — using it"
            )
        elif bpy.data.objects.get(CAMERA_NAME) is None:
            cam_data = bpy.data.cameras.new(CAMERA_NAME)
            cam_data.lens = 50.0
            cam = bpy.data.objects.new(CAMERA_NAME, cam_data)
            # Front view down +Y; at 50mm/36mm sensor this frames roughly
            # ten units of text width at the origin.
            cam.location = (0.0, -14.0, 0.0)
            cam.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
            coll.objects.link(cam)
            scene.camera = cam
            created.append(cam.name)

        if bpy.data.objects.get(LIGHT_NAME) is None:
            light_data = bpy.data.lights.new(LIGHT_NAME, type='SUN')
            light_data.energy = 3.0
            light = bpy.data.objects.new(LIGHT_NAME, light_data)
            light.location = (0.0, -4.0, 6.0)
            light.rotation_euler = (math.radians(35.0), 0.0, 0.0)
            coll.objects.link(light)
            created.append(light.name)

        template = bpy.data.objects.get(TEMPLATE_NAME)
        if template is None:
            curve = bpy.data.curves.new(TEMPLATE_NAME, type='FONT')
            curve.body = "TEMPLATE"
            apply_house_style(curve)
            font = load_house_font()
            if font is not None:
                curve.font = font
            else:
                notes.append(
                    "Georgia Bold Italic not found on this machine — "
                    "template uses the built-in font; pick yours in the "
                    "Font panel"
                )
            curve.materials.append(default_material())
            template = bpy.data.objects.new(TEMPLATE_NAME, curve)
            template.location = (0.0, 0.0, 0.0)
            coll.objects.link(template)
            created.append(template.name)

        if props.template_object is None:
            props.template_object = template

        message = (
            f"Created {', '.join(created)}" if created
            else "Scene already set up — nothing created"
        )
        if notes:
            message += f" ({'; '.join(notes)})"
            self.report({'WARNING'}, "; ".join(notes))
        set_status(context, message)
        return {'FINISHED'}


# ===== ops_generate.py ============================================

"""Chunk generation via per-chunk Text objects (spec addendum §2).

One Text object per chunk, positioned by cumulative-prefix measurement.
No mesh conversion — extrude and bevel live on the Text objects, chunks
stay editable strings, and there is no island analysis to go wrong.
"""

import re

import bpy
from bpy.types import Operator
from mathutils import Vector


LINE_COLL_RE = re.compile(r"^Line0*(\d+)$")
CHUNK_OBJ_RE = re.compile(r"^Line0*(\d+)_Chunk0*(\d+)")


def find_line_collection(scene, line_no):
    for coll in scene.collection.children_recursive:
        m = LINE_COLL_RE.match(coll.name)
        if m and int(m.group(1)) == line_no:
            return coll
    return None


def collect_line_chunks(scene):
    """Map line number -> (collection, [chunk objects sorted by chunk #])."""
    lines = {}
    for coll in scene.collection.children_recursive:
        m = LINE_COLL_RE.match(coll.name)
        if not m:
            continue
        entries = []
        for obj in coll.objects:
            cm = CHUNK_OBJ_RE.match(obj.name)
            if cm and obj.type == 'FONT':
                entries.append((int(cm.group(2)), obj))
        if entries:
            entries.sort(key=lambda e: e[0])
            lines[int(m.group(1))] = (coll, [obj for _, obj in entries])
    return lines


def get_target_line(context):
    """Line the single-line buttons act on: the active object's line if it
    is a chunk, else the last generated line, else the panel field."""
    obj = context.active_object
    if obj is not None:
        for coll in obj.users_collection:
            m = LINE_COLL_RE.match(coll.name)
            if m:
                return int(m.group(1))
    props = context.scene.lyric_chunker
    if props.last_line > 0:
        return props.last_line
    return props.line_number


def remove_object_and_data(obj):
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data is not None and data.users == 0:
        if isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)
        elif isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)


def remove_existing_line(context, line_no):
    coll = find_line_collection(context.scene, line_no)
    if coll is None:
        return False
    for obj in list(coll.objects):
        remove_object_and_data(obj)
    # Remove the collection too, or the regenerated line would land in a
    # 'Line1.001' collection that the name-based lookups can't see.
    bpy.data.collections.remove(coll)
    return True


def apply_template_style(text_data, template):
    """Copy font metrics and materials from the template onto a chunk's
    text datablock. Alignment is NOT copied — chunks are LEFT/BASELINE
    and the template's alignment is folded into the measured base offset."""
    if template is not None and template.type == 'FONT':
        copy_font_metrics(template.data, text_data)
        mats = [s.material for s in template.material_slots if s.material]
        for mat in mats or [default_material()]:
            text_data.materials.append(mat)
    else:
        apply_house_style(text_data)
        font = load_house_font()
        if font is not None:
            text_data.font = font
        text_data.materials.append(default_material())
    text_data.align_x = 'LEFT'
    text_data.align_y = 'BOTTOM_BASELINE'


def chunk_local_position(base, offset_x):
    return (base[0] + offset_x, base[1])


def place_chunk(obj, template, cursor_location, local_x, local_y):
    if template is not None:
        obj.location = template.matrix_world @ Vector((local_x, local_y, 0.0))
        obj.rotation_euler = template.rotation_euler.copy()
        obj.scale = template.scale.copy()
    else:
        obj.location = cursor_location + Vector((local_x, local_y, 0.0))


def generate_line(context, line_no, raw_text, words, props):
    """Create the per-chunk Text objects for one line. Returns
    (chunk_objects, replaced)."""
    scene = context.scene
    template = props.template_object
    pad = props.zero_pad

    replaced = remove_existing_line(context, line_no)
    offsets, base = measure_layout(context, template, words)
    chunks = flat_chunks(words)

    coll = bpy.data.collections.new(line_dirname(line_no, pad))
    scene.collection.children.link(coll)
    coll["lc_line"] = line_no
    coll["lc_text_raw"] = raw_text
    coll["lc_delimiter"] = props.delimiter

    cursor = scene.cursor.location.copy()
    objs = []
    for i, (text, offset_x) in enumerate(zip(chunks, offsets), start=1):
        name = chunk_name(line_no, i, pad)
        curve = bpy.data.curves.new(name, type='FONT')
        curve.body = text
        apply_template_style(curve, template)
        obj = bpy.data.objects.new(name, curve)
        local_x, local_y = chunk_local_position(base, offset_x)
        place_chunk(obj, template, cursor, local_x, local_y)
        obj["lc_line"] = line_no
        obj["lc_chunk"] = i
        obj["lc_text"] = text
        obj["lc_offset_x"] = offset_x
        obj["lc_local_x"] = local_x
        obj["lc_local_y"] = local_y
        coll.objects.link(obj)
        objs.append(obj)
    return objs, replaced


def parse_input_lines(props):
    """Lines to generate from the panel state, in priority order: the
    panel lyric list, else an attached lyrics text block (§5.3), else
    the single-line field. Returns (lines, warnings) with lines as
    (line_no, raw, words) tuples."""
    if len(props.lyric_lines):
        lines = []
        warnings = []
        # List rows map 1:1 to numbers (start_index + row) so the panel
        # labels, generate targets, and SRT mapping all agree — an empty
        # row is skipped but keeps its number.
        for row, item in enumerate(props.lyric_lines):
            number = props.start_index + row
            raw = item.text.strip()
            if not raw:
                warnings.append(f"Line {number}: empty row — skipped")
                continue
            words, w = split_line(raw, props.delimiter)
            warnings.extend(f"Line {number}: {msg}" for msg in w)
            if not words:
                warnings.append(f"Line {number}: no chunks after splitting — skipped")
                continue
            lines.append((number, raw, words))
    elif props.lyrics_text is not None:
        text = props.lyrics_text.as_string()
        lines, warnings = parse_block(text, props.delimiter, props.start_index)
    else:
        words, warnings = split_line(props.line_text, props.delimiter)
        lines = [(props.line_number, props.line_text.strip(), words)] if words else []
    if props.force_uppercase:
        lines = [
            (no, raw.upper(), [[c.upper() for c in word] for word in words])
            for no, raw, words in lines
        ]
    return lines, warnings


class LC_OT_generate_chunks(Operator):
    bl_idname = "lyric_chunker.generate_chunks"
    bl_label = "Generate Chunks"
    bl_description = (
        "Create one styled Text object per chunk, positioned by prefix "
        "measurement, filed into a Line# collection"
    )
    bl_options = {'REGISTER', 'UNDO'}

    all_lines: bpy.props.BoolProperty(default=False, options={'HIDDEN'})

    def fail(self, context, message):
        set_status(context, message, error=True)
        self.report({'ERROR'}, message)
        return {'CANCELLED'}

    def execute(self, context):
        props = context.scene.lyric_chunker
        if not props.delimiter:
            return self.fail(context, "Delimiter is empty")
        if props.template_object is None:
            self.report(
                {'WARNING'},
                "No template set — default style at the 3D cursor "
                "(pick one, or run Set Up Scene)",
            )

        lines, warnings = parse_input_lines(props)
        if not lines:
            return self.fail(
                context,
                "Nothing to generate — enter a lyric line or pick a lyrics text",
            )
        if not self.all_lines:
            if len(props.lyric_lines) or props.lyrics_text is not None:
                wanted = props.line_number
                lines = [entry for entry in lines if entry[0] == wanted]
                if not lines:
                    return self.fail(
                        context,
                        f"Line {wanted} is not in the lyrics "
                        f"(rows start at {props.start_index})",
                    )
            # Single-line field mode already targets props.line_number.

        if context.object is not None and context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')

        total_chunks = 0
        replaced_any = False
        for line_no, raw, words in lines:
            objs, replaced = generate_line(context, line_no, raw, words, props)
            total_chunks += len(objs)
            replaced_any = replaced_any or replaced
            props.last_line = line_no

        if (not len(props.lyric_lines) and props.lyrics_text is None
                and not self.all_lines):
            props.line_number = lines[-1][0] + 1

        message = f"Generated {len(lines)} line(s), {total_chunks} chunks"
        if replaced_any:
            message += " (replaced existing)"
        if warnings:
            message += f" — {'; '.join(warnings[:3])}"
            for w in warnings:
                self.report({'WARNING'}, w)
        set_status(context, message, error=False)
        return {'FINISHED'}


class LC_OT_add_line(Operator):
    bl_idname = "lyric_chunker.add_line"
    bl_label = "Add Line"
    bl_description = (
        "Add the typed lyric line to the list below, numbered after the "
        "last entry"
    )

    def execute(self, context):
        props = context.scene.lyric_chunker
        raw = props.line_text.strip()
        if not raw:
            set_status(context, "Type a lyric line first", error=True)
            self.report({'ERROR'}, "Type a lyric line first")
            return {'CANCELLED'}
        words, warnings = split_line(raw, props.delimiter)
        if not words:
            set_status(context, "Line has no chunks after splitting", error=True)
            self.report({'ERROR'}, "Line has no chunks after splitting")
            return {'CANCELLED'}
        item = props.lyric_lines.add()
        item.text = raw
        props.lyric_line_index = len(props.lyric_lines) - 1
        props.line_text = ""
        number = props.start_index + len(props.lyric_lines) - 1
        message = f"Added Line {number}: {raw}"
        if warnings:
            message += f" — {'; '.join(warnings)}"
        set_status(context, message)
        return {'FINISHED'}


class LC_OT_remove_line(Operator):
    bl_idname = "lyric_chunker.remove_line"
    bl_label = "Remove Line"
    bl_description = (
        "Remove the selected line from the list (later rows shift down a "
        "number, so regenerate them if already generated)"
    )

    def execute(self, context):
        props = context.scene.lyric_chunker
        index = props.lyric_line_index
        if not (0 <= index < len(props.lyric_lines)):
            return {'CANCELLED'}
        removed = props.lyric_lines[index].text
        props.lyric_lines.remove(index)
        props.lyric_line_index = min(index, len(props.lyric_lines) - 1)
        set_status(context, f"Removed line: {removed}")
        return {'FINISHED'}


class LC_OT_import_lines(Operator):
    bl_idname = "lyric_chunker.import_lines"
    bl_label = "Import Rows"
    bl_description = (
        "Append every non-empty row of the picked lyrics text block to "
        "the line list (paste a whole song in the Text Editor, then pull "
        "it in here)"
    )

    def execute(self, context):
        props = context.scene.lyric_chunker
        if props.lyrics_text is None:
            set_status(context, "Pick a lyrics text block to import from", error=True)
            self.report({'ERROR'}, "Pick a lyrics text block to import from")
            return {'CANCELLED'}
        added = 0
        for raw in props.lyrics_text.as_string().splitlines():
            if raw.strip():
                item = props.lyric_lines.add()
                item.text = raw.strip()
                added += 1
        if added:
            props.lyric_line_index = len(props.lyric_lines) - 1
        set_status(
            context,
            f"Imported {added} line(s) from '{props.lyrics_text.name}'",
        )
        return {'FINISHED'}


class LC_OT_new_lyrics_text(Operator):
    bl_idname = "lyric_chunker.new_lyrics_text"
    bl_label = "New Lyrics Text"
    bl_description = (
        "Create a text datablock for multi-line lyrics (edit it in the "
        "Text Editor, one delimited line per row)"
    )

    def execute(self, context):
        props = context.scene.lyric_chunker
        text = bpy.data.texts.new("Lyrics")
        text.write("Some|thing wick|ed this way comes\n")
        props.lyrics_text = text
        set_status(
            context,
            f"Created '{text.name}' — edit it in the Text Editor, one line per row",
        )
        return {'FINISHED'}


# ===== ops_render.py ==============================================

"""Render pipeline (spec addendum §3): modal job queue, render-settings
assertions, manifest writing, single-chunk re-render (§5.1), and the
contact sheet preview (§5.4).

The per-chunk render strategy is isolated in
:func:`render_single_chunk` (§3.2) so the v1.5 Object-Index single-pass
strategy (§6.4) is a one-function swap.
"""

import datetime
import glob
import os

import bpy
from bpy.types import Operator
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector



def effective_fps(scene):
    return scene.render.fps / scene.render.fps_base


def now_utc_iso():
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


# ---------------------------------------------------------------------------
# Render settings (§3.3)
# ---------------------------------------------------------------------------

class RenderSettingsGuard:
    """Save/restore everything the batch mutates. Restore is tolerant of
    format/mode combinations the prior format did not support."""

    def __init__(self, scene):
        self.scene = scene
        render = scene.render
        img = render.image_settings
        self.saved = {
            "filepath": render.filepath,
            "file_format": img.file_format,
            "color_mode": img.color_mode,
            "color_depth": img.color_depth,
            "film_transparent": render.film_transparent,
            "resolution_percentage": render.resolution_percentage,
        }

    def restore(self):
        render = self.scene.render
        img = render.image_settings
        render.filepath = self.saved["filepath"]
        render.film_transparent = self.saved["film_transparent"]
        render.resolution_percentage = self.saved["resolution_percentage"]
        img.file_format = self.saved["file_format"]
        try:
            img.color_mode = self.saved["color_mode"]
            img.color_depth = self.saved["color_depth"]
        except TypeError:
            pass


def assert_render_settings(scene):
    """Force the §3.3 invariants before every batch — silently losing
    film_transparent ruins an entire batch invisibly. Returns notes for
    anything that had to be corrected."""
    notes = []
    render = scene.render
    img = render.image_settings
    if not render.film_transparent:
        render.film_transparent = True
        notes.append("enabled Film > Transparent")
    if img.file_format != 'PNG':
        img.file_format = 'PNG'
        notes.append("set output format to PNG")
    if img.color_mode != 'RGBA':
        img.color_mode = 'RGBA'
        notes.append("set color mode to RGBA")
    if img.color_depth != '16':
        img.color_depth = '16'
        notes.append("set color depth to 16-bit")
    return notes


class ChunkVisibilityGuard:
    """Hide/restore chunk objects, the template, and target collections'
    renderability for the duration of a batch."""

    def __init__(self, context, lines, targets, template):
        self.saved_hide = {}
        self.saved_coll = {}
        self.template = template
        all_chunks = [obj for _, objs in lines.values() for obj in objs]
        for obj in all_chunks:
            self.saved_hide[obj] = obj.hide_render
        if template is not None and template not in self.saved_hide:
            self.saved_hide[template] = template.hide_render
            template.hide_render = True
        for line_no in targets:
            coll, _ = lines[line_no]
            layer_coll = _find_layer_collection(
                context.view_layer.layer_collection, coll
            )
            was_excluded = layer_coll is not None and layer_coll.exclude
            self.saved_coll[coll] = (coll.hide_render, layer_coll, was_excluded)
            coll.hide_render = False
            if was_excluded:
                layer_coll.exclude = False
        self.all_chunks = all_chunks

    def restore(self):
        for obj, hidden in self.saved_hide.items():
            try:
                obj.hide_render = hidden
            except ReferenceError:
                pass
        for coll, (hide, layer_coll, was_excluded) in self.saved_coll.items():
            try:
                coll.hide_render = hide
                if layer_coll is not None and was_excluded:
                    layer_coll.exclude = True
            except ReferenceError:
                pass


def _find_layer_collection(layer_coll, coll):
    if layer_coll.collection == coll:
        return layer_coll
    for child in layer_coll.children:
        found = _find_layer_collection(child, coll)
        if found is not None:
            return found
    return None


# ---------------------------------------------------------------------------
# Render strategy (§3.2) — the §6.4 single-pass swap point
# ---------------------------------------------------------------------------

def render_single_chunk(scene, obj, filepath, all_chunk_objs):
    """Render one chunk in isolation to ``filepath``."""
    for other in all_chunk_objs:
        other.hide_render = other is not obj
    scene.render.filepath = filepath
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------------------
# Timing (§4)
# ---------------------------------------------------------------------------

def compute_timing(context, lines, targets):
    """Resolve per-chunk timing for the target lines.

    Returns ``(timing, warnings)`` with ``timing`` mapping
    ``line_no -> (chunk_times, line_span, line_source)``. Raises
    SrtParseError (with a readable message) on a malformed SRT file.
    """
    props = context.scene.lyric_chunker
    warnings = []

    entries = None
    if props.srt_path.strip():
        path = bpy.path.abspath(props.srt_path)
        try:
            with open(path, "r", encoding="utf-8-sig") as fh:
                entries = parse_srt(fh.read())
        except OSError as exc:
            raise SrtParseError(f"cannot read SRT file: {exc}") from exc
        if len(entries) < max(targets):
            warnings.append(
                f"SRT has {len(entries)} entries but line "
                f"{max(targets)} was requested — unmatched lines fall back "
                "to markers or 'none'"
            )

    marker_times = {}
    if props.use_markers and context.scene.timeline_markers:
        chunk_keys = []
        for line_no in targets:
            _, objs = lines[line_no]
            chunk_keys.extend((line_no, int(o["lc_chunk"])) for o in objs)
        markers = [(m.name, m.frame) for m in context.scene.timeline_markers]
        marker_times, marker_warnings = match_markers(
            markers, chunk_keys, effective_fps(context.scene)
        )
        warnings.extend(marker_warnings)

    timing = {}
    for line_no in targets:
        _, objs = lines[line_no]
        chunk_texts = [str(o["lc_text"]) for o in objs]
        srt_entry = entry_for_line(entries, line_no) if entries else None
        timing[line_no] = resolve_line_timing(
            line_no, chunk_texts, marker_times, srt_entry, distribute
        )
    return timing, warnings


# ---------------------------------------------------------------------------
# Manifest gathering (§1)
# ---------------------------------------------------------------------------

def _pixel_resolution(scene):
    pct = scene.render.resolution_percentage / 100.0
    return (
        max(1, round(scene.render.resolution_x * pct)),
        max(1, round(scene.render.resolution_y * pct)),
    )


def chunk_bbox_px(scene, camera, obj):
    """Pixel bbox [x_min, y_min, x_max, y_max], origin bottom-left,
    from the object's bound_box corners projected into camera view."""
    res_x, res_y = _pixel_resolution(scene)
    xs, ys = [], []
    for corner in obj.bound_box:
        world = obj.matrix_world @ Vector(corner)
        co = world_to_camera_view(scene, camera, world)
        xs.append(co.x * res_x)
        ys.append(co.y * res_y)
    return [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]


def chunk_manifest_entry(context, obj, filename, chunk_time):
    scene = context.scene
    props = scene.lyric_chunker
    camera = active_camera(context)
    template = props.template_object

    world_pos = obj.matrix_world.translation
    screen = world_to_camera_view(scene, camera, world_pos)

    manual_offset = 0.0
    if template is not None and "lc_local_x" in obj:
        local = template.matrix_world.inverted() @ obj.location
        manual_offset = local.x - float(obj["lc_local_x"])

    seconds, source = chunk_time
    fps = scene.render.fps
    fps_base = scene.render.fps_base
    return build_chunk_entry(
        index=int(obj["lc_chunk"]),
        name=obj.name,
        text=str(obj["lc_text"]),
        filename=filename,
        world_position=tuple(world_pos),
        screen_position=(screen.x, screen.y),
        bbox_px=chunk_bbox_px(scene, camera, obj),
        offset_x=float(obj.get("lc_offset_x", 0.0)),
        manual_offset_x=manual_offset,
        start_seconds=seconds,
        start_frame=seconds_to_frame(seconds, fps, fps_base),
        timing_source=source,
    )


def gather_line_manifest(context, line_no, coll, objs, completed, timing_entry,
                         verification=None):
    """Build the manifest document for one line. ``completed`` is the set
    of chunk indices whose PNGs exist — on cancel or error this writes a
    partial manifest with the chunks that did complete (§3.1)."""
    scene = context.scene
    props = scene.lyric_chunker
    camera = active_camera(context)
    chunk_times, line_span, line_source = timing_entry

    render = scene.render
    render_block = {
        "engine": render.engine,
        "resolution_x": render.resolution_x,
        "resolution_y": render.resolution_y,
        "resolution_percentage": render.resolution_percentage,
        "fps": render.fps,
        "fps_base": round(render.fps_base, 6),
        "film_transparent": render.film_transparent,
        "color_depth": render.image_settings.color_depth,
        "file_format": render.image_settings.file_format,
    }
    project_block = {
        "blend_file": os.path.basename(bpy.data.filepath) or "",
        "scene": scene.name,
        "camera": camera.name if camera else "",
        "style_preset": props.active_preset,
        "template_object": props.template_object.name if props.template_object else "",
    }
    start_s, end_s = line_span
    line_block = {
        "index": line_no,
        "text_raw": str(coll.get("lc_text_raw", "")),
        "delimiter": str(coll.get("lc_delimiter", props.delimiter)),
        "output_dir": coll.name,
        "start_seconds": None if start_s is None else round(start_s, 4),
        "end_seconds": None if end_s is None else round(end_s, 4),
        "timing_source": line_source,
    }
    chunks = []
    for obj, chunk_time in zip(objs, chunk_times):
        index = int(obj["lc_chunk"])
        if index not in completed:
            continue
        chunks.append(
            chunk_manifest_entry(context, obj, f"{obj.name}.png", chunk_time)
        )
    generator = {
        "addon": ADDON_ID,
        "addon_version": ADDON_VERSION,
        "blender_version": bpy.app.version_string.split()[0],
    }
    return build_manifest(
        generator,
        project_block,
        render_block,
        line_block,
        chunks,
        verification=verification,
        rendered_at=now_utc_iso(),
    )


# ---------------------------------------------------------------------------
# Modal render queue (§3.1)
# ---------------------------------------------------------------------------

class LC_OT_render_queue(Operator):
    bl_idname = "lyric_chunker.render_queue"
    bl_label = "Render Chunks"
    bl_description = (
        "Render each chunk in isolation as a transparent 16-bit PNG and "
        "write a JSON manifest per line, via a cancellable modal queue"
    )
    bl_options = {'REGISTER'}

    all_lines: bpy.props.BoolProperty(default=False, options={'HIDDEN'})

    _timer = None

    def fail(self, context, message):
        set_status(context, message, error=True)
        self.report({'ERROR'}, message)
        return {'CANCELLED'}

    def execute(self, context):
        return self.invoke(context, None)

    def invoke(self, context, event):
        scene = context.scene
        props = scene.lyric_chunker
        if props.is_rendering:
            return self.fail(context, "A render batch is already running")
        if not props.output_root:
            return self.fail(context, "Set an output root folder first")
        if active_camera(context) is None:
            return self.fail(
                context, "No camera — pick one or run Set Up Scene"
            )

        self.out_root = bpy.path.abspath(props.output_root)
        lines = collect_line_chunks(scene)
        if not lines:
            return self.fail(context, "No Line# collections with chunks found")
        if self.all_lines:
            targets = sorted(lines)
        else:
            target = get_target_line(context)
            if target not in lines:
                return self.fail(context, f"No chunks found for Line {target}")
            targets = [target]

        try:
            self.timing, timing_warnings = compute_timing(context, lines, targets)
        except SrtParseError as exc:
            return self.fail(context, f"SRT import failed: {exc}")
        for w in timing_warnings:
            self.report({'WARNING'}, w)

        self.jobs = []
        for line_no in targets:
            coll, objs = lines[line_no]
            folder = os.path.join(self.out_root, coll.name)
            try:
                os.makedirs(folder, exist_ok=True)
            except OSError as exc:
                return self.fail(context, f"Output path not writable: {exc}")
            for obj in objs:
                self.jobs.append({
                    "line_no": line_no,
                    "coll": coll,
                    "obj": obj,
                    "chunk": int(obj["lc_chunk"]),
                    "filepath": os.path.join(folder, f"{obj.name}.png"),
                })

        self.lines = lines
        self.targets = targets
        self.job_index = 0
        self.completed = {line_no: set() for line_no in targets}
        self.written = set()
        self.notes = assert_render_settings(scene)
        self.guard = RenderSettingsGuard(scene)
        self.visibility = ChunkVisibilityGuard(
            context, lines, targets, props.template_object
        )
        props.is_rendering = True
        props.render_cancel = False
        props.progress = f"Starting — 0/{len(self.jobs)}"

        wm = context.window_manager
        wm.progress_begin(0, len(self.jobs))
        self._timer = wm.event_timer_add(0.05, window=context.window)
        wm.modal_handler_add(self)
        return {'RUNNING_MODAL'}

    def modal(self, context, event):
        props = context.scene.lyric_chunker
        if event.type == 'ESC':
            props.render_cancel = True
        if event.type != 'TIMER':
            return {'PASS_THROUGH'}

        if props.render_cancel:
            self.finish(context, f"Cancelled after {self.job_index}/{len(self.jobs)} chunks")
            return {'CANCELLED'}

        if self.job_index >= len(self.jobs):
            self.finish(
                context,
                f"Rendered {len(self.jobs)} chunks across "
                f"{len(self.targets)} line(s) to {self.out_root}",
            )
            return {'FINISHED'}

        job = self.jobs[self.job_index]
        line_objs = self.lines[job["line_no"]][1]
        props.progress = (
            f"Rendering Line {job['line_no']}, chunk {job['chunk']} of "
            f"{len(line_objs)} — {self.job_index + 1}/{len(self.jobs)}"
        )
        try:
            render_single_chunk(
                context.scene, job["obj"], job["filepath"],
                self.visibility.all_chunks,
            )
        except Exception as exc:
            self.finish(
                context,
                f"Render failed at Line {job['line_no']} chunk "
                f"{job['chunk']}: {exc}",
                error=True,
            )
            return {'CANCELLED'}

        self.completed[job["line_no"]].add(job["chunk"])
        self.job_index += 1
        context.window_manager.progress_update(self.job_index)
        if len(self.completed[job["line_no"]]) == len(line_objs):
            self.write_line_manifest(context, job["line_no"])
        for area in context.screen.areas:
            if area.type == 'VIEW_3D':
                area.tag_redraw()
        return {'RUNNING_MODAL'}

    def write_line_manifest(self, context, line_no):
        coll, objs = self.lines[line_no]
        doc = gather_line_manifest(
            context, line_no, coll, objs,
            self.completed[line_no], self.timing[line_no],
        )
        path = os.path.join(
            self.out_root, coll.name,
            manifest_filename(line_no, context.scene.lyric_chunker.zero_pad),
        )
        write_manifest(path, doc)
        self.written.add(line_no)

    def finish(self, context, message, error=False):
        # Partial manifests for lines that completed some chunks (§3.1).
        for line_no in self.targets:
            if line_no not in self.written and self.completed[line_no]:
                try:
                    self.write_line_manifest(context, line_no)
                except OSError:
                    pass
        props = context.scene.lyric_chunker
        self.visibility.restore()
        self.guard.restore()
        wm = context.window_manager
        if self._timer is not None:
            wm.event_timer_remove(self._timer)
            self._timer = None
        wm.progress_end()
        props.is_rendering = False
        props.render_cancel = False
        props.progress = ""
        if self.notes:
            message += f" ({'; '.join(self.notes)})"
        set_status(context, message, error=error)
        if error:
            self.report({'ERROR'}, message)


class LC_OT_cancel_render(Operator):
    bl_idname = "lyric_chunker.cancel_render"
    bl_label = "Cancel"
    bl_description = "Stop the batch cleanly after the in-flight render"

    def execute(self, context):
        context.scene.lyric_chunker.render_cancel = True
        return {'FINISHED'}


# ---------------------------------------------------------------------------
# Single-chunk re-render (§5.1)
# ---------------------------------------------------------------------------

class LC_OT_rerender_chunk(Operator):
    bl_idname = "lyric_chunker.rerender_chunk"
    bl_label = "Re-render Chunk"
    bl_description = (
        "Re-render one chunk without regenerating the line: overwrites its "
        "PNG and updates its manifest entry (select a chunk object first)"
    )

    def fail(self, context, message):
        set_status(context, message, error=True)
        self.report({'ERROR'}, message)
        return {'CANCELLED'}

    def execute(self, context):
        scene = context.scene
        props = scene.lyric_chunker
        obj = context.active_object
        if obj is None or "lc_chunk" not in obj:
            return self.fail(
                context, "Select a generated chunk object to re-render"
            )
        if not props.output_root:
            return self.fail(context, "Set an output root folder first")
        if active_camera(context) is None:
            return self.fail(context, "No camera")

        line_no = int(obj["lc_line"])
        chunk_no = int(obj["lc_chunk"])
        # The chunk is live editable text (§2.2): a typo fix is an edit to
        # the body, so pick up the current string before rendering.
        obj["lc_text"] = obj.data.body
        coll = find_line_collection(scene, line_no)
        if coll is None:
            return self.fail(context, f"Line {line_no} collection not found")
        out_root = bpy.path.abspath(props.output_root)
        manifest_path = os.path.join(
            out_root, coll.name, manifest_filename(line_no, props.zero_pad)
        )
        if not os.path.exists(manifest_path):
            return self.fail(
                context,
                f"No manifest at {manifest_path} — render the line once first",
            )
        try:
            doc = read_manifest(manifest_path)
        except (ValueError, OSError) as exc:
            return self.fail(context, f"Cannot read manifest: {exc}")

        entry_index = next(
            (i for i, c in enumerate(doc["chunks"]) if c["index"] == chunk_no),
            None,
        )

        lines = collect_line_chunks(scene)
        notes = assert_render_settings(scene)
        guard = RenderSettingsGuard(scene)
        visibility = ChunkVisibilityGuard(
            context, lines, [line_no], props.template_object
        )
        filepath = os.path.join(out_root, coll.name, f"{obj.name}.png")
        try:
            render_single_chunk(scene, obj, filepath, visibility.all_chunks)
        except Exception as exc:
            return self.fail(context, f"Re-render failed: {exc}")
        finally:
            visibility.restore()
            guard.restore()

        # Keep the stored timing; refresh geometry-derived fields.
        if entry_index is not None:
            old = doc["chunks"][entry_index]
            chunk_time = (old.get("start_seconds"), old.get("timing_source", "none"))
        else:
            chunk_time = (None, "none")
        new_entry = chunk_manifest_entry(context, obj, f"{obj.name}.png", chunk_time)
        if entry_index is not None:
            doc["chunks"][entry_index] = new_entry
        else:
            doc["chunks"].append(new_entry)
            doc["chunks"].sort(key=lambda c: c["index"])
        doc["rendered_at"] = now_utc_iso()
        write_manifest(manifest_path, doc)

        message = f"Re-rendered {obj.name}"
        if notes:
            message += f" ({'; '.join(notes)})"
        set_status(context, message)
        return {'FINISHED'}


# ---------------------------------------------------------------------------
# Fusion comp generation (§6) — same generator as scripts/generate_comp.py,
# run against the output root without leaving Blender.
# ---------------------------------------------------------------------------

class LC_OT_generate_comps(Operator):
    bl_idname = "lyric_chunker.generate_comps"
    bl_label = "Generate Fusion Comps"
    bl_description = (
        "Write a pasteable Fusion node graph (Line#.setting) next to every "
        "rendered line manifest in the output root — open one in a text "
        "editor, copy all, and paste into Resolve's Fusion node area"
    )

    def fail(self, context, message):
        set_status(context, message, error=True)
        self.report({'ERROR'}, message)
        return {'CANCELLED'}

    def execute(self, context):
        props = context.scene.lyric_chunker
        if not props.output_root:
            return self.fail(context, "Set an output root folder first")
        out_root = bpy.path.abspath(props.output_root)
        manifests = sorted(glob.glob(os.path.join(out_root, "Line*", "Line*.json")))
        if not manifests:
            return self.fail(
                context,
                f"No Line#.json manifests under {out_root} — render lines first",
            )

        written = 0
        warned = []
        for path in manifests:
            try:
                doc = read_manifest(path)
            except (ValueError, OSError) as exc:
                warned.append(f"{os.path.basename(path)}: {exc}")
                continue
            folder = os.path.dirname(path)
            text, warnings = generate_line_setting(doc, folder)
            warned.extend(warnings)
            setting_path = os.path.splitext(path)[0] + ".setting"
            try:
                with open(setting_path, "w", encoding="utf-8") as fh:
                    fh.write(text)
            except OSError as exc:
                return self.fail(context, f"Cannot write {setting_path}: {exc}")
            written += 1

        message = (
            f"Wrote {written} .setting file(s) — open in a text editor, copy "
            "all, paste into Fusion, wire the last Merge to MediaOut"
        )
        if warned:
            message += f" — {len(warned)} warning(s), see console"
            for w in warned:
                self.report({'WARNING'}, w)
        set_status(context, message, error=written == 0)
        return {'FINISHED'}


# ---------------------------------------------------------------------------
# Contact sheet (§5.4)
# ---------------------------------------------------------------------------

CONTACT_SHEET_IMAGE = "LC_ContactSheet"
CONTACT_SHEET_WIDTH = 480


def load_pixels(path):
    """Load an image file as a float32 (h, w, 4) array, bottom-up rows."""
    import numpy as np

    img = bpy.data.images.load(path)
    try:
        w, h = img.size
        pixels = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    finally:
        bpy.data.images.remove(img)
    return pixels


def alpha_over(base, top):
    """Straight-alpha over-composite: top over base, in place on base."""
    import numpy as np

    top_a = top[..., 3:4]
    base_a = base[..., 3:4]
    out_a = top_a + base_a * (1.0 - top_a)
    prem = top[..., :3] * top_a + base[..., :3] * base_a * (1.0 - top_a)
    base[..., :3] = prem / np.maximum(out_a, 1e-6)
    base[..., 3:4] = out_a
    return base


class LC_OT_contact_sheet(Operator):
    bl_idname = "lyric_chunker.contact_sheet"
    bl_label = "Contact Sheet"
    bl_description = (
        "Low-resolution pass over all chunks, composited into one preview "
        "image — catches bad splits and kerning drift before a full batch"
    )

    def fail(self, context, message):
        set_status(context, message, error=True)
        self.report({'ERROR'}, message)
        return {'CANCELLED'}

    def execute(self, context):
        import numpy as np

        scene = context.scene
        props = scene.lyric_chunker
        if props.is_rendering:
            return self.fail(context, "A render batch is already running")
        if active_camera(context) is None:
            return self.fail(context, "No camera")
        lines = collect_line_chunks(scene)
        if not lines:
            return self.fail(context, "No Line# collections with chunks found")

        targets = sorted(lines)
        tmp_dir = os.path.join(bpy.app.tempdir, "lc_contact_sheet")
        os.makedirs(tmp_dir, exist_ok=True)

        assert_render_settings(scene)
        guard = RenderSettingsGuard(scene)
        visibility = ChunkVisibilityGuard(
            context, lines, targets, props.template_object
        )
        wm = context.window_manager
        total = sum(len(lines[t][1]) for t in targets)
        done = 0
        wm.progress_begin(0, total)
        row_images = []
        try:
            scene.render.resolution_percentage = max(
                2, round(CONTACT_SHEET_WIDTH / max(1, scene.render.resolution_x) * 100)
            )
            for line_no in targets:
                _, objs = lines[line_no]
                row = None
                for obj in objs:
                    path = os.path.join(tmp_dir, f"{obj.name}.png")
                    render_single_chunk(scene, obj, path, visibility.all_chunks)
                    pixels = load_pixels(path)
                    row = pixels if row is None else alpha_over(row, pixels)
                    done += 1
                    wm.progress_update(done)
                row_images.append(row)
        except Exception as exc:
            return self.fail(context, f"Contact sheet failed after {done}/{total}: {exc}")
        finally:
            visibility.restore()
            guard.restore()
            wm.progress_end()

        h, w = row_images[0].shape[:2]
        sheet = np.zeros((h * len(row_images), w, 4), dtype=np.float32)
        # Line 1 at the top; pixel rows are bottom-up.
        for i, row in enumerate(row_images):
            offset = (len(row_images) - 1 - i) * h
            sheet[offset:offset + h] = row

        existing = bpy.data.images.get(CONTACT_SHEET_IMAGE)
        if existing is not None:
            bpy.data.images.remove(existing)
        img = bpy.data.images.new(
            CONTACT_SHEET_IMAGE, width=w, height=h * len(row_images), alpha=True
        )
        img.pixels[:] = sheet.ravel()
        if props.output_root:
            out = os.path.join(bpy.path.abspath(props.output_root), "contact_sheet.png")
            img.filepath_raw = out
            img.file_format = 'PNG'
            try:
                img.save()
            except (OSError, RuntimeError) as exc:
                self.report({'WARNING'}, f"Could not save contact sheet: {exc}")

        set_status(
            context,
            f"Contact sheet ready: open '{CONTACT_SHEET_IMAGE}' in the Image Editor "
            f"({len(targets)} lines, {total} chunks)",
        )
        return {'FINISHED'}


# ===== ops_verify.py ==============================================

"""Verify Line (spec addendum §2.5).

Renders the full line as a single Text object, composites the already-
rendered chunk PNGs, and diffs the two. Reports the max per-pixel delta
(0-255 scale) against the preferences threshold and writes the result
into the line's manifest ``verification`` block. This is the difference
between "kerning is probably fine" and "kerning is fine for this font."
"""

import os

import bpy
from bpy.types import Operator


VERIFY_TEMP_NAME = "LC_verify_temp"


def build_full_line_object(context, coll, props):
    """Temporary single Text object holding the whole line, styled and
    placed exactly as the template — the reference the chunks must match."""
    raw = str(coll.get("lc_text_raw", ""))
    delimiter = str(coll.get("lc_delimiter", props.delimiter))
    words, _ = split_line(raw, delimiter)
    body = full_text(words)

    template = props.template_object
    curve = bpy.data.curves.new(VERIFY_TEMP_NAME, type='FONT')
    curve.body = body
    if template is not None and template.type == 'FONT':
        copy_font_metrics(template.data, curve)
        curve.align_x = template.data.align_x
        curve.align_y = template.data.align_y
        mats = [s.material for s in template.material_slots if s.material]
        for mat in mats or [default_material()]:
            curve.materials.append(mat)
    else:
        apply_house_style(curve)
        font = load_house_font()
        if font is not None:
            curve.font = font
        curve.materials.append(default_material())

    obj = bpy.data.objects.new(VERIFY_TEMP_NAME, curve)
    if template is not None:
        obj.location = template.location.copy()
        obj.rotation_euler = template.rotation_euler.copy()
        obj.scale = template.scale.copy()
    else:
        obj.location = context.scene.cursor.location.copy()
    context.scene.collection.objects.link(obj)
    return obj


class LC_OT_verify_line(Operator):
    bl_idname = "lyric_chunker.verify_line"
    bl_label = "Verify Line"
    bl_description = (
        "Render the full line as one text object, composite the rendered "
        "chunk PNGs, and diff — catches kerning drift for this exact font"
    )

    def fail(self, context, message):
        set_status(context, message, error=True)
        self.report({'ERROR'}, message)
        return {'CANCELLED'}

    def execute(self, context):
        import numpy as np

        scene = context.scene
        props = scene.lyric_chunker
        if props.is_rendering:
            return self.fail(context, "A render batch is already running")
        if not props.output_root:
            return self.fail(context, "Set an output root folder first")
        if active_camera(context) is None:
            return self.fail(context, "No camera")

        lines = collect_line_chunks(scene)
        line_no = get_target_line(context)
        if line_no not in lines:
            return self.fail(context, f"No chunks found for Line {line_no}")
        coll, objs = lines[line_no]

        out_root = bpy.path.abspath(props.output_root)
        chunk_paths = [
            os.path.join(out_root, coll.name, f"{obj.name}.png") for obj in objs
        ]
        missing = [p for p in chunk_paths if not os.path.exists(p)]
        if missing:
            return self.fail(
                context,
                f"Render Line {line_no} first — {len(missing)} chunk PNG(s) missing",
            )

        assert_render_settings(scene)
        guard = RenderSettingsGuard(scene)
        visibility = ChunkVisibilityGuard(
            context, lines, [line_no], props.template_object
        )
        reference_path = os.path.join(bpy.app.tempdir, f"lc_verify_line{line_no}.png")
        full_obj = build_full_line_object(context, coll, props)
        try:
            for obj in visibility.all_chunks:
                obj.hide_render = True
            scene.render.filepath = reference_path
            bpy.ops.render.render(write_still=True)
        except Exception as exc:
            return self.fail(context, f"Verify render failed: {exc}")
        finally:
            data = full_obj.data
            bpy.data.objects.remove(full_obj, do_unlink=True)
            bpy.data.curves.remove(data)
            visibility.restore()
            guard.restore()

        reference = load_pixels(reference_path)
        composite = None
        for path in chunk_paths:
            pixels = load_pixels(path)
            composite = pixels if composite is None else alpha_over(composite, pixels)
        if composite.shape != reference.shape:
            return self.fail(
                context,
                "Chunk PNGs and the current render resolution differ — "
                "re-render the line before verifying",
            )

        # Compare premultiplied so fully transparent pixels with junk RGB
        # cannot fail the diff.
        ref_p = reference[..., :3] * reference[..., 3:4]
        com_p = composite[..., :3] * composite[..., 3:4]
        delta_rgb = np.abs(ref_p - com_p).max()
        delta_a = np.abs(reference[..., 3] - composite[..., 3]).max()
        max_delta = int(round(float(max(delta_rgb, delta_a)) * 255.0))

        threshold = verify_threshold(context)
        passed = max_delta <= threshold
        verification = {
            "run": True,
            "max_pixel_delta": max_delta,
            "passed": passed,
        }

        manifest_path = os.path.join(
            out_root, coll.name, manifest_filename(line_no, props.zero_pad)
        )
        if os.path.exists(manifest_path):
            try:
                doc = read_manifest(manifest_path)
                doc["verification"] = verification
                doc["rendered_at"] = doc.get("rendered_at") or now_utc_iso()
                write_manifest(manifest_path, doc)
            except (ValueError, OSError) as exc:
                self.report({'WARNING'}, f"Could not update manifest: {exc}")

        verdict = "PASS" if passed else "FAIL"
        message = (
            f"Verify Line {line_no}: {verdict} — max pixel delta {max_delta} "
            f"(threshold {threshold})"
        )
        set_status(context, message, error=not passed)
        if not passed:
            self.report({'WARNING'}, message)
        return {'FINISHED'}


# ===== ui.py ======================================================

"""Panel (3D Viewport sidebar > Lyric Chunker)."""

import textwrap

from bpy.types import Panel, UIList



class LC_UL_lyric_lines(UIList):
    def draw_item(self, context, layout, data, item, icon, active_data,
                  active_prop, index):
        # Number-only label keeps most of the row width for the text;
        # the full selected line is drawn wrapped under the list.
        split = layout.split(factor=0.15)
        split.label(text=str(data.start_index + index))
        split.prop(item, "text", text="", emboss=False)


class LC_PT_panel(Panel):
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Lyric Chunker"
    bl_label = "Lyric Chunker"

    def draw(self, context):
        layout = self.layout
        props = context.scene.lyric_chunker

        box = layout.box()
        box.label(text="Scene", icon='SCENE_DATA')
        box.operator(LC_OT_setup_scene.bl_idname, icon='ADD')
        box.prop(props, "template_object")
        if props.template_object is None:
            box.label(text="No template — defaults will be used", icon='ERROR')
        box.prop(props, "camera_object")

        box = layout.box()
        box.label(text="Lyrics", icon='OUTLINER_OB_FONT')
        row = box.row(align=True)
        row.prop(props, "line_text", text="", placeholder="Type a lyric line…")
        row.operator(LC_OT_add_line.bl_idname, text="", icon='ADD')
        has_list = len(props.lyric_lines) > 0
        if has_list:
            row = box.row()
            row.template_list(
                "LC_UL_lyric_lines", "", props, "lyric_lines",
                props, "lyric_line_index", rows=4,
            )
            col = row.column(align=True)
            col.operator(LC_OT_remove_line.bl_idname, text="", icon='REMOVE')
            index = props.lyric_line_index
            if 0 <= index < len(props.lyric_lines):
                full = props.lyric_lines[index].text
                view = box.column(align=True)
                view.scale_y = 0.85
                wrapped = textwrap.wrap(
                    f"Line {props.start_index + index}:  {full}", width=42
                ) or [""]
                for text_row in wrapped[:6]:
                    view.label(text=text_row)
        row = box.row(align=True)
        row.prop(props, "start_index")
        if not has_list:
            row.prop(props, "line_number")
        row = box.row(align=True)
        row.prop(props, "delimiter")
        box.prop(props, "force_uppercase")
        col = box.column(align=True)
        col.scale_y = 1.3
        multi = has_list or props.lyrics_text is not None
        op = col.operator(
            LC_OT_generate_chunks.bl_idname,
            text=f"Generate Line {props.line_number}" if multi
            else "Generate Chunks",
            icon='MOD_BUILD',
        )
        op.all_lines = False
        if multi:
            op = col.operator(
                LC_OT_generate_chunks.bl_idname,
                text="Generate All Lines",
                icon='MOD_BUILD',
            )
            op.all_lines = True
        row = box.row(align=True)
        row.prop(props, "lyrics_text", text="")
        row.operator(LC_OT_new_lyrics_text.bl_idname, text="", icon='ADD')
        row.operator(LC_OT_import_lines.bl_idname, text="", icon='IMPORT')

        box = layout.box()
        box.label(text="Timing", icon='TIME')
        box.prop(props, "srt_path", text="SRT")
        box.prop(props, "use_markers")

        box = layout.box()
        box.label(text="Style Presets", icon='PRESET')
        row = box.row()
        row.template_list(
            "LC_UL_style_presets", "", props, "style_presets",
            props, "style_preset_index", rows=2,
        )
        col = row.column(align=True)
        col.operator(LC_OT_preset_save.bl_idname, text="", icon='ADD')
        col.operator(LC_OT_preset_remove.bl_idname, text="", icon='REMOVE')
        col.operator(LC_OT_preset_apply.bl_idname, text="", icon='CHECKMARK')

        box = layout.box()
        box.label(text="Output", icon='OUTPUT')
        box.prop(props, "output_root", text="")
        box.prop(props, "zero_pad")
        if props.is_rendering:
            box.label(text=props.progress or "Rendering…", icon='RENDER_STILL')
            row = box.row()
            row.scale_y = 1.3
            row.operator(LC_OT_cancel_render.bl_idname, icon='CANCEL')
        else:
            target = get_target_line(context)
            col = box.column(align=True)
            col.scale_y = 1.3
            op = col.operator(
                LC_OT_render_queue.bl_idname,
                text=f"Render Line {target}",
                icon='RENDER_STILL',
            )
            op.all_lines = False
            op = col.operator(
                LC_OT_render_queue.bl_idname,
                text="Render All Lines",
                icon='RENDERLAYERS',
            )
            op.all_lines = True
            row = box.row(align=True)
            row.operator(LC_OT_rerender_chunk.bl_idname, icon='FILE_REFRESH')
            row = box.row(align=True)
            row.operator(LC_OT_verify_line.bl_idname, icon='CHECKMARK')
            row.operator(LC_OT_contact_sheet.bl_idname, icon='IMAGE_DATA')
            row = box.row()
            row.scale_y = 1.3
            row.operator(LC_OT_generate_comps.bl_idname, icon='NODETREE')

        box = layout.box()
        icon = 'ERROR' if props.status_error else 'INFO'
        box.label(text="Status", icon=icon)
        for row_text in status_lines(props):
            box.label(text=row_text)


# ===== registration ====================================================

"""Lyric Chunker — registration only. All behavior lives in the modules."""

import bpy
from bpy.props import PointerProperty


classes = (
    LCLyricLine,
    LCStylePreset,
    LyricChunkerProps,
    LyricChunkerPreferences,
    LC_UL_lyric_lines,
    LC_OT_setup_scene,
    LC_OT_generate_chunks,
    LC_OT_add_line,
    LC_OT_remove_line,
    LC_OT_import_lines,
    LC_OT_new_lyrics_text,
    LC_OT_render_queue,
    LC_OT_cancel_render,
    LC_OT_rerender_chunk,
    LC_OT_generate_comps,
    LC_OT_verify_line,
    LC_OT_contact_sheet,
    LC_OT_preset_save,
    LC_OT_preset_apply,
    LC_OT_preset_remove,
    LC_UL_style_presets,
    LC_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.lyric_chunker = PointerProperty(type=LyricChunkerProps)


def unregister():
    # Guard against double-registration on reload — still the most common
    # dev-loop error.
    if hasattr(bpy.types.Scene, "lyric_chunker"):
        del bpy.types.Scene.lyric_chunker
    for cls in reversed(classes):
        try:
            bpy.utils.unregister_class(cls)
        except RuntimeError:
            pass


if __name__ == "__main__":
    # Re-run friendly for the Text Editor dev loop.
    try:
        unregister()
    except Exception:
        pass
    register()
