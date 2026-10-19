"""Cross-check lukes/ISO-3166-Countries-with-Regional-Codes against the UN M49 overview page.

Usage (from repo root):
  curl -s -A 'Mozilla/5.0' -o /tmp/m49.html https://unstats.un.org/unsd/methodology/m49/overview/
  python3 -I docs/evidence/m49-check/verify.py docs/evidence/m49-check/lukes-all-2026-10-19.csv /tmp/m49.html

The UN page's first table is Arabic, so compare by numeric region/sub-region codes, which are language-independent.
Result on 2026-10-19: compared 248, mismatches 0, only in lukes: ['TWN'].
"""
import csv, html, re, sys

rows = {r['alpha-3']: r for r in csv.DictReader(open(sys.argv[1], encoding='utf-8'))}
s = open(sys.argv[2], encoding='utf-8', errors='ignore').read()
un = {}
for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
    tds = [html.unescape(re.sub('<[^>]+>', '', t)).strip() for t in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
    if len(tds) >= 12 and re.fullmatch(r'[A-Z]{3}', tds[11]):
        un.setdefault(tds[11], tds)
mism = [(a3, u[2], u[4], rows[a3]['region-code'], rows[a3]['sub-region-code'])
        for a3, u in un.items() if a3 in rows and (u[2] != rows[a3]['region-code'] or u[4] != rows[a3]['sub-region-code'])]
print('compared', sum(1 for a in un if a in rows), 'mismatches', len(mism), mism[:10])
print('only in lukes:', [a for a in rows if a not in un])
