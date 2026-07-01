// Voice-note recorder for the phone. Captures the audio blob (the archived note)
// as a data URL. Runs alongside the Web Speech transcript (see voice.js) — the
// audio is the keepsake, the transcript is what the hub routes on. Fully
// graceful: if the mic is denied, stop() returns null and the flow still works
// (empty transcript → keep, or a manual Keep/Kill button).

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export async function startAudioRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return { ok: false, async stop() { return null; } };
  }
  const chunks = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    ok: true,
    async stop() {
      return new Promise((resolve) => {
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (!chunks.length) return resolve(null);
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          resolve(await blobToDataUrl(blob));
        };
        try { rec.stop(); } catch { resolve(null); }
      });
    },
  };
}
