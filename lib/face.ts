'use client';

// Face capture, entirely in the browser.
//
// face-api.js runs its models locally against the webcam stream — no frame
// ever leaves the machine. What comes out is a 128-number descriptor (a
// mathematical signature of the face), which is all the server ever sees.
//
// Loaded lazily: the ~6MB of model weights only download on the pages that
// actually open a camera.

export type Pose = 'front' | 'left' | 'right';

export type Capture = { descriptor: number[]; yaw: number };

type FaceApi = typeof import('@vladmandic/face-api');

let api: FaceApi | null = null;
let loaded = false;

export async function loadFaceModels(): Promise<FaceApi> {
  if (!api) api = await import('@vladmandic/face-api');
  if (!loaded) {
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri('/models'),
      api.nets.faceLandmark68Net.loadFromUri('/models'),
      api.nets.faceRecognitionNet.loadFromUri('/models'),
    ]);
    loaded = true;
  }
  return api;
}

/** Open the webcam. Throws a readable message when there is no usable camera. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot open a camera. Use a recent Chrome, Edge or Safari.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new Error('No camera was found on this device.');
    }
    if (name === 'NotAllowedError') {
      throw new Error('Camera access was blocked. Allow the camera for this site and try again.');
    }
    throw new Error('The camera could not be started. Close other apps using it and try again.');
  }
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function closeCamera(video: HTMLVideoElement | null) {
  const stream = video?.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}

/**
 * Read one face from the current video frame.
 *
 * `yaw` is a left/right head-turn estimate from the landmarks: ~0 facing the
 * camera, negative turned to the person's left, positive to their right.
 * Returns null when no face is confidently in frame.
 */
export async function captureFace(video: HTMLVideoElement): Promise<Capture | null> {
  const faceapi = await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;

  const { landmarks } = result;
  const nose = landmarks.getNose()[3];
  const leftEye = average(landmarks.getLeftEye());
  const rightEye = average(landmarks.getRightEye());
  const midX = (leftEye.x + rightEye.x) / 2;
  const interocular = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) || 1;
  const yaw = (nose.x - midX) / interocular;

  return { descriptor: Array.from(result.descriptor), yaw };
}

/** Does this capture match the pose we asked for? */
export function matchesPose(pose: Pose, yaw: number): boolean {
  if (pose === 'front') return Math.abs(yaw) < 0.18;
  // The preview is mirrored, so turning YOUR left moves the nose to +x.
  if (pose === 'left') return yaw > 0.22;
  return yaw < -0.22;
}

function average(points: { x: number; y: number }[]): { x: number; y: number } {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
