'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';

type Props = {
  slug: string;
  videoId: string;
  requiredWatchPct?: number; // 0..1
  allowBypass?: boolean;
  requireFullWatch?: boolean;
  onUnlock?: () => void;
};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export function VideoGate({ slug, videoId, requiredWatchPct = 0.7, allowBypass = true, requireFullWatch = false, onUnlock }: Props) {
  const [ready, setReady] = useState(false);
  const [pct, setPct] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const plainEmbed = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ t: number; pct: number }>({ t: 0, pct: 0 });
  const initializedRef = useRef(false);

  const threshold = useMemo(() => (requireFullWatch ? 0.99 : requiredWatchPct ?? 0.7), [requireFullWatch, requiredWatchPct]);

  const loadApi = useCallback(() => {
    if (window.YT && window.YT.Player) return;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const startPolling = useCallback(() => {
    if (plainEmbed) return; // no polling in plain mode
    if (!playerRef.current) return;
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const cur = playerRef.current.getCurrentTime?.() || 0;
        const dur = playerRef.current.getDuration?.() || 0;
        if (dur > 0) setDuration(dur);
        const p = dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0;
        setPct(p);

        const now = Date.now();
        const timeSince = now - lastSentRef.current.t;
        const pctDelta = Math.abs(p - lastSentRef.current.pct);
        if (timeSince > 8000 || pctDelta > 0.05 || p >= 0.99) {
          lastSentRef.current = { t: now, pct: p };
          const token = await auth.currentUser?.getIdToken().catch(() => undefined);
          const payload = { slug, videoId, seconds: Math.floor(cur), pct: p, duration: Math.floor(dur), event: p >= 0.99 ? 'completed' as const : 'progress' as const };
          fetch('/api/track/video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
            },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }
      } catch {}
    }, 2000);
  }, [slug, videoId]);

  const maybeUnlock = useCallback(() => {
    if (!unlocked && pct >= threshold) {
      setUnlocked(true);
      onUnlock?.();
    }
  }, [pct, threshold, unlocked, onUnlock]);

  useEffect(() => {
    maybeUnlock();
  }, [pct, maybeUnlock]);

  useEffect(() => {
    if (plainEmbed) {
      // Render a simple iframe without JS API to avoid interruptions
      setReady(true);
      return;
    }
    loadApi();
    const init = () => {
      if (initializedRef.current) return;
      if (!containerRef.current || (playerRef.current && playerRef.current.getIframe)) return;
      const origin = window.location.origin;
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1&modestbranding=1&rel=0&origin=${encodeURIComponent(origin)}`;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(iframe);
      // eslint-disable-next-line new-cap
      playerRef.current = new window.YT.Player(iframe, {
        width: '100%',
        videoId,
        playerVars: { origin, playsinline: 1, rel: 0, modestbranding: 1, enablejsapi: 1, controls: 1 },
        events: {
          onReady: () => {
            setReady(true);
            startPolling();
          },
          onStateChange: (e: any) => {
            try { console.warn('YT state', e?.data); } catch {}
            if (e?.data === 0) {
              // ended
              setPct(1);
              maybeUnlock();
            }
          },
        },
      });
      initializedRef.current = true;
    };

    if (window.YT && window.YT.Player) init();
    else window.onYouTubeIframeAPIReady = init;

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      try {
        playerRef.current?.destroy?.();
        initializedRef.current = false;
      } catch {}
    };
  }, [videoId, startPolling, loadApi, maybeUnlock]);

  const handleBypass = useCallback(async () => {
    setUnlocked(true);
    onUnlock?.();
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => undefined);
      await fetch('/api/track/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ slug, videoId, event: 'bypass_clicked' }),
      });
    } catch {}
  }, [onUnlock, slug, videoId]);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="aspect-video w-full overflow-hidden rounded-lg border" ref={containerRef}>
        {plainEmbed && (
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&modestbranding=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-slate-700">
          Assistido: {(pct * 100).toFixed(0)}% {ready ? '' : '• carregando...'}
        </div>
        <div className="flex items-center gap-2">
          {!unlocked && (
            <div className="text-xs text-slate-600">
              Assista {Math.round((threshold - pct) * 100)}% para liberar a prática
            </div>
          )}
          {allowBypass && !unlocked && (
            <button onClick={handleBypass} className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-slate-50">
              Pular por agora
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoGate;
