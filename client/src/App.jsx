import { useEffect, useState } from 'react';
import { api } from './api';

const STATUSES = [
  ['in-progress', 'In progress'],
  ['paused', 'Paused'],
  ['not-started', 'Not started'],
  ['done', 'Done'],
];
const KINDS = ['course', 'subject', 'project'];

function ago(date) {
  const days = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function Tracker({ canLogout, onLock }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('course');

  const load = async () => {
    try {
      setItems(await api('/items'));
      setError('');
    } catch (err) {
      if (err.status === 401) return onLock();
      setError("Can't reach the server. Try again in a moment.");
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    try { await fn(); await load(); }
    catch (err) { if (err.status === 401) onLock(); else setError("That didn't save. Try again."); }
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    run(async () => {
      const item = await api('/items', 'POST', { title, kind });
      setSelectedId(item._id);
      setTitle('');
    });
  };

  const selected = items.find((i) => i._id === selectedId);

  return (
    <div className="app">
      <aside className="side">
        <h1>Where you left off</h1>
        <button className="quiet home" onClick={() => setSelectedId(null)}>Dashboard</button>

        <form className="add" onSubmit={addItem}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a course, subject or project" />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <button>Add</button>
        </form>

        {error && <p className="error">{error}</p>}

        {STATUSES.map(([status, name]) => {
          const group = items.filter((i) => i.status === status);
          if (!group.length && status !== 'in-progress') return null;
          return (
            <section key={status}>
              <h2>{status === 'in-progress' ? 'Continue' : name}</h2>
              {!group.length && <p className="empty">Nothing in progress. Open an item and set it to In progress.</p>}
              {group.map((i) => {
                const done = i.milestones.filter((m) => m.done).length;
                return (
                  <button key={i._id} className={'row kind-' + i.kind + (i._id === selectedId ? ' on' : '')} onClick={() => setSelectedId(i._id)}>
                    <span className={'dot ' + i.status} />
                    <span className="row-main">
                      <span className="row-title">{i.title}</span>
                      <span className="row-note">{i.leftOffAt || `No note yet · ${i.kind}`}</span>
                    </span>
                    <span className="row-meta">
                      {i.milestones.length > 0 && <span>{done}/{i.milestones.length}</span>}
                      <span>{ago(i.lastTouched)}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
        {canLogout && <button className="quiet logout" onClick={() => api('/logout', 'POST').finally(onLock)}>Log out</button>}
      </aside>

      <main className="detail">
        {selected
          ? <Detail key={selected._id} item={selected} run={run} onDeleted={() => setSelectedId(null)} />
          : <Dashboard items={items} onOpen={setSelectedId} />}
      </main>
    </div>
  );
}

function Detail({ item, run, onDeleted }) {
  const [msTitle, setMsTitle] = useState('');
  const [link, setLink] = useState({ label: '', url: '' });

  const patch = (data) => run(() => api(`/items/${item._id}`, 'PATCH', data));

  const addMilestone = (e) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    run(() => api(`/items/${item._id}/milestones`, 'POST', { title: msTitle }));
    setMsTitle('');
  };

  const addLink = (e) => {
    e.preventDefault();
    if (!link.url.trim()) return;
    patch({ links: [...item.links, { label: link.label.trim() || link.url, url: link.url.trim() }] });
    setLink({ label: '', url: '' });
  };

  const remove = () => {
    if (!window.confirm(`Delete "${item.title}" and its milestones?`)) return;
    run(() => api(`/items/${item._id}`, 'DELETE')).then(onDeleted);
  };

  return (
    <article className={'kind-' + item.kind}>
      <input className="title" defaultValue={item.title}
        onBlur={(e) => e.target.value.trim() && e.target.value !== item.title && patch({ title: e.target.value })} />

      <div className="controls">
        <label>Status
          <select value={item.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </label>
        <label>Type
          <select value={item.kind} onChange={(e) => patch({ kind: e.target.value })}>
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <span className="touched">Last touched {ago(item.lastTouched)}</span>
      </div>

      <label className="block">Left off at
        <textarea rows="2" defaultValue={item.leftOffAt} placeholder="Unit 3, problem 12"
          onBlur={(e) => e.target.value !== item.leftOffAt && patch({ leftOffAt: e.target.value })} />
      </label>

      <h2>Milestones</h2>
      {item.milestones.map((m) => <Milestone key={m._id} m={m} run={run} />)}
      <form className="inline" onSubmit={addMilestone}>
        <input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="Add a milestone, like “Finish chapter 2”" />
        <button>Add</button>
      </form>

      <h2>Links</h2>
      {item.links.length === 0 && <p className="empty">No links yet.</p>}
      <ul className="links">
        {item.links.map((l, idx) => (
          <li key={idx}>
            <a href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
            <button className="quiet" onClick={() => patch({ links: item.links.filter((_, j) => j !== idx) })}>Remove</button>
          </li>
        ))}
      </ul>
      <form className="inline" onSubmit={addLink}>
        <input value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} placeholder="Name" />
        <input value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://" />
        <button>Add link</button>
      </form>

      <button className="danger" onClick={remove}>Delete this item</button>
    </article>
  );
}

function Milestone({ m, run }) {
  const [open, setOpen] = useState(Boolean(m.note));
  const patch = (data) => run(() => api(`/milestones/${m._id}`, 'PATCH', data));
  return (
    <div className={'ms' + (m.done ? ' done' : '')}>
      <div className="ms-head">
        <input type="checkbox" checked={m.done} onChange={(e) => patch({ done: e.target.checked })} aria-label={`Mark ${m.title} done`} />
        <span className="ms-title">{m.title}</span>
        <button className="quiet" onClick={() => setOpen(!open)}>{open ? 'Hide note' : 'Add note'}</button>
        <button className="quiet" onClick={() => run(() => api(`/milestones/${m._id}`, 'DELETE'))}>Remove</button>
      </div>
      {open && (
        <textarea rows="2" defaultValue={m.note} placeholder="A short note for future you"
          onBlur={(e) => e.target.value !== m.note && patch({ note: e.target.value })} />
      )}
    </div>
  );
}

const STALE_DAYS = 7;
const daysSince = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);

function Dashboard({ items, onOpen }) {
  if (!items.length) return <p className="empty big">Add your first course, subject or project on the left.</p>;

  const count = (s) => items.filter((i) => i.status === s).length;
  const milestones = items.flatMap((i) => i.milestones);
  const done = milestones.filter((m) => m.done).length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  const stalled = items
    .filter((i) => ['in-progress', 'paused'].includes(i.status) && daysSince(i.lastTouched) >= STALE_DAYS)
    .sort((a, b) => new Date(a.lastTouched) - new Date(b.lastTouched));
  const recent = items.slice(0, 5);

  const row = (i) => (
    <button key={i._id} className={'row dash-row kind-' + i.kind} onClick={() => onOpen(i._id)}>
      <span className="row-main">
        <span className="row-title">{i.title}</span>
        <span className="row-note">{i.leftOffAt || 'No note yet'}</span>
      </span>
      <span className="row-meta">{ago(i.lastTouched)}</span>
    </button>
  );

  return (
    <div className="dash">
      <h2 className="dash-title">Dashboard</h2>

      <div className="stats">
        {STATUSES.map(([s, name]) => (
          <div key={s} className={'stat s-' + s}>
            <strong>{count(s)}</strong>
            <span>{name}</span>
          </div>
        ))}
      </div>

      <h2>Milestones</h2>
      {milestones.length ? (
        <>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
            <i style={{ width: pct + '%' }} />
          </div>
          <p className="bar-label">{done} of {milestones.length} milestones done ({pct}%)</p>
        </>
      ) : <p className="empty">No milestones yet. Add some inside an item.</p>}

      <h2>Needs a look</h2>
      <p className="hint">In progress or paused, and untouched for {STALE_DAYS} days or more.</p>
      {stalled.length ? stalled.map(row) : <p className="empty">Nothing stalled. Everything you started is moving.</p>}

      <h2>Recently touched</h2>
      {recent.map(row)}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    api('/session')
      .then((s) => setSession({ required: s.required, ok: !s.required || s.authenticated }))
      .catch(() => setSession({ required: true, ok: false }));
  }, []);

  if (!session) return null;
  if (!session.ok) return <Login onDone={() => setSession({ required: true, ok: true })} />;
  return <Tracker canLogout={session.required} onLock={() => setSession({ required: true, ok: false })} />;
}

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/login', 'POST', { password });
      onDone();
    } catch (err) {
      setError(
        err.status === 429 ? 'Too many tries. Wait 15 minutes.'
        : err.status === 401 ? 'That password is wrong.'
        : "Can't reach the server. Try again in a moment."
      );
    }
  };

  return (
    <div className="login-page">
      <form className="login" onSubmit={submit}>
        <h1>Where you left off</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" aria-label="Password" autoFocus autoComplete="current-password" />
        <button>Open</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}