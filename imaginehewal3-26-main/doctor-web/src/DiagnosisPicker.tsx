import React, { useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Dx, DxRef, searchDiagnoses } from './api';

/** Diagnoses as chips. Search the common ICD-10 codes, or add any diagnosis in your own words. */
export default function DiagnosisPicker({ value, onChange, locked }: { value: Dx[]; onChange: (d: Dx[]) => void; locked: boolean }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<DxRef[]>([]);
  const t = useRef<number>();
  const has = (code: string | null, label: string) => value.some(d => (code && d.code === code) || d.label.toLowerCase() === label.toLowerCase());
  const type = (v: string) => {
    setQ(v);
    window.clearTimeout(t.current);
    if (v.trim().length < 2) { setRes([]); return; }
    t.current = window.setTimeout(() => { searchDiagnoses(v.trim()).then(r => setRes(r.results)).catch(() => setRes([])); }, 200);
  };
  const add = (d: Dx) => { if (!has(d.code, d.label) && value.length < 10) onChange([...value, d]); setQ(''); setRes([]); };

  return (
    <div>
      {value.length > 0 && (
        <ul className="dx-chips" aria-label="Diagnoses">
          {value.map((d, i) => (
            <li key={`${d.code}${d.label}`}><span className="dx-code">{d.code || 'Free text'}</span><span>{d.label}</span>
              {!locked && <button type="button" className="icon-btn" aria-label={`Remove ${d.label}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><X size={14} /></button>}</li>
          ))}
        </ul>
      )}
      {!locked && (
        <div className="suggest">
          <div className="field"><Search size={16} /><input value={q} onChange={e => type(e.target.value)} placeholder="Search a diagnosis or code, for example hypertension or E11" aria-label="Search diagnoses" maxLength={60} /></div>
          {(res.length > 0 || q.trim().length >= 2) && (
            <ul className="suggest-list" role="listbox">
              {res.map(r => <li key={r.code}><button type="button" role="option" aria-selected={false} onClick={() => add({ code: r.code, label: r.label })}><b>{r.code}</b><span>{r.label}</span><small>{r.group}</small></button></li>)}
              <li><button type="button" className="free" onClick={() => add({ code: null, label: q.trim() })}><Plus size={14} />Use “{q.trim()}” as written</button></li>
            </ul>
          )}
        </div>
      )}
      {!locked && value.length === 0 && q.trim().length < 2 && <small className="muted">Common ICD-10 codes are listed. You can also type any diagnosis in your own words.</small>}
    </div>
  );
}
