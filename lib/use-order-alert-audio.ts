"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSharedOrderAudioContext,
  primeOrderAlertAudio,
  resumeSharedOrderAudioContext,
} from "@/lib/order-audio-context";

type AlertHandler = (ctx: AudioContext, count: number) => Promise<void>;

type PendingAlert = { playFn: AlertHandler; count: number };

/**
 * Alertes sonores commandes — son ON par défaut, déblocage au login ou au 1er toucher discret.
 */
export function useOrderAlertAudio(soundEnabled: boolean) {
  const [audioReady, setAudioReady] = useState(false);
  const pendingRef = useRef<PendingAlert[]>([]);

  const getContext = useCallback(() => getSharedOrderAudioContext(), []);

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

      const ok = await resumeSharedOrderAudioContext();
      setAudioReady(ok);
      if (!ok) return false;

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

      let ok = await resumeSharedOrderAudioContext();
      if (!ok) {
        ok = await primeOrderAlertAudio();
      }
      setAudioReady(ok);
      if (!ok) {
        pendingRef.current.push({ playFn, count });
        return;
      }

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

    let cancelled = false;

    const tryUnlock = async () => {
      const ok = await resumeSharedOrderAudioContext();
      if (!cancelled) setAudioReady(ok);
      if (ok) await flushPending(getContext()!);
    };

    void tryUnlock();

    const onInteract = () => {
      void (async () => {
        const primed = await primeOrderAlertAudio();
        if (!cancelled) setAudioReady(primed);
        if (primed) await flushPending(getContext()!);
      })();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void tryUnlock();
    };

    document.addEventListener("pointerdown", onInteract, { passive: true, capture: true });
    document.addEventListener("touchstart", onInteract, { passive: true, capture: true });
    document.addEventListener("keydown", onInteract, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", onInteract, { capture: true });
      document.removeEventListener("touchstart", onInteract, { capture: true });
      document.removeEventListener("keydown", onInteract, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushPending, getContext, soundEnabled]);

  return { audioReady, unlock, playAlert };
}
