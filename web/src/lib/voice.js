// The ambient agent's ears. Web Speech API on the desktop (zero setup in Chrome)
// turns "put that in taxes" into a transcript; route() turns the transcript into
// a destination. It is suggestive, never destructive — it pre-fills the focused
// card; the human confirms. (bonsai: "the interruption is the safety architecture.")
// Local Whisper is the milestone-3 upgrade behind this same callback shape.

export function supported() {
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createListener({ onTranscript, onState } = {}) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return { start() {}, stop() {}, supported: false };

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  let on = false;

  rec.onresult = (e) => {
    let finalText = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
    }
    if (finalText.trim()) onTranscript?.(finalText.trim());
  };
  rec.onend = () => { if (on) { try { rec.start(); } catch {} } }; // auto-restart while listening
  rec.onerror = () => onState?.("error");

  return {
    supported: true,
    start() { on = true; try { rec.start(); onState?.("listening"); } catch {} },
    stop() { on = false; try { rec.stop(); } catch {} onState?.("idle"); },
  };
}
