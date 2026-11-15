#!/usr/bin/env python3
"""
Astraxis data pipeline: NASA PSI-69 (FLEX) + PSI-25 (BASS-II) -> normalized JSON.

Rules:
  * Never invent or correct a measurement. Unusable values become null; the raw
    text is always kept and every change is written to dist/cleaning_log.csv.
  * Units that are not confirmed by a NASA source are marked unit_verified=false.

Usage:  python3 build_dataset.py [raw_dir] [out_dir]
"""
import csv, json, re, sys
from collections import Counter, defaultdict
from datetime import datetime, date
from pathlib import Path

import openpyxl

RAW = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "raw")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).parent / "dist")
OUT.mkdir(parents=True, exist_ok=True)

FLEX_CSV = RAW / "PSI-69_Experimental table_FLEX.csv"
BASS_XLSX = RAW / "BASS-II Test Matrix by PI Final.xlsx"
BASS_CSV = RAW / "PSI-25_Experimental table_BASS-II.csv"   # cross-check only

PSI = "https://psi.nasa.gov/physci/repo/data/investigations/"
LOG = []  # cleaning log rows


def log(record_id, field, raw, action, code, note=""):
    LOG.append({"record_id": record_id, "field": field, "raw_value": raw,
                "action": action, "flag": code, "note": note})


# ---------------------------------------------------------------- investigations
INVESTIGATIONS = [
    {
        "id": "PSI-69", "acronym": "FLEX",
        "title": "Flame Extinguishment Experiment (FLEX)",
        "doi": "10.60555/mbq8-0451", "license": "CC0-1.0",
        "research_area": "Combustion Science", "sub_research_area": "Spacecraft Fire Safety",
        "platform": "International Space Station (ISS)",
        "hardware": ["Combustion Integrated Rack (CIR) - Fluids and Combustion Facility (FCF)",
                     "Multi-user Droplet Combustion Apparatus (MDCA)"],
        "nasa_center": "Glenn Research Center (GRC)",
        "investigation_start": "2007-08-01", "investigation_end": "2016-07-31",
        "fuel_phase": "liquid (droplet)",
        "evidence_type": "experimental_observation",
        "summary": ("Isolated fuel droplets (methanol, heptane) burned in microgravity across "
                    "oxygen concentrations, pressures and added diluents (N2, CO2, He) to map "
                    "flammability limits and measure suppressant effectiveness."),
        "source_url": PSI + "PSI-69",
        "source_files": ["PSI-69_Experimental table_FLEX.csv"],
        "known_limitations": [
            "Burning-rate unit is printed as 'mm' in the source header; the true unit "
            "(very likely mm^2/s, the burning-rate constant) is not yet confirmed from a NASA document.",
            "Definitions of the test-end categories (Extinction / Disruption / Completion) are not given "
            "in the downloaded files.",
            "Microgravity droplet results do not directly predict behaviour in lunar or Martian gravity.",
        ],
    },
    {
        "id": "PSI-25", "acronym": "BASS-II",
        "title": "Burning and Suppression of Solids - II (BASS-II)",
        "doi": "10.60555/4qc4-de67", "license": "CC0-1.0",
        "research_area": "Combustion Science", "sub_research_area": "Spacecraft Fire Safety",
        "platform": "International Space Station (ISS)",
        "hardware": ["Microgravity Science Glovebox (MSG)"],
        "nasa_center": "Glenn Research Center (GRC)",
        "investigation_start": "2010-01-01", "investigation_end": "2022-12-31",
        "fuel_phase": "solid",
        "evidence_type": "experimental_observation",
        "summary": ("Solid samples (PMMA films, slabs, rods and a sphere section; cotton-fiberglass "
                    "fabric; Nomex; a wax candle) burned in a small wind tunnel at low forced airflow "
                    "and reduced oxygen to study ignition, flame spread and extinction limits."),
        "source_url": PSI + "PSI-25",
        "source_files": ["BASS-II Test Matrix by PI Final.xlsx", "BASS-II data FAQ.docx",
                         "PSI-25_Experimental table_BASS-II.csv (cross-check)"],
        "related_report": {"title": "Burning and Suppression of Solids-II (BASS-II) Summary Report",
                           "id": "NASA/TM-20210011385", "date": "2021-10",
                           "note": "Per-test observations (ignition, spread, extinction) are in Appendix A; "
                                   "not yet extracted."},
        "known_limitations": [
            "The test table records conditions and gas-sensor readings, not flame-spread rates or outcomes.",
            "Airflow values are crew-logged duct sensor readings (cm/s) with ~1 min response time; "
            "many tests changed the flow during the burn.",
            "O2 values were corrected with a constant daily offset because the sensor was out of calibration.",
            "Microgravity results do not directly predict behaviour in lunar or Martian gravity.",
        ],
    },
]

# ---------------------------------------------------------------- field dictionary
FIELDS = {
    "o2_initial_pct":   {"label": "Initial O2", "unit": "%", "unit_verified": True,
                         "note": "FLEX: mole fraction x100. BASS-II: calibrated % by volume."},
    "o2_final_pct":     {"label": "Final O2", "unit": "% by vol", "unit_verified": True},
    "n2_initial_pct":   {"label": "Initial N2", "unit": "%", "unit_verified": True},
    "co2_initial_pct":  {"label": "Initial CO2", "unit": "%", "unit_verified": True},
    "co2_final_pct":    {"label": "Final CO2", "unit": "% by vol", "unit_verified": True},
    "he_initial_pct":   {"label": "Initial He", "unit": "%", "unit_verified": True},
    "pressure_mmhg":    {"label": "Ambient pressure", "unit": "mmHg", "unit_verified": True},
    "pressure_atm":     {"label": "Ambient pressure", "unit": "atm", "unit_verified": True,
                         "note": "Derived: mmHg / 760."},
    "droplet_initial_diameter_mm":    {"label": "Initial droplet diameter", "unit": "mm", "unit_verified": True},
    "flame_extinction_diameter_mm":   {"label": "Droplet diameter at visible flame extinction", "unit": "mm", "unit_verified": True},
    "burning_rate":     {"label": "Burning rate", "unit": "mm^2/s (unconfirmed)", "unit_verified": False,
                         "note": "Source header says 'mm'. Do not label charts with a unit until verified."},
    "burn_time_s":      {"label": "Burn time", "unit": "s", "unit_verified": True},
    "test_end":         {"label": "Test end", "unit": None,
                         "note": "FLEX categories: Extinction, Disruption, Completion. Definitions not yet verified."},
    "airflow_initial_cm_s":  {"label": "Initial airflow (duct sensor)", "unit": "cm/s", "unit_verified": True,
                              "note": "First value of the crew-logged 'Air display'. Sensor lag ~1 min."},
    "airflow_sequence_cm_s": {"label": "Airflow sequence during test", "unit": "cm/s", "unit_verified": True},
    "flow_restrictor":  {"label": "Flow restrictor plates", "unit": None,
                         "note": "0 = highest flow / least restriction, 2 = lowest flow."},
    "co_initial_ppm":   {"label": "Initial CO", "unit": "ppm", "unit_verified": True},
    "co_final_ppm":     {"label": "Final CO", "unit": "ppm", "unit_verified": True,
                         "note": "'OR' in source = over range (>1000 ppm); stored as null with co_final_over_range=true."},
}

NULL_TOKENS = {"", "none", "n/a", "na", "-"}


def num(record_id, field, raw):
    """Parse a numeric cell. Returns (value|None). Logs every non-trivial case."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    if s.lower() in NULL_TOKENS:
        return None
    if s == "–":  # en dash (Windows-1252 0x96) used in source as 'no value'
        log(record_id, field, "–", "set null", "dash_no_value", "Source marks value with a dash")
        return None
    if s.startswith("~"):
        try:
            v = float(s[1:])
            log(record_id, field, s, f"kept {v}", "approximate", "Source marks value as approximate")
            return v
        except ValueError:
            pass
    try:
        return float(s)
    except ValueError:
        log(record_id, field, s, "set null", "unparseable", "")
        return None


def parse_us_date(s):
    s = (s or "").strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------- FLEX
def build_flex():
    text = FLEX_CSV.read_bytes().decode("cp1252")
    rows = list(csv.reader(text.splitlines()))
    header, data = rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]
    assert len(header) == 15, header
    ident_counts = Counter(r[1].strip() for r in data)
    out = []
    for i, r in enumerate(data, start=2):  # source line number
        test_no = int(r[0])
        rid = f"PSI-69:{test_no:03d}"
        ident = r[1].strip()
        rec = {
            "record_id": rid, "investigation_id": "PSI-69", "acronym": "FLEX",
            "test_id": ident, "test_number": test_no, "pi": None,
            "date": parse_us_date(r[2]), "time_gmt": r[3].strip() or None,
            "fuel_or_material": r[4].strip(), "material_class": "liquid fuel droplet",
            "flow_configuration": "quiescent droplet (no imposed flow)",
        }
        if rec["date"] is None:
            log(rid, "date", r[2], "set null", "unparseable", "")
        p = num(rid, "pressure_mmhg", r[5])
        if p is not None and p <= 0:
            log(rid, "pressure_mmhg", r[5], "set null", "invalid_value", "Pressure of 0 mmHg is not physical")
            p = None
        rec["pressure_mmhg"] = p
        rec["pressure_atm"] = round(p / 760, 3) if p is not None else None

        fr = {k: num(rid, k, r[j]) for k, j in
              (("o2", 6), ("n2", 7), ("co2", 8), ("he", 9))}
        for k, v in fr.items():
            rec[f"{k}_initial_pct"] = round(v * 100, 2) if v is not None else None
        tot = sum(v for v in fr.values() if v is not None)
        if abs(tot - 1) > 0.02:
            log(rid, "gas_composition", f"sum={tot:.3f}", "kept", "composition_sum_off",
                "Mole fractions do not sum to 1 within 0.02")
        rec["diluent"] = ("He" if (fr["he"] or 0) > 0 else
                          "CO2" if (fr["co2"] or 0) > 0 else "N2")

        rec["droplet_initial_diameter_mm"] = num(rid, "droplet_initial_diameter_mm", r[10])
        dext = num(rid, "flame_extinction_diameter_mm", r[11])
        if dext == 0:
            log(rid, "flame_extinction_diameter_mm", "0", "set null", "zero_ambiguous",
                f"0 reported with test end '{r[14].strip()}'; meaning (no extinction vs. not measured) unverified")
            dext = None
        rec["flame_extinction_diameter_mm"] = dext
        rec["burning_rate"] = num(rid, "burning_rate", r[12])
        rec["burn_time_s"] = num(rid, "burn_time_s", r[13])
        rec["test_end"] = r[14].strip() or None

        if ident_counts[ident] > 1:
            log(rid, "test_id", ident, "kept", "duplicate_identifier",
                f"Identifier appears {ident_counts[ident]} times with different values")
        rec["raw"] = dict(zip(header, r))
        rec["source"] = {"file": FLEX_CSV.name, "line": i, "url": PSI + "PSI-69"}
        out.append(rec)
    return out


# ---------------------------------------------------------------- BASS-II
# Only what the BASS-II data FAQ states explicitly.
PI_INFO = {
    "Bhattacharjee": ("thin PMMA films of various thickness", None),
    "Ferkul": ("Nomex III and a wax candle", None),
    "Miller": ("thick PMMA slabs, one- and two-sided burns", None),
    "Olson": ("PMMA rods (mostly clear), upstream-end ignition",
              "concurrent flow (stagnation flame)"),
    "Fernandez-Pello": ("PMMA rods (mostly black), downstream-end ignition",
                        "opposed flow flame spread"),
    "T'ien": ("SIBAL fabric (75/25 cotton/fiberglass); one 4 cm PMMA sphere section", None),
}


def material_class(m):
    s = m.lower()
    if "sibal" in s:
        return "cotton-fiberglass fabric (SIBAL)"
    if "nomex" in s:
        return "Nomex fabric"
    if "candle" in s:
        return "wax candle"
    if "spherical" in s:
        return "PMMA sphere section"
    if "rod" in s:
        return "PMMA rod"
    if "micron" in s or "film" in s:
        return "PMMA thin film"
    if "mm" in s:
        return "PMMA slab"
    return "unclassified"


def thickness_mm(m):
    s = m.lower()
    mm = re.search(r"(\d+(?:\.\d+)?)\s*micron", s)
    if mm:
        return float(mm.group(1)) / 1000
    mm = re.search(r"(\d+(?:\.\d+)?)\s*mm", s)
    return float(mm.group(1)) if mm else None


def rod_diameter_in(m):
    mm = re.search(r'(\d+/\d+|0?\.\d+)\s*"?\s*(clear|black|blac)?\s*(pmma\s*)?rod', m.lower())
    if not mm:
        return None
    t = mm.group(1)
    if "/" in t:
        a, b = t.split("/")
        return round(int(a) / int(b), 4)
    return float(t)


AMBIGUOUS_AIRFLOW = {
    "PSI-25:O5b": "Entry '49, 5 cm/s': 49 is likely a fan-display value, not airflow; not parsed.",
    "PSI-25:O13a": "Values 49..40.5 look like fan-display readings with airflow in parentheses; not parsed.",
    "PSI-25:O13b": "Entry '7, 4? (49, ?)' mixes uncertain readings; not parsed.",
}


def parse_airflow(rid, raw):
    """'5, 2.5 (pot .9, .5)' -> initial 5.0, sequence [5, 2.5]. Pot settings in () ignored."""
    if raw is None:
        return None, [], []
    s = str(raw).strip()
    if not s:
        return None, [], []
    notes = []
    if rid in AMBIGUOUS_AIRFLOW:
        log(rid, "airflow", s, "initial=None, sequence=[]", "airflow_ambiguous", AMBIGUOUS_AIRFLOW[rid])
        return None, [], ["ambiguous_entry"]
    no_paren = re.sub(r"\([^)]*\)", " ", s)
    # Values after the word 'pot'/'pots' are control-box potentiometer settings, not cm/s.
    no_paren = re.sub(r"\d*\.?\d+\s*pots?\b", " ", no_paren, flags=re.I)        # '0.5 pot'
    no_paren = re.split(r"\bpots?\b", no_paren, maxsplit=1, flags=re.I)[0]     # 'pot 0.4, ...'
    seq = [float(x) for x in re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)", no_paren)]
    starts_numeric = re.match(r"^\s*\d", no_paren) is not None
    initial = seq[0] if (seq and starts_numeric) else None
    for kw, code in (("ext", "extinction_noted"), ("blowoff", "blowoff_noted"),
                     ("max", "max_flow_noted"), ("incr", "flow_increased"),
                     ("decr", "flow_decreased"), ("down", "flow_decreased"),
                     ("?", "uncertain_reading"), ("<", "below_reading"),
                     ("ign", "ignition_noted"), ("no ign", "no_ignition_noted"),
                     ("etc", "sequence_truncated"), ("see", "see_notes")):
        if kw in s.lower():
            notes.append(code)
    if not re.fullmatch(r"[\d.\s,]+", s):
        log(rid, "airflow", s, f"initial={initial}, sequence={seq}", "airflow_free_text",
            "Parsed numbers from crew free-text; parenthesised pot settings ignored")
    if initial is None:
        log(rid, "airflow_initial_cm_s", s, "set null", "no_leading_number", "")
    return initial, seq, sorted(set(notes))


def build_bass():
    wb = openpyxl.load_workbook(BASS_XLSX, data_only=True)
    out = []
    for ws in wb:
        pi = ws.title
        rows = [r for r in ws.iter_rows(values_only=True) if any(v is not None for v in r)]
        header = [str(h).strip() if h is not None else "" for h in rows[0]]
        for k, r in enumerate(rows[1:], start=2):
            test = str(r[2]).strip()
            rid = f"PSI-25:{test}"
            mat = str(r[4]).strip()
            d = r[0]
            rec = {
                "record_id": rid, "investigation_id": "PSI-25", "acronym": "BASS-II",
                "test_id": test, "test_number": None, "pi": pi,
                "date": d.date().isoformat() if isinstance(d, (datetime, date)) else None,
                "gmt_day_of_year": int(r[1]) if str(r[1]).isdigit() else None,
                "sample_id": str(r[3]).strip(),
                "fuel_or_material": mat, "material_class": material_class(mat),
                "thickness_mm": thickness_mm(mat), "rod_diameter_in": rod_diameter_in(mat),
                "pi_focus": PI_INFO.get(pi, (None, None))[0],
                "flow_configuration": PI_INFO.get(pi, (None, None))[1],
                "flow_restrictor": num(rid, "flow_restrictor", r[5]),
                "fan_display_raw": None if r[6] is None else str(r[6]).strip(),
            }
            ini, seq, notes = parse_airflow(rid, r[7])
            rec["airflow_raw"] = None if r[7] is None else str(r[7]).strip()
            rec["airflow_initial_cm_s"] = ini
            rec["airflow_sequence_cm_s"] = seq
            rec["airflow_notes"] = notes
            rec["airflow_changed_during_test"] = len(set(seq)) > 1
            rec["radiometer_gain_raw"] = None if r[8] is None else str(r[8]).strip()
            frames = r[9]
            rec["still_frames"] = int(frames) if isinstance(frames, (int, float)) else None
            rec["o2_initial_pct"] = num(rid, "o2_initial_pct", r[10])
            rec["o2_final_pct"] = num(rid, "o2_final_pct", r[11])
            rec["co2_initial_pct"] = num(rid, "co2_initial_pct", r[12])
            rec["co2_final_pct"] = num(rid, "co2_final_pct", r[13])
            for fld, j in (("co_initial_ppm", 14), ("co_final_ppm", 15)):
                v = r[j]
                sv = v.strip().lower() if isinstance(v, str) else ""
                over = sv in ("or", "over")
                rec[fld.replace("_ppm", "_over_range")] = over
                if over:
                    log(rid, fld, v, "set null, over_range=true", "over_range", "CO sensor over range (>1000 ppm)")
                    rec[fld] = None
                elif sv.startswith(">"):
                    log(rid, fld, v, "set null", "lower_bound_only", f"Source gives only a lower bound ({v} ppm)")
                    rec[fld] = None
                else:
                    rec[fld] = num(rid, fld, v)
                    if rec[fld] is not None and rec[fld] < 0:
                        log(rid, fld, v, "kept", "negative_sensor_reading", "Small negative CO reading (sensor offset)")
            o_i, o_f = rec["o2_initial_pct"], rec["o2_final_pct"]
            if o_i is not None and o_f is not None and o_f > o_i + 1:
                log(rid, "o2_final_pct", o_f, "kept, flagged", "implausible_value",
                    f"Final O2 {o_f}% exceeds initial {o_i}% in a closed combustion volume")
            if o_i is not None and o_f is not None and o_f < 5:
                log(rid, "o2_final_pct", o_f, "kept, flagged", "implausible_value",
                    f"Final O2 {o_f}% far below initial {o_i}%; likely recording error")
            # fields FLEX has, BASS-II does not
            rec["pressure_mmhg"] = None
            rec["pressure_atm"] = None
            rec["raw"] = {h: (v.isoformat() if isinstance(v, (datetime, date)) else v)
                          for h, v in zip(header, r)}
            rec["source"] = {"file": BASS_XLSX.name, "sheet": pi, "row": k, "url": PSI + "PSI-25"}
            out.append(rec)
    return out


def cross_check_bass(bass):
    """Confirm workbook and PSI CSV contain the same tests."""
    if not BASS_CSV.exists():
        return "PSI CSV not present; cross-check skipped."
    text = BASS_CSV.read_bytes().decode("cp1252")
    rows = [r for r in csv.reader(text.splitlines()) if any(c.strip() for c in r)][1:]
    csv_ids = Counter(r[1].strip() for r in rows)
    xl_ids = Counter(b["test_id"] for b in bass)
    only_csv = sorted((csv_ids - xl_ids).elements())
    only_xl = sorted((xl_ids - csv_ids).elements())
    return (f"BASS-II cross-check: workbook {sum(xl_ids.values())} rows, PSI CSV {len(rows)} rows; "
            f"only in CSV: {only_csv or 'none'}; only in workbook: {only_xl or 'none'}.")


def main():
    flex, bass = build_flex(), build_bass()
    xcheck = cross_check_bass(bass)
    for b in bass:
        if Counter(x["record_id"] for x in bass)[b["record_id"]] > 1:
            log(b["record_id"], "test_id", b["test_id"], "kept", "duplicate_identifier", "")
    tests = flex + bass
    flags_by_record = defaultdict(set)
    for e in LOG:
        flags_by_record[e["record_id"]].add(e["flag"])
    for t in tests:
        t["quality_flags"] = sorted(flags_by_record.get(t["record_id"], []))

    (OUT / "investigations.json").write_text(json.dumps(INVESTIGATIONS, indent=2))
    (OUT / "tests.json").write_text(json.dumps(tests, indent=1, ensure_ascii=False))
    (OUT / "field_dictionary.json").write_text(json.dumps(FIELDS, indent=2))
    (OUT / "cleaning_log.json").write_text(json.dumps(LOG, indent=1, ensure_ascii=False))
    with open(OUT / "cleaning_log.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["record_id", "field", "raw_value", "action", "flag", "note"])
        w.writeheader()
        w.writerows(LOG)

    c = Counter
    lines = [
        "# Astraxis dataset build summary", "",
        f"- FLEX (PSI-69) tests: {len(flex)}",
        f"  - fuel: {dict(c(t['fuel_or_material'] for t in flex))}",
        f"  - diluent: {dict(c(t['diluent'] for t in flex))}",
        f"  - test end: {dict(c(t['test_end'] for t in flex))}",
        f"- BASS-II (PSI-25) tests: {len(bass)}",
        f"  - by PI: {dict(c(t['pi'] for t in bass))}",
        f"  - material class: {dict(c(t['material_class'] for t in bass))}",
        f"  - with initial airflow parsed: {sum(t['airflow_initial_cm_s'] is not None for t in bass)}",
        f"- {xcheck}",
        f"- Cleaning log entries: {len(LOG)}; by flag: {dict(c(e['flag'] for e in LOG))}",
        f"- Records with any flag: {sum(bool(t['quality_flags']) for t in tests)} of {len(tests)}",
    ]
    (OUT / "BUILD_SUMMARY.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
