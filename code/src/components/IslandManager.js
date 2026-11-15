'use client';

import { useState, useRef } from 'react';
import { createGatheringState } from '../game/gathering';
import { findBuildSpot, HUT } from '../game/building';
import { validateIslandState } from '../game/islandState';
import { ISLAND } from '../game/world';

export default function IslandManager({ initial, text, onSave, onClose }) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  function update(field, value) { setDraft((old) => ({ ...old, [field]: value })); }
  function editBuilding(id, field, value) {
    setDraft((old) => ({ ...old, buildings: old.buildings.map((b) => b.id === id ? { ...b, [field]: value } : b) }));
  }
  function addHut() {
    try {
      const state = validateIslandState({ ...draft, wood: Number(draft.wood), stone: Number(draft.stone),
        buildings: draft.buildings.map((b) => ({ ...b, x: Number(b.x), z: Number(b.z) })) });
      const inventory = createGatheringState();
      for (const node of inventory.resources) node.remaining = state.resources.find((r) => r.id === node.id).remaining;
      const spot = findBuildSpot({ buildings: state.buildings.map((b) => ({ ...b, halfX: HUT.halfX, halfZ: HUT.halfZ })) }, inventory, { x: 100, z: 100 });
      if (!spot) throw new Error('noSpace');
      update('buildings', [...state.buildings, { id: `hut:${crypto.randomUUID()}`, type: 'hut', ...spot }]);
      setError(null);
    } catch (error) { setError(error.message); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const state = validateIslandState({ ...draft, wood: Number(draft.wood), stone: Number(draft.stone),
        buildings: draft.buildings.map((b) => ({ ...b, x: Number(b.x), z: Number(b.z) })) });
      await onSave(state);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  function handleKeys(event) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const elements = [...dialog.current.querySelectorAll('input, button:not([disabled])')];
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  return <div className="manager-overlay">
    <section ref={dialog} onKeyDown={handleKeys} className="manager-dialog" role="dialog" aria-modal="true" aria-labelledby="manager-title">
      <h2 id="manager-title">{text.managerTitle}</h2>
      <p>{text.managerIntro}</p>
      <form onSubmit={submit}>
        <label>{text.islandName}<input autoFocus maxLength={40} required value={draft.name} onChange={(e) => update('name', e.target.value)} /></label>
        <div className="manager-columns">
          {['wood', 'stone'].map((type) => <label key={type}>{text[type]}<input type="number" min="0" max="1000000" step="1" required value={draft[type]} onChange={(e) => update(type, e.target.value)} /></label>)}
        </div>
        <div className="manager-heading"><h3>{text.buildTitle} ({draft.buildings.length})</h3><button type="button" disabled={busy || draft.buildings.length >= 50} onClick={addHut}>{text.addHut}</button></div>
        {draft.buildings.length === 0 && <p>{text.noBuildings}</p>}
        <div className="building-editor-list">{draft.buildings.map((building, index) => <div className="building-editor" key={building.id}>
          <span>{text.hut} {index + 1}</span>
          {['x', 'z'].map((axis) => <label key={axis}>{axis.toUpperCase()}<input aria-label={`${text.hut} ${index + 1} ${axis.toUpperCase()}`} type="number" min={-ISLAND[axis]} max={ISLAND[axis]} step="any" required value={building[axis]} onChange={(e) => editBuilding(building.id, axis, e.target.value)} /></label>)}
          <button type="button" disabled={busy} onClick={() => update('buildings', draft.buildings.filter((b) => b.id !== building.id))}>{text.removeBuilding}</button>
        </div>)}</div>
        <p>{text.managerBuildingHelp}</p>
        {error && <p className="manager-error" role="alert">{text.storageErrors[error] || text.storageErrors.invalidBuildings}</p>}
        <div className="manager-actions"><button type="button" disabled={busy} onClick={onClose}>{text.discardChanges}</button><button type="submit" disabled={busy}>{busy ? text.savingChanges : text.saveChanges}</button></div>
      </form>
    </section>
  </div>;
}
