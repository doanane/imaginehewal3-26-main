import React, { useState } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import { DocKind, getDocuments } from './api';
import DocComposer, { KIND_LABEL } from './DocComposer';
import type { Overview } from './types';
import { Empty, Skeleton } from './ui';
import { usePolling, when } from './util';

/** Everything you have issued: referrals, sick notes and letters, each with a reference anyone can check. */
export default function DocumentsPage({ overview }: { overview: Overview | null }) {
  const d = usePolling(getDocuments, 60000, []);
  const [kind, setKind] = useState<DocKind | null>(null);
  const [pid, setPid] = useState(0);
  const list = d.data?.documents || [];
  const p = overview?.patients.find(x => x.patient_id === pid);
  return (
    <>
      <header className="page-head"><div><h1>Documents</h1><p>Referrals, sick notes and letters you have issued. Each has a reference number that can be checked at <b>/doctor/#/verify</b>.</p></div></header>
      <section className="card">
        <div className="card-head"><h2><FilePlus2 size={18} />New document</h2></div>
        <div className="row-btns">
          <div className="field" style={{ minWidth: 220 }}><select aria-label="Patient" value={pid} onChange={e => setPid(Number(e.target.value))}><option value={0}>Choose a patient</option>{(overview?.patients || []).map(x => <option key={x.patient_id} value={x.patient_id}>{x.name}</option>)}</select></div>
          {(['referral', 'sick_note', 'letter'] as DocKind[]).map(k => <button key={k} className="btn ghost" disabled={!pid} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2><FileText size={18} />Issued</h2><small>{list.length}</small></div>
        {!d.data ? <Skeleton h={120} /> : list.length === 0 ? <Empty icon={<FileText size={26} />} title="Nothing issued yet">Documents you create appear here.</Empty> : (
          <div className="table-wrap"><table className="tbl2"><thead><tr><th>Reference</th><th>Document</th><th>Patient</th><th>Issued</th><th>Status</th></tr></thead>
            <tbody>{list.map(x => <tr key={x.id}><td><a href={`#/doc/${x.id}`}><b>{x.ref}</b></a></td><td>{x.title}</td><td><a href={`#/patient/${x.patient_id}`}>{x.patient}</a></td><td>{when(x.issued_at)}</td><td><span className={`status-pill ${x.revoked ? 'declined' : 'confirmed'}`}>{x.revoked ? 'withdrawn' : 'valid'}</span></td></tr>)}</tbody></table></div>
        )}
      </section>
      {kind && p && <DocComposer patientId={p.patient_id} patientName={p.name} kind={kind} onClose={() => setKind(null)} onCreated={id => { window.location.hash = `#/doc/${id}`; }} />}
    </>
  );
}
