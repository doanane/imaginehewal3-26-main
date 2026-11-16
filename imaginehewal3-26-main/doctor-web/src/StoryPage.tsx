import React from 'react';
import { StoryView } from './AgentPage';
import { ThemeToggle } from './theme';
import Logo from './Logo';

/** Public page (no sign in): the care agent story on a simulated person, so anyone can watch the loop work. */
export default function StoryPage() {
  return (
    <div className="story-page">
      <div className="login-theme"><ThemeToggle /></div>
      <header className="story-head">
        <a className="brand-row" href="#/"><Logo width={168} /></a>
        <div><h1>One person. One moment. The care agent in it.</h1>
          <p>HEWAL3 notices when someone goes quiet, reaches them in a way that fits their day, and asks a clinician only when it matters. This is a simulated person, run through the same rules the live service uses.</p></div>
        <a className="btn primary small" href="#/">Doctor sign in</a>
      </header>
      <StoryView />
    </div>
  );
}
