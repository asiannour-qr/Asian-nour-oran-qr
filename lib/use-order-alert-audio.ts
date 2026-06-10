"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctor) return null;
  return new Ctor();
}

function isAudioRunning(ctx: AudioContext): boolean {
  return ctx.state === "running";
}

async function resumeContext(ctx: AudioContext): Promise<boolean> {
  if (isAudioRunning(ctx)) return true;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  return isAudioRunning(ctx);
}

/**
 * Gère le déblocage audio navigateur (politique autoplay) pour les alertes commandes.
 */
export function useOrderAlertAudio(soundEnabled: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const warnedRef = useRef(false);

  const unlock = useCallback(
    async (playTest?: (ctx: AudioContext) => Promise<void>) => {
      if (!soundEnabled) return false;
      if (!audioCtxRef.current) {
        audioCtxRef.current = createAudioContext();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return false;

      const ok = await resumeContext(ctx);
      setAudioReady(ok);
      if (ok) {
        warnedRef.current = false;
        if (playTest) await playTest(ctx);
      }
      return ok;
    },
    [soundEnabled]
  );

  const playAlert = useCallback(
    async (playFn: (ctx: AudioContext, count: number) => Promise<void>, count = 1) => {
      if (!soundEnabled) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = createAudioContext();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const ok = await resumeContext(ctx);
      setAudioReady(ok);
      if (!ok) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.error("Touchez « Activer le son » pour entendre les alertes", { id: "audio-blocked" });
        }
        return;
      }

      warnedRef.current = false;
      await playFn(ctx, count);
    },
    [soundEnabled]
  );

  useEffect(() => {
    if (!soundEnabled) {
      setAudioReady(false);
      return;
    }
    const onInteract = () => {
      void unlock();
    };
    document.addEventListener("pointerdown", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
    };
  }, [soundEnabled, unlock]);

  return { audioReady, unlock, playAlert };
}
