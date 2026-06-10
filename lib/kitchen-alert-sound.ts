/**
 * Alerte sonore cuisine — mélodie type cloche (4 notes montantes),
 * répétée selon le nombre de nouvelles commandes. Plus audible qu’un bip carré.
 */
export async function playKitchenNewOrderAlert(
  ctx: AudioContext,
  newOrderCount = 1
): Promise<void> {
  const cycles = Math.min(3, Math.max(1, Math.floor(newOrderCount)));
  const t0 = ctx.currentTime + 0.05;

  // Do → Mi → Sol → Do aigu (accord reconnaissable, style « cloche cuisine »)
  const motif = [
    { freq: 523.25, dur: 0.2, peak: 0.82 },
    { freq: 659.25, dur: 0.2, peak: 0.85 },
    { freq: 783.99, dur: 0.24, peak: 0.88 },
    { freq: 1046.5, dur: 0.38, peak: 0.92 },
  ] as const;

  const motifSpan =
    motif.reduce((acc, n) => acc + n.dur + 0.07, 0) + 0.35;

  for (let c = 0; c < cycles; c += 1) {
    let t = t0 + c * motifSpan;
    for (const note of motif) {
      scheduleBellNote(ctx, t, note.freq, note.dur, note.peak);
      t += note.dur + 0.07;
    }
  }
}

function scheduleBellNote(
  ctx: AudioContext,
  start: number,
  freq: number,
  duration: number,
  peakGain: number
) {
  // Harmoniques pour un son plus riche et percutant
  const partials: { ratio: number; gain: number; type: OscillatorType }[] = [
    { ratio: 1, gain: 1, type: "triangle" },
    { ratio: 2, gain: 0.45, type: "sine" },
    { ratio: 0.5, gain: 0.55, type: "sine" },
  ];

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(peakGain, start + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  master.connect(ctx.destination);

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(freq * p.ratio, start);
    g.gain.setValueAtTime(p.gain, start);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }
}
