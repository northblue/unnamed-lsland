'use client';

import { useEffect, useRef, useState } from 'react';
import { HUT, hutMaterialsMissing } from '../game/building';
import IslandManager from './IslandManager';
import AuthControls from './AuthControls';
import { useIslandStorage } from './useIslandStorage';
import { createIslandState } from '../game/islandState';
import { messages } from '../game/messages';
import { formatIslandTime } from '../game/dayCycle';
import { POND } from '../game/world';
import { pondTotal } from '../game/pond';
import { FISH_KINDS, emptyCatch } from '../game/fishing';

export default function IslandGame() {
  const container = useRef(null);
  const gameRef = useRef(null);
  const storage = useIslandStorage();
  const [offline, setOffline] = useState(false);
  const [manager, setManager] = useState(null);
  const [openingManager, setOpeningManager] = useState(false);
  const [status, setStatus] = useState('loading');
  const [hud, setHud] = useState({ wood: 0, stone: 0, target: null, collected: false, allDepleted: false, buildingMode: false, placementReason: 'choose', buildings: 0, built: false });
  const [language, setLanguage] = useState('zh');
  const [buildOpen, setBuildOpen] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(true);
  const [timeOpen, setTimeOpen] = useState(true);
  const [fishingOpen, setFishingOpen] = useState(true);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [ambientBusy, setAmbientBusy] = useState(false);
  const [ambientError, setAmbientError] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    let preferred;
    try { preferred = localStorage.getItem('unnamed-island-focus-mode'); } catch { /* Optional preference. */ }
    setFocusMode(preferred === 'true' || (preferred !== 'false' && window.matchMedia('(max-width: 700px)').matches));
  }, []);

  function toggleFocusMode() {
    const next = !focusMode;
    setFocusMode(next);
    try { localStorage.setItem('unnamed-island-focus-mode', String(next)); } catch { /* Optional preference. */ }
  }

  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    function adaptPanels() { setBuildOpen(!query.matches); setCameraOpen(!query.matches); setTimeOpen(!query.matches); setFishingOpen(!query.matches); }
    adaptPanels();
    query.addEventListener('change', adaptPanels);
    return () => query.removeEventListener('change', adaptPanels);
  }, []);
  const text = messages[language];
  const fishing = hud.fishing ?? { phase: 'idle', catches: emptyCatch() };
  const supplies = hud.supplies ?? { nearby: null, notice: null, growing: 0 };
  const pond = hud.pond ?? emptyCatch();
  const pondCount = pondTotal(pond);
  const fishingActive = fishing.phase !== 'idle';
  const fishTotal = Object.values(fishing.catches).reduce((sum, value) => sum + value, 0);
  const fishingPrompt = fishing.error ? text.fishing.errors[fishing.error]
    : fishing.phase === 'caught' ? text.fishing.caught.replace('{fish}', text.fishing.kinds[fishing.result])
    : fishing.phase === 'waiting' ? text.fishing.waiting : fishing.phase === 'empty' ? text.fishing.empty
    : fishing.phase === 'aim' ? (fishing.nearShore ? text.fishing.aim : text.fishing.shore) : text.fishing.help;
  const displayName = hud.islandName || text.name;
  const missing = hutMaterialsMissing(hud);
  const canAffordHut = missing.wood === 0 && missing.stone === 0;
  const missingText = `${text.materialsMissing}: ${missing.wood} ${text.wood} · ${missing.stone} ${text.stone}`;

  useEffect(() => {
    try {
      if (localStorage.getItem('unnamed-island-language') === 'en') setLanguage('en');
    } catch { /* Language switching still works when storage is unavailable. */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = `${displayName} · Unnamed Island`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', text.description);
  }, [language, text, displayName]);

  function changeLanguage(next) {
    setLanguage(next);
    try { localStorage.setItem('unnamed-island-language', next); } catch { /* Optional preference. */ }
  }

  useEffect(() => { gameRef.current?.setLanguage(language); }, [language,status]);

  useEffect(() => {
    let disposed = false;
    let game;
    Promise.all([import('../game/createGame'), offline ? Promise.resolve(createIslandState()) : storage.load()]).then(([{ createGame }, initialState]) => {
      if (disposed) return;
      try {
        game = createGame(container.current, setHud, initialState, (snapshot) => { if (!offline) storage.save(snapshot).catch(() => {}); });
        gameRef.current = game;
        setAmbientEnabled(false);
        setStatus('ready');
      } catch (error) {
        console.error(error); setStatus('renderError');
      }
    }).catch((error) => {
      console.error(error);
      if (!disposed) setStatus('databaseError');
    });
    return () => { disposed = true; game?.dispose(); gameRef.current = null; };
  }, [storage.load, storage.save, offline]);

  async function openManager() {
    const game = gameRef.current;
    if (!game) return;
    game.setPaused(true); setOpeningManager(true);
    try {
      const snapshot = game.getSnapshot();
      await storage.save(snapshot);
      setManager(snapshot);
    } catch { game.setPaused(false); }
    finally { setOpeningManager(false); }
  }
  async function toggleAmbience() {
    if (!gameRef.current || ambientBusy) return;
    setAmbientBusy(true); setAmbientError(false);
    try { setAmbientEnabled(await gameRef.current.setAmbience(!ambientEnabled)); }
    catch { setAmbientError(true); }
    finally { setAmbientBusy(false); }
  }
  function closeManager() { setManager(null); gameRef.current?.setPaused(false); container.current?.focus(); }
  async function saveManager(state) {
    const saved = await storage.save(state);
    gameRef.current.applyState(saved);
    closeManager();
  }

  return <main className="game-shell" data-night={hud.time?.night ? 'true' : 'false'} data-focus={focusMode ? 'true' : 'false'}>
    <div className="scene" ref={container} aria-label={text.scene} tabIndex={0} />
    <button className="focus-toggle" type="button" aria-pressed={focusMode} onClick={toggleFocusMode}>
      <span aria-hidden="true">{focusMode ? '☰' : '◉'}</span> {focusMode ? text.display.showMenus : text.display.focusIsland}
    </button>
    {focusMode && (status === 'loading' || status === 'renderError' || storage.saveStatus === 'error' || offline) && <p className="focus-save-status" role="status">
      {status === 'loading' || status === 'renderError' ? text.status[status] : offline ? text.offlineNote : text.display.saveWarning}
    </p>}
    <header className="title-card">
      <span className="eyebrow">UNNAMED ISLAND</span>
      <h1><span className="island-title" title={displayName}>{displayName}</span><span>{text.tagline}</span></h1>
    </header>
    <nav className="language-switch" aria-label={text.language}>
      <button type="button" lang="zh-CN" aria-pressed={language === 'zh'} onClick={() => changeLanguage('zh')}>中文</button>
      <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => changeLanguage('en')}>EN</button>
    </nav>
    {status === 'ready' && hud.time && <details className="time-card" open={timeOpen} onToggle={(event) => setTimeOpen(event.currentTarget.open)}>
      <summary><span aria-hidden="true">{hud.time.night ? '☾' : '☀'}</span> {formatIslandTime(hud.time.minutes)} · {text.time.phases[hud.time.phase]}</summary>
      <p>{hud.time.preview ? text.time.preview : hud.time.dayMinutes === null ? text.time.live : text.time.accelerated.replace('{minutes}', hud.time.dayMinutes)}</p>
      <label htmlFor="island-day-length">{text.time.speed}</label>
      <select id="island-day-length" value={hud.time.dayMinutes ?? 'real'} onChange={(event) => gameRef.current?.setDayLength(event.target.value === 'real' ? null : Number(event.target.value))}>
        <option value="real">{text.time.realDay}</option>
        {[60, 24, 12].map((minutes) => <option key={minutes} value={minutes}>{text.time.shortDay.replace('{minutes}', minutes)}</option>)}
      </select>
      <label htmlFor="island-time">{text.time.slider}</label>
      <input id="island-time" type="range" min="0" max="1439" step="1" value={hud.time.minutes}
        aria-valuetext={formatIslandTime(hud.time.minutes)}
        onChange={(event) => gameRef.current?.setTimePreview(Number(event.target.value) / 60)} />
      <div className="time-presets">
        {[['sunrise', 6], ['noon', 12], ['sunset', 18], ['midnight', 0]].map(([key, hour]) =>
          <button key={key} type="button" onClick={() => gameRef.current?.setTimePreview(hour)}>{text.time[key]}</button>)}
      </div>
      <button className="time-live" type="button" aria-pressed={!hud.time.preview}
        onClick={() => gameRef.current?.setTimePreview(null)}>{text.time.resume}</button>
    </details>}
    <div className="right-panel">
    <section className="storage-card" aria-label={text.storageTitle}>
      <button type="button" disabled={status !== 'ready' || openingManager || offline} onClick={openManager}>{openingManager ? text.savingChanges : text.managerTitle}</button>
      <p role="status">{offline ? text.offlineNote : text.saveStates[storage.saveStatus]}</p>
      <AuthControls text={text.auth} onBeforeLogout={async () => {
        if (gameRef.current && !offline) await storage.save(gameRef.current.getSnapshot());
      }} />
      <button className="ambience-toggle" type="button" disabled={status !== 'ready' || ambientBusy} aria-pressed={ambientEnabled} title={text.nature.soundHelp} onClick={toggleAmbience}>{ambientEnabled ? text.nature.soundOn : text.nature.soundOff}</button>
      {ambientError && <p role="alert">{text.nature.soundError}</p>}
      {!offline && storage.saveError && <p className="manager-error" role="alert">{text.storageErrors[storage.saveError] || text.storageErrors.databaseUnavailable}</p>}
      {!offline && storage.saveStatus === 'error' && storage.saveError !== 'saveConflict' && <button type="button" onClick={() => gameRef.current && storage.save(gameRef.current.getSnapshot()).catch(() => {})}>{text.retrySave}</button>}
    </section>
    <section className="inventory" aria-label={text.resources}>
      <div className="resource-count"><span aria-hidden="true">▰</span><span>{text.wood}</span><strong>{hud.wood}</strong></div>
      <div className="resource-count"><span aria-hidden="true">◆</span><span>{text.stone}</span><strong>{hud.stone}</strong></div>
    </section>
    <div className="coastal-activities">
    <details className="fishing-card supplies-card">
      <summary>{text.supplies.title}</summary>
      <p>{text.supplies.help}</p>
      <p>{text.supplies.growing.replace('{count}',supplies.growing)}</p>
      <button type="button" disabled={status!=='ready' || !supplies.nearby || fishingActive || hud.buildingMode}
        onClick={()=>gameRef.current?.collectSupplies()}>{text.supplies.collect}</button>
      <p role="status">{supplies.notice ? text.supplies.found.replace('{wood}',supplies.notice.wood).replace('{stone}',supplies.notice.stone) : supplies.nearby ? text.supplies.prompt.replace('{kind}',text.supplies[supplies.nearby]) : text.supplies.waiting}</p>
    </details>
    <details className="fishing-card" open={fishingOpen} onToggle={(event) => setFishingOpen(event.currentTarget.open)}>
      <summary>{text.fishing.title} · {fishTotal}</summary>
      <button type="button" disabled={status !== 'ready'} aria-pressed={fishingActive} onClick={() => gameRef.current?.toggleFishing()}>{fishingActive ? text.fishing.cancel : text.fishing.start}</button>
      <button className="fish-cast-nearby" type="button" disabled={status !== 'ready' || ['waiting', 'caught'].includes(fishing.phase)} onClick={() => gameRef.current?.castNearbyFish()}>{text.fishing.nearby}</button>
      <p role="status">{fishingPrompt}</p>
      <div className="fish-basket" aria-label={text.fishing.basket}>
        {FISH_KINDS.map((kind) => <span key={kind}>{text.fishing.kinds[kind]} <strong>{fishing.catches[kind]}</strong></span>)}
      </div>
      <small>{text.fishing.note}</small>
      <a className="fish-preview-link" href="/fish-preview">{text.fishPreview.link}</a>
      <details className="pond-panel">
        <summary>{text.pond.title} · {pondCount}/{POND.capacity}</summary>
        <p>{text.pond.help}</p>
        {FISH_KINDS.map(kind => <div className="pond-row" key={kind}>
          <span>{text.fishing.kinds[kind]} <strong>{pond[kind]}</strong></span>
          <button type="button" disabled={status !== 'ready' || fishing.catches[kind] === 0 || pondCount >= POND.capacity}
            aria-label={`${text.pond.deposit} ${text.fishing.kinds[kind]}`} onClick={() => gameRef.current?.transferFish(kind, 'deposit')}>{text.pond.deposit}</button>
          <button type="button" disabled={status !== 'ready' || pond[kind] === 0 || fishing.catches[kind] >= 1000000}
            aria-label={`${text.pond.withdraw} ${text.fishing.kinds[kind]}`} onClick={() => gameRef.current?.transferFish(kind, 'withdraw')}>{text.pond.withdraw}</button>
        </div>)}
        <small>{pondCount >= POND.capacity ? text.pond.full : text.pond.note}</small>
      </details>
    </details>
    </div>
    <details className="build-card" aria-label={text.buildTitle} open={buildOpen} onToggle={(event) => setBuildOpen(event.currentTarget.open)}>
      <summary>{text.hut}</summary>
      <p>{hud.wood}/{HUT.wood} {text.wood} · {hud.stone}/{HUT.stone} {text.stone}</p>
      {!canAffordHut && <p className="materials-needed" role="status">{missingText}</p>}
      <button type="button" disabled={status !== 'ready'} aria-pressed={hud.buildingMode}
        onClick={() => gameRef.current?.setBuilding(!hud.buildingMode && canAffordHut)}>
        {hud.buildingMode ? text.returnToGather : canAffordHut ? text.startBuild : text.gatherFirst}
      </button>
      {hud.buildingMode && <div className="build-actions">
        <button type="button" onClick={() => gameRef.current?.suggestBuild()}>{text.suggestBuild}</button>
        <button type="button" disabled={Boolean(hud.placementReason)} onClick={() => gameRef.current?.confirmBuild()}>{text.confirmBuild}</button>
      </div>}
      <p className="build-hint" role="status">{hud.buildingMode
        ? hud.placementReason === 'materials' ? missingText : text.placement[ hud.placementReason ?? 'valid' ]
        : !canAffordHut ? text.gatherForHut : text.buildReady}</p>
      {hud.buildingMode && canAffordHut && <p className="build-hint">{text.buildSelectionHelp}</p>}
      <small>{text.hutsBuilt}: {hud.buildings}</small>
    </details>
    <details className="camera-panel" aria-label={text.cameraTitle} open={cameraOpen} onToggle={(event) => setCameraOpen(event.currentTarget.open)}>
      <summary>{text.cameraTitle}</summary>
      <div className="camera-presets">
        <button type="button" onClick={() => gameRef.current?.cameraCommand('angled')}>{text.angled}</button>
        <button type="button" onClick={() => gameRef.current?.cameraCommand('top')}>{text.top}</button>
        <button type="button" onClick={() => gameRef.current?.cameraCommand('side')}>{text.side}</button>
        <button type="button" onClick={() => gameRef.current?.cameraCommand('reset')}>{text.resetView}</button>
        <button type="button" disabled={status !== 'ready'} onClick={() => gameRef.current?.cameraCommand('surf')}>{text.surfing.station}</button>
        {['lighthouse', 'court', 'garden'].map(place => <button type="button" key={place} disabled={status !== 'ready'} onClick={() => gameRef.current?.cameraCommand(place)}>{text.landmarks[place]}</button>)}
      </div>
      <div className="camera-buttons">
        {[['left', '↶'], ['right', '↷'], ['in', '+'], ['out', '−']].map(([action, label]) =>
          <button type="button" key={action} aria-label={text.cameraActions[action]} title={text.cameraActions[action]}
            onClick={() => gameRef.current?.cameraCommand(action)}>{label}</button>)}
      </div>
      <p>{text.cameraHelp}</p>
      <p>{text.landmarks.note} · <a href="/models/mesh2motion-pets/NOTICE.txt" target="_blank" rel="noreferrer">{text.modelCredits}</a></p>
    </details>
    </div>
    <aside className="chapter"><span className="chapter-number">01</span><div><small>{text.chapter}</small><p>{text.goal}</p></div></aside>
    <section className="guide" aria-label={text.instructions}>
      <span className="guide-icon">✦</span>
      <div><h2>{text.guideTitle}</h2><p>{text.guideBody}</p>
        <div className="controls"><kbd>W A S D</kbd><span>{text.or}</span><kbd>↑ ← ↓ →</kbd><span>{text.move}</span><kbd>{text.space}</kbd><span>{text.jump}</span></div>
        <div className="gather-prompt" aria-live="polite">
          {fishingActive ? fishingPrompt : !hud.buildingMode && supplies.nearby ? <><kbd>E</kbd> {text.supplies.prompt.replace('{kind}',text.supplies[supplies.nearby])}</> : hud.buildingMode ? text.buildHelp : hud.target
            ? hud.target.remaining > 0
              ? <><kbd>E</kbd> {text.gather[hud.target.type]} <span>({text.remaining}: {hud.target.remaining})</span></>
              : text.depleted[hud.target.type]
            : hud.allDepleted ? text.allDepleted : text.findResource}
        </div>
        <p className="session-note">{offline ? text.offlineNote : text.sessionNote}</p>
      </div>
    </section>
    <div className="gather-feedback" role="status">
      {hud.built ? <span>{text.built}</span> : hud.collected && <span key={hud.feedbackSequence}>{text.collected[hud.collected]}</span>}
    </div>
    {status === 'ready' && <button className="recover-player" type="button" title={text.recoverHelp} disabled={!!manager || openingManager} onClick={() => gameRef.current?.recoverPlayer()}>{text.recoverPlayer}</button>}
    {status === 'ready' && (hud.surfing?.active || hud.surfing?.nearby) && <section className="basketball-card surf-card" aria-label={text.surfing.title}>
      <strong>{text.surfing.title}</strong><span>{text.surfing.laps.replace('{laps}', hud.surfing.laps)}</span>
      <p>{hud.surfing.active ? text.surfing.help : text.surfing.hint}</p>
      <div><button type="button" disabled={hud.buildingMode || ['waiting', 'caught'].includes(hud.fishing?.phase)} onClick={() => gameRef.current?.toggleSurfing()}>{hud.surfing.active ? text.surfing.finish : text.surfing.start}</button>{hud.surfing.active && <><button type="button" aria-pressed={hud.surfing.follow} onClick={() => !hud.surfing.follow && gameRef.current?.toggleSurfCamera()}>{text.surfing.follow}</button><button type="button" aria-pressed={!hud.surfing.follow} onClick={() => hud.surfing.follow && gameRef.current?.toggleSurfCamera()}>{text.surfing.overview}</button></>}</div>
      {hud.surfing.active && hud.surfing.follow && <>
        <p className="surf-orbit-hint">{text.surfing.orbit}</p>
        <div><button type="button" aria-label={text.cameraActions.left} onClick={() => gameRef.current?.cameraCommand('left')}>↶</button>
        <button type="button" onClick={() => gameRef.current?.cameraCommand('surf-front')}>{text.surfing.front}</button>
        <button type="button" aria-label={text.cameraActions.right} onClick={() => gameRef.current?.cameraCommand('right')}>↷</button></div>
      </>}
    </section>}
    {status === 'ready' && hud.basketball?.visible && <section className="basketball-card" aria-label={text.basketball.title}>
      <strong>{text.basketball.title}</strong><span>{text.basketball.score.replace('{makes}', hud.basketball.makes).replace('{shots}', hud.basketball.shots)}</span>
      <p aria-live="polite">{hud.basketball.result ? text.basketball[hud.basketball.result] : hud.basketball.held ? (hud.basketball.canShoot ? text.basketball.held : text.basketball.range) : hud.basketball.flying ? text.basketball.flying : text.basketball.find}</p>
      <div><button type="button" disabled={hud.buildingMode || (!hud.basketball.held && !hud.basketball.canPickup)} onClick={() => gameRef.current?.toggleBasketball()}>{hud.basketball.held ? text.basketball.drop : text.basketball.pickup}</button>
      <button type="button" disabled={hud.buildingMode || !hud.basketball.canShoot} onClick={() => gameRef.current?.shootBasketball()}>{text.basketball.shoot}</button></div>
    </section>}
    {status === 'databaseError' && <div className="database-error" role="alert"><h2>{text.storageErrors.databaseUnavailable}</h2><p>{text.databaseSetupHelp}</p><button type="button" onClick={() => window.location.reload()}>{text.retryLoad}</button> <button type="button" onClick={() => setOffline(true)}>{text.playOffline}</button></div>}
    {manager && <IslandManager initial={manager} text={text} onSave={saveManager} onClose={closeManager} />}
    <footer><span className="status" role="status">{text.status[status]}</span><span>{text.prototype}</span></footer>
  </main>;
}
