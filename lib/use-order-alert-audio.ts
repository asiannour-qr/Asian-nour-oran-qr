"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type AlertHandler = (ctx: AudioContext, count: number) => Promise<void>;

type PendingAlert = { playFn: AlertHandler; count: number };

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
 * Met en file les alertes manquées tant que l'utilisateur n'a pas interagi une fois.
 */
export function useOrderAlertAudio(soundEnabled: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const pendingRef = useRef<PendingAlert[]>([]);
  const warnedRef = useRef(false);

  const getContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const flushPending = useCallback(async (ctx: AudioContext) => {
    if (!pendingRef.current.length) return;
    const queue = pendingRef.current.splice(0);
    for (const item of queue) {
      await item.playFn(ctx, item.count);
    }
  }, []);

  const unlock = useCallback(
    async (playTest?: (ctx: AudioContext) => Promise<void>) => {
      if (!soundEnabled) return false;
      const ctx = getContext();
      if (!ctx) return false;

      const ok = await resumeContext(ctx);
      setAudioReady(ok);
      if (!ok) return false;

      warnedRef.current = false;
      if (playTest) await playTest(ctx);
      await flushPending(ctx);
      return true;
    },
    [flushPending, getContext, soundEnabled]
  );

  const playAlert = useCallback(
    async (playFn: AlertHandler, count = 1) => {
      if (!soundEnabled) return;
      const ctx = getContext();
      if (!ctx) return;

      const ok = await resumeContext(ctx);
      setAudioReady(ok);
      if (!ok) {
        pendingRef.current.push({ playFn, count });
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.error("Touchez l'écran une fois pour activer le son des alertes", {
            id: "audio-blocked",
            duration: 4000,
          });
        }
        return;
      }

      warnedRef.current = false;
      await playFn(ctx, count);
      await flushPending(ctx);
    },
    [flushPending, getContext, soundEnabled]
  );

  useEffect(() => {
    if (!soundEnabled) {
      pendingRef.current = [];
      setAudioReady(false);
      return;
    }

    const onInteract = () => {
      void unlock();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void unlock();
    };

    document.addEventListener("pointerdown", onInteract, { passive: true });
    document.addEventListener("touchstart", onInteract, { passive: true });
    document.addEventListener("keydown", onInteract, { passive: true });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("touchstart", onInteract);
      document.removeEventListener("keydown", onInteract);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [soundEnabled, unlock]);

  return { audioReady, unlock, playAlert };
}
