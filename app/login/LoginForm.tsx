'use client';

import { useRef, useState } from 'react';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';
import { faceLogin } from '@/lib/actions/faceLock';
import { captureFace, closeCamera, loadFaceModels, openCamera } from '@/lib/face';
import { Icon } from '@/components/Icon';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [faceLive, setFaceLive] = useState('');
  const [faceError, setFaceError] = useState('');

  /**
   * Face sign-in: the camera runs locally, the face is reduced to a numeric
   * signature in this browser, and the server checks it against the enrolled
   * face for the typed email. Email + password stays right above as the
   * everyday alternative.
   */
  async function signInWithFace() {
    setFaceError('');
    const email = (document.getElementById('email') as HTMLInputElement | null)?.value.trim().toLowerCase();
    if (!email) {
      setFaceError('Type your email first, then use the face lock.');
      return;
    }
    setFaceOpen(true);
    stopRef.current = false;
    try {
      setFaceLive('Loading the face model…');
      await loadFaceModels();
      if (!videoRef.current) return;
      setFaceLive('Starting the camera…');
      await openCamera(videoRef.current);
      setFaceLive('Look at the camera…');

      // A few PACED attempts — one request per fresh capture, never a flood.
      // (An earlier version retried every half-second and tripped the API's
      // rate limit on its own first attempt.)
      const MAX_ATTEMPTS = 6;
      let attempts = 0;
      let lastMessage = '';
      while (!stopRef.current && attempts < MAX_ATTEMPTS) {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }
        const capture = await captureFace(video);
        if (!capture) {
          setFaceLive('No face in frame — come a little closer.');
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        attempts += 1;
        setFaceLive('Checking…');
        const result = await faceLogin(email, capture.descriptor);
        if (result.ok) {
          closeCamera(videoRef.current);
          window.location.assign('/');
          return;
        }
        lastMessage = result.message ?? '';
        // The API said stop — repeating would only extend the lockout.
        if (/too many/i.test(lastMessage)) break;
        setFaceLive(`Not recognised yet — hold still… (${attempts}/${MAX_ATTEMPTS})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!stopRef.current) {
        setFaceError(
          /too many/i.test(lastMessage)
            ? lastMessage
            : 'Face not recognised. Sign in with your password, or redo the face capture in Settings.',
        );
      }
    } catch (err) {
      setFaceError(err instanceof Error ? err.message : 'The camera could not be started.');
    } finally {
      closeCamera(videoRef.current);
      setFaceOpen(false);
      setFaceLive('');
    }
  }

  function cancelFace() {
    stopRef.current = true;
    closeCamera(videoRef.current);
    setFaceOpen(false);
    setFaceLive('');
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="field-input py-3"
          placeholder="you@10xdrink.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="field-input py-3 pr-11"
            placeholder="Your password"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-paper-100 hover:text-fg"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-body-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending || faceOpen} className="btn-accent w-full py-3 text-body font-semibold">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-paper-200" />
        <span className="text-caption text-fg-subtle">or</span>
        <span className="h-px flex-1 bg-paper-200" />
      </div>

      {faceOpen ? (
        <div>
          <div className="relative w-full overflow-hidden rounded-xl bg-ink">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full -scale-x-100 object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-4 py-2.5 text-center">
              <p className="text-[12.5px] font-semibold text-white">{faceLive || 'Starting…'}</p>
            </div>
          </div>
          <button type="button" onClick={cancelFace} className="btn-outline mt-3 w-full py-2.5 text-body-sm font-semibold">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={signInWithFace}
          disabled={pending}
          className="btn-outline flex w-full items-center justify-center gap-2 py-3 text-body font-semibold"
        >
          <Icon name="scan" className="h-4 w-4" />
          Sign in with your face
        </button>
      )}

      {faceError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-body-sm text-danger">
          {faceError}
        </p>
      ) : null}
    </form>
  );
}
