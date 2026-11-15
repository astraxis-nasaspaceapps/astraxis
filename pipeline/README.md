# Astraxis data pipeline

Everything the dashboard shows is rebuilt from NASA's own files by these scripts. Run them from the `app` folder.

| Script | Input (NASA PSI, CC0-1.0) | Output |
|---|---|---|
| `build_dataset.py` | `raw/PSI-69_Experimental table_FLEX.csv` (DOI 10.60555/mbq8-0451), `raw/PSI-25_Experimental table_BASS-II.csv` and `raw/BASS-II Test Matrix by PI Final.xlsx` (DOI 10.60555/4qc4-de67) | cleaned tests, field dictionary, cleaning log (`dist/`, copied to `src/data/`) |
| `build_saffire.py` | `raw/saffire/` SAFFIRE I–III experimental tables (PSI-98 DOI 10.60555/0t15-1z43, PSI-99 DOI 10.60555/2chp-m469, PSI-100 DOI 10.60555/040q-4h36) | `src/data/saffire.json` |
| `model/fit.py` then `model/export.py` | `src/data/tests.json` (FLEX) | `src/data/model_flex.json`: the flame-out model, its cross-validation and calibration |

Rules: never invent or correct a NASA value. Unusable values are kept as written and flagged, and every decision is logged.

```
pip install openpyxl scikit-learn numpy
python pipeline/build_dataset.py
python pipeline/build_saffire.py
python pipeline/model/fit.py && python pipeline/model/export.py
```

The investigation ranking (`src/data/psi_catalog.json`) was compiled by hand from NASA's public PSI catalog entries for all 24 Combustion Science investigations (retrieved 2026-11-15); each mark carries the quoted catalog text it rests on.
