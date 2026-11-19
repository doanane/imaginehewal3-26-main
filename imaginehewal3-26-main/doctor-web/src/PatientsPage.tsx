import React, { useMemo, useState } from 'react';
import { ChevronRight, Droplets, Footprints, Heart, Search, Users } from 'lucide-react';
import type { Group, Overview } from './types';
import { Badge, Empty, Skeleton } from './ui';
import AddPatient from './AddPatient';
import SharedRecord from './SharedRecord';
import Rail from './Rail';
import { ago, bpText, GROUP_LABEL, initials, show, shownId } from './util';

const FILTERS: (Group | 'all')[] = ['all', 'critical', 'monitor', 'stable', 'healthy', 'no_data'];

export default function PatientsPage({ overview, error, unread }: { overview: Overview | null; error: string | null; unread: Record<string, number> }) {
  const [filter, setFilter] = useState<Group | 'all'>('all');
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (overview?.patients || []).filter(p => (filter === 'all' || p.group === filter) && (!t || p.name.toLowerCase().includes(t) || (p.identifier || '').toLowerCase().includes(t)));
  }, [overview, filter, q]);

  if (!overview) return error ? <div className="alert-box" role="alert">{error}</div> : <div className="card"><Skeleton h={200} /></div>;
  const counts: Record<string, number> = { all: overview.stats.total, ...overview.stats } as unknown as Record<string, number>;

  return (
    <div className="rail-layout">
    <div className="rail-main">
      <header className="page-head"><div><h1>Patients</h1><p>Everyone who chose you as their doctor, or accepted your request. Select a patient for their analysis.</p></div></header>
      <AddPatient />
      <SharedRecord />
      <section className="card">
        <div className="toolbar">
          <label className="search"><Search size={18} /><input type="search" placeholder="Search by name or patient ID" aria-label="Search patients" value={q} onChange={e => setQ(e.target.value)} /></label>
          <div className="chips" role="group" aria-label="Filter by status">
            {FILTERS.map(f => (
              <button key={f} type="button" className="chip-btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : GROUP_LABEL[f]}<em>{counts[f] ?? 0}</em>
              </button>
            ))}
          </div>
        </div>
        {overview.stats.total === 0 ? (
          <Empty icon={<Users size={28} />} title="No patients yet">A patient appears here when they pick you in the HEWAL3 app under Profile, My doctor, using your ID <b>{overview.doctor.doctor_id}</b>, or when they accept a request you send above.</Empty>
        ) : rows.length === 0 ? <Empty icon={<Search size={26} />} title="No patient matches" /> : (
          <ul className="prow-list">
            {rows.map(p => (
              <li key={p.patient_id}>
                <a href={`#/patient/${p.patient_id}`} className="prow">
                  <span className={`avatar lg ${p.group}`}>{initials(p.name)}</span>
                  <div className="prow-id">
                    <b>{p.name}{unread[p.patient_id] > 0 && <em className="count msg inline" aria-label={`${unread[p.patient_id]} unread`}>{unread[p.patient_id]}</em>}</b>
                    <small>{[p.age ? `${p.age} yrs` : null, p.gender, shownId(p.identifier)].filter(Boolean).join(', ')}</small>
                    {p.conditions.length > 0 && <small>{p.conditions.join(', ')}</small>}
                  </div>
                  <div className="prow-status"><Badge group={p.group} />{p.reasons.length > 0 && <small>{p.reasons.join(', ')}</small>}</div>
                  {(() => {
                    const old = p.last_reading;                                   // no reading in the last 24 hours: show the newest one we hold, plainly marked as not current
                    const hr = p.vitals.heart_rate ?? old?.heart_rate ?? null;
                    const sys = p.vitals.systolic ?? old?.systolic ?? null, dia = p.vitals.diastolic ?? old?.diastolic ?? null;
                    const stale = !!old && p.vitals.at === null;
                    return (
                      <>
                        <div className={`prow-v ${stale ? 'stale' : ''}`} title={stale ? 'Last heart rate, not current' : 'Heart rate'}><Heart size={15} /><b>{show(hr)}</b><small>bpm</small></div>
                        <div className={`prow-v ${stale ? 'stale' : ''}`} title={stale ? 'Last blood pressure, not current' : 'Blood pressure'}><Droplets size={15} /><b>{bpText(sys, dia)}</b><small>mmHg</small></div>
                        <div className="prow-v" title="Steps today"><Footprints size={15} /><b>{p.vitals.steps === null ? 'n/a' : p.vitals.steps.toLocaleString()}</b><small>steps</small></div>
                        <div className="prow-when"><small>{stale ? `Last reading ${ago(old!.at)}` : ago(p.vitals.at)}</small></div>
                      </>
                    );
                  })()}
                  <ChevronRight size={18} className="chev" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    <Rail />
    </div>
  );
}
