/** Contexte audio partagé (survit à la navigation client Next.js après le login). */
let sharedCtx: AudioContext | null = null;

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctor) return null;
  return new Ctor();
}

export function getSharedOrderAudioContext(): AudioContext | null {
  if (!sharedCtx) {
    sharedCtx = createAudioContext();
  }
  return sharedCtx;
}

async function playSilentBuffer(ctx: AudioContext): Promise<void> {
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

/** À appeler pendant un geste utilisateur (ex. clic « Se connecter »). */
export async function primeOrderAlertAudio(): Promise<boolean> {
  const ctx = getSharedOrderAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state !== "running") {
      await ctx.resume();
    }
    if (ctx.state !== "running") return false;
    await playSilentBuffer(ctx);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("kitchen:audioPrimed", "1");
    }
    return true;
  } catch {
    return false;
  }
}

export async function resumeSharedOrderAudioContext(): Promise<boolean> {
  const ctx = getSharedOrderAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state !== "running") {
      await ctx.resume();
    }
    return ctx.state === "running";
  } catch {
    return false;
  }
}
