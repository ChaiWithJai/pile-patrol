// Voice-note recorder for the phone. Captures the audio blob (the archived note)
// as a data URL. Runs alongside the Web Speech transcript (see voice.js) — the
// audio is the keepsake, the transcript is what the hub routes on.
//
// Permission is requested ONCE, upfront (requestMic(), called from the
// enable-camera-and-mic gate) — never lazily on the first shutter press.
// Asking mid-gesture is what broke the flow: the OS permission sheet steals
// the touch, the user's held-down finger effectively "lets go", and nothing
// records. startAudioRecording() takes the already-granted stream and just
// spins up a fresh MediaRecorder on it — no new prompt, ever.

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// Same footgun startCamera() guards against (camera.js): an unanswered
// permission prompt neither resolves nor rejects getUserMedia — race it
// against a timeout so a dismissed/ignored mic prompt degrades to
// "no audio, everything else still works" instead of hanging the gate
// forever and bricking the shutter.
export async function requestMic(timeoutMs = 8000) {
  try {
    return await Promise.race([
      navigator.mediaDevices.getUserMedia({ audio: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("mic permission timed out")), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

// stream: a MediaStream already granted via requestMic(). Its tracks are
// NOT stopped here — the same stream is reused across every note for the
// life of the session; the caller stops it once, on teardown.
export function startAudioRecording(stream) {
  if (!stream) return { ok: false, async stop() { return null; } };
  const chunks = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    ok: true,
    async stop() {
      return new Promise((resolve) => {
        rec.onstop = async () => {
          if (!chunks.length) return resolve(null);
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          resolve(await blobToDataUrl(blob));
        };
        try { rec.stop(); } catch { resolve(null); }
      });
    },
  };
}
