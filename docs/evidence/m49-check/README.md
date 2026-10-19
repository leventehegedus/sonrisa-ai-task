# Region dataset check (2026-10-19)

The scoring needs ISO2 → UN M49 sub-region and region data (design §8). The rule is: an authoritative dataset, never a table the AI types from memory.

| Candidate | Result |
|---|---|
| `world-countries@5.1.0` (npm) | **Rejected.** Not M49: HU and AT are "Central Europe", RO is "Southeast Europe". It would flip the approved "Orange flood in Romania → sent" example for a Hungarian user. |
| [`lukes/ISO-3166-Countries-with-Regional-Codes`](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes) `all/all.csv` | **Adopted.** Cross-checked against the UN M49 overview page by numeric codes: 248 compared, **0 mismatches**; TWN is extra (the UN page doesn't list it). |

Spot checks: HU, PL, RO, SK = Europe / Eastern Europe · AT = Western Europe · ES, RS = Southern Europe · NP = Asia / Southern Asia · US = Americas / Northern America · VU = Oceania / Melanesia.

Reproduce: see the docstring in [`verify.py`](verify.py).
