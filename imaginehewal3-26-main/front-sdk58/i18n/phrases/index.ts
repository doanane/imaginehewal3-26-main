/**
 * Every phrase the screens show, written by hand. Each row is [English, French, Arabic]. Add a file of rows for a new batch of screens and list it here.
 * Twi is a small preview that must be reviewed by a native speaker. Ewe, Hausa and Ga have no table yet, so they show English.
 * French and Arabic still need a native review before real-world use.
 */
import { tw } from './tw';
import { rowsAuth } from './auth';
import { rowsHome } from './home';
import { rowsHealth } from './health';
import { rowsCommunity } from './community';
import { rowsCare } from './care';
import { rowsMore } from './more';
import { rowsCaregiver } from './caregiver';
import { rowsServer } from './server';
import { rowsAlerts } from './alerts';
import { rowsAccount } from './account';

export type Row = [string, string, string];
export const ALL_ROWS: Row[] = [...rowsAuth, ...rowsHome, ...rowsHealth, ...rowsCommunity, ...rowsCare, ...rowsMore, ...rowsCaregiver, ...rowsServer, ...rowsAlerts, ...rowsAccount];

const build = (i: 1 | 2): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const r of ALL_ROWS) if (r[i]) out[r[0]] = r[i];
  return out;
};
export const PHRASES: Record<string, Record<string, string>> = { fr: build(1), ar: build(2), tw };
