// Procedural Web Audio only; no recordings, downloads or autoplay.
export function createAmbience() {
  let context, master, wind, surf;
  let enabled = false, nextCall = 0;
  function initialize() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('ambientUnavailable');
    context = new AudioContext();
    master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    function noise(frequency) {
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
      const gain = context.createGain(); source.connect(filter); filter.connect(gain); gain.connect(master); source.start(); return gain;
    }
    wind = noise(370); surf = noise(1500);
  }
  function call(seagull) {
    const now = context.currentTime;
    for (let i = 0; i < (seagull ? 2 : 3); i++) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const start = now + i * (seagull ? 0.25 : 0.13), duration = seagull ? 0.4 : 0.11;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(seagull ? 1350 : 2200 + Math.random() * 600, start);
      oscillator.frequency.exponentialRampToValueAtTime(seagull ? 680 : 3400, start + duration);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(seagull ? 0.035 : 0.022, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(master); oscillator.start(start); oscillator.stop(start + duration + 0.03);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  return {
    async setEnabled(value) {
      if (value && !context) initialize();
      if (value) await context.resume();
      enabled = value;
      if (context) master.gain.setTargetAtTime(value ? 0.6 : 0, context.currentTime, 0.12);
      return enabled;
    },
    update(time, daylight) {
      if (!enabled || !context || context.state !== 'running') return;
      wind.gain.setTargetAtTime(0.035 + Math.sin(time * 0.21) * 0.009, context.currentTime, 0.3);
      surf.gain.setTargetAtTime(0.025 + Math.pow((Math.sin(time * 0.65) + 1) / 2, 2) * 0.055, context.currentTime, 0.2);
      if (time >= nextCall && daylight > 0.25) { call(Math.random() > 0.45); nextCall = time + 5 + Math.random() * 7; }
    },
    setHidden(hidden) { if (context) (hidden ? context.suspend() : enabled ? context.resume() : Promise.resolve()).catch(() => {}); },
    dispose() { enabled = false; if (context) { master.disconnect(); void context.close().catch(() => {}); } },
  };
}
