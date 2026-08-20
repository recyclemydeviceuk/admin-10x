'use client';

import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Icon } from '@/components/Icon';
import { captureFace, closeCamera, loadFaceModels, matchesPose, openCamera, type Pose } from '@/lib/face';
import { enrollFaceLock, faceLockStatus, removeFaceLock, type FaceLockStatus } from '@/lib/actions/faceLock';

const POSES: { pose: Pose; title: string; hint: string }[] = [
  { pose: 'front', title: 'Look straight at the camera', hint: 'Face the screen, eyes on the lens.' },
  { pose: 'left', title: 'Turn your head to the LEFT', hint: 'A comfortable quarter turn — no need to go fully sideways.' },
  { pose: 'right', title: 'Turn your head to the RIGHT', hint: 'Same again, the other way.' },
];

/**
 * Set a Face Lock — guided webcam enrolment.
 *
 * Three captures (front, left, right) are reduced to face descriptors in the
 * browser; only those numbers are stored. The camera stream never leaves this
 * machine, and no photo is saved anywhere.
 */
export function FaceLockPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<FaceLockStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'starting' | 'capturing' | 'saving'>('idle');
  const [step, setStep] = useState(0);
  const [live, setLive] = useState('');
  const [error, setError] = useState('');
  const capturesRef = useRef<number[][]>([]);
  const stopRef = useRef(false);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    void faceLockStatus().then(setStatus);
    return () => {
      stopRef.current = true;
      closeCamera(videoRef.current);
    };
  }, []);

  async function start() {
    setError('');
    setStep(0);
    capturesRef.current = [];
    setPhase('starting');
    try {
      setLive('Loading the face model…');
      await loadFaceModels();
      if (!videoRef.current) return;
      setLive('Starting the camera…');
      await openCamera(videoRef.current);
      setPhase('capturing');
      stopRef.current = false;
      await runCaptures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The camera could not be started.');
      setPhase('idle');
      closeCamera(videoRef.current);
    }
  }

  /** Walk the three poses; each needs a matching, confident face held briefly. */
  async function runCaptures() {
    for (let i = 0; i < POSES.length; i++) {
      setStep(i);
      const target = POSES[i];
      let held = 0;
      while (!stopRef.current) {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          await pause(150);
          continue;
        }
        const capture = await captureFace(video);
        if (!capture) {
          held = 0;
          setLive('No face in frame — come a little closer to the camera.');
          await pause(200);
          continue;
        }
        if (!matchesPose(target.pose, capture.yaw)) {
          held = 0;
          setLive(target.title);
          await pause(200);
          continue;
        }
        // Two consecutive matching reads = a held pose, not a frame in passing.
        held += 1;
        setLive(held < 2 ? 'Hold it…' : 'Captured ✓');
        if (held >= 2) {
          capturesRef.current.push(capture.descriptor);
          await pause(500);
          break;
        }
        await pause(250);
      }
      if (stopRef.current) return;
    }

    setPhase('saving');
    setLive('Saving…');
    closeCamera(videoRef.current);
    const result = await enrollFaceLock(capturesRef.current);
    toast(result);
    setPhase('idle');
    setLive('');
    if (result.ok) setStatus(await faceLockStatus());
  }

  function cancel() {
    stopRef.current = true;
    closeCamera(videoRef.current);
    setPhase('idle');
    setLive('');
  }

  async function remove() {
    if (await confirm({ title: 'Remove face lock?', message: 'Sign-in goes back to email and password only.', confirmLabel: 'Remove' })) {
      const result = await removeFaceLock();
      toast(result);
      if (result.ok) setStatus(await faceLockStatus());
    }
  }

  const busy = phase !== 'idle';

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title">Set a Face Lock</h2>
          <p className="mt-1 max-w-lg text-body-sm text-fg-muted">
            Sign in to the panel with your face. The camera runs only in your browser — no photo is ever uploaded, just an unrecognisable numeric signature.
          </p>
        </div>
        {status?.enrolled && !busy ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-caption font-semibold text-accent-pressed">
            <Icon name="check" className="h-3.5 w-3.5" />
            Face lock is on
          </span>
        ) : null}
      </div>

      {/* Camera stage */}
      <div className={`mt-5 ${busy ? '' : 'hidden'}`}>
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-ink">
          {/* Mirrored like a mirror — turning left moves you left on screen. */}
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full -scale-x-100 object-cover" />
          {phase === 'capturing' ? (
            <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-4 py-3 text-center">
              <p className="text-[13px] font-semibold text-white">{POSES[step].title}</p>
              <p className="mt-0.5 text-[11.5px] text-white/70">{live || POSES[step].hint}</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/60">
              <p className="text-[13px] font-semibold text-white">{live || 'Starting…'}</p>
            </div>
          )}
        </div>

        {/* Pose progress */}
        <div className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2">
          {POSES.map((p, i) => (
            <span
              key={p.pose}
              className={`h-1.5 flex-1 rounded-full ${
                phase === 'saving' || i < step ? 'bg-accent' : i === step && phase === 'capturing' ? 'bg-accent/50' : 'bg-paper-200'
              }`}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn-outline" onClick={cancel} disabled={phase === 'saving'}>
            Cancel
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      {!busy ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-accent" onClick={start}>
            <Icon name="scan" className="h-4 w-4" />
            {status?.enrolled ? 'Redo face capture' : 'Set up face lock'}
          </button>
          {status?.enrolled ? (
            <button type="button" className="btn-outline" onClick={remove}>
              Remove face lock
            </button>
          ) : null}
          {status?.enrolled && status.lastUsedAt ? (
            <span className="text-caption text-fg-subtle">
              Last used {new Date(status.lastUsedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          ) : null}
        </div>
      ) : null}

      {!busy && !status?.enrolled ? (
        <p className="mt-3 text-caption text-fg-subtle">
          You&rsquo;ll be guided through three quick captures — front, left, and right — so the lock knows your face from every angle.
        </p>
      ) : null}
    </div>
  );
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
