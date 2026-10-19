import { readFileSync } from 'node:fs';

export interface Country { iso2: string; iso3: string; region: string; subregion: string }

// Minimal CSV line split: handles double-quoted fields containing commas.
// shortcut: no escaped quotes inside fields (none in the M49 file), swap for a CSV lib if the data changes.
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const byIso2 = new Map<string, Country>();
const iso3Map = new Map<string, string>();
const lines = readFileSync(new URL('./m49.csv', import.meta.url), 'utf8').split(/\r?\n/);
for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const f = splitLine(line);
  const c: Country = { iso2: f[1]!, iso3: f[2]!, region: f[5]!, subregion: f[6]! };
  byIso2.set(c.iso2, c);
  iso3Map.set(c.iso3, c.iso2);
}

export const lookupCountry = (iso2: string): Country | undefined => byIso2.get(iso2);
export const iso3ToIso2 = (iso3: string): string | undefined => iso3Map.get(iso3);
