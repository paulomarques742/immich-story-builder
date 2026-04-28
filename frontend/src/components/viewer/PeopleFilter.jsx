import { useState, useEffect } from 'react';
import axios from 'axios';
import { publicPersonThumbUrl } from '../../lib/immich.js';

export default function PeopleFilter({ slug, selectedIds, onToggle }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/public/${slug}/people`)
      .then((r) => setPeople(r.data))
      .catch(() => setError('Não foi possível carregar as pessoas.'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div style={{
      position: 'fixed', top: 52, left: 0, right: 0, zIndex: 99,
      background: 'color-mix(in srgb, var(--paper-warm) 95%, transparent)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--paper-deep)',
      padding: '0.6rem 2rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      overflowX: 'auto',
      animation: 'fadeUp 200ms var(--ease-out) both',
    }}>
      {loading && (
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
          A carregar pessoas…
        </span>
      )}
      {error && (
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
          {error}
        </span>
      )}
      {!loading && !error && people.length === 0 && (
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}>
          Nenhuma pessoa encontrada.
        </span>
      )}
      {people.map((person) => {
        const active = selectedIds.has(person.id);
        return (
          <button
            key={person.id}
            onClick={() => onToggle(person.id)}
            title={person.name || 'Pessoa sem nome'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
              border: active ? '2.5px solid var(--ink)' : '2.5px solid transparent',
              outline: active ? 'none' : '1px solid var(--paper-deep)',
              transition: 'border-color 150ms',
            }}>
              <img
                src={publicPersonThumbUrl(slug, person.id)}
                alt={person.name || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            {person.name && (
              <span style={{
                fontSize: '0.65rem', fontFamily: 'var(--font-body)',
                color: active ? 'var(--ink)' : 'var(--ink-muted)',
                maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 150ms',
              }}>
                {person.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
