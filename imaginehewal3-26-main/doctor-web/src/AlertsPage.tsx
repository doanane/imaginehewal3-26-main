import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, ShieldCheck, Siren } from 'lucide-react';
import type { Overview } from './types';
import { Empty, Skeleton } from './ui';
import { safeMap, SOS_LABEL, when } from './util';

export default function AlertsPage({ overview }: { overview: Overview | null }) {
  if (!overview) return <div className="card"><Skeleton h={120} /></div>;
  return (
    <>
      <header className="page-head"><div><h1>Emergencies</h1><p>Open SOS alerts from your patients. Doctors watch here; the patient or an approved caregiver clears an alert.</p></div></header>
      {overview.alerts.length === 0 ? (
        <section className="card"><Empty icon={<ShieldCheck size={30} />} title="No open emergencies">This page updates by itself the moment a patient sends one.</Empty></section>
      ) : overview.alerts.map((a, i) => {
        const map = safeMap(a.location_url);
        return (
          <motion.section key={a.id} className="card danger alert-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
            <span className="siren"><Siren size={26} /></span>
            <div className="alert-main">
              <h2>{a.patient || 'Patient'}</h2>
              <p><b>{SOS_LABEL[a.status] || a.status}</b>{a.reason ? `. ${a.reason}` : ''}</p>
              <small>{when(a.at)}{a.escalated ? '. Emergency services were contacted.' : ''}{a.attempts ? ` ${a.attempts} caregiver attempt${a.attempts === 1 ? '' : 's'}.` : ''}</small>
            </div>
            <div className="alert-act">
              {map && <a className="btn ghost" href={map} target="_blank" rel="noopener noreferrer"><MapPin size={16} />Live location</a>}
              <a className="btn primary" href={`#/patient/${a.patient_id}`}>Open patient</a>
            </div>
          </motion.section>
        );
      })}
    </>
  );
}
