'use client';

import { useCallback, useRef, useState } from 'react';

async function readResponse(response) {
  const body = await response.json();
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('unnamed-island-auth-required'));
  if (!response.ok) throw new Error(body.error || 'databaseUnavailable');
  return body;
}

export function useIslandStorage() {
  const [saveStatus, setSaveStatus] = useState('loading');
  const [saveError, setSaveError] = useState(null);
  const revision = useRef(null);
  const queue = useRef(Promise.resolve());
  const conflict = useRef(false);

  const load = useCallback(async () => {
    // Finish the previous scene's queued writes before loading its replacement.
    // This matters during hot reload while tree growth saves every second.
    await queue.current.catch(() => {});
    let record;
    try { record = await readResponse(await fetch('/api/island', { cache: 'no-store' })); }
    catch (error) { setSaveStatus('error'); setSaveError(error.message); throw error; }
    revision.current = record.revision;
    conflict.current = false;
    setSaveStatus('saved'); setSaveError(null);
    return record.state;
  }, []);

  const save = useCallback((state) => {
    const task = queue.current.catch(() => {}).then(async () => {
      if (conflict.current) throw new Error('saveConflict');
      if (revision.current === null) throw new Error('databaseUnavailable');
      setSaveStatus('saving');
      const record = await readResponse(await fetch('/api/island', {
        method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: revision.current, state }),
      }));
      revision.current = record.revision;
      setSaveStatus('saved'); setSaveError(null);
      return record.state;
    }).catch((error) => {
      if (error.message === 'saveConflict') conflict.current = true;
      setSaveStatus('error'); setSaveError(error.message);
      throw error;
    });
    queue.current = task;
    return task;
  }, []);

  return { load, save, saveStatus, saveError };
}
