import { useEffect, useId, useRef, useState } from "react";
import {
  setApiKey,
  isConfigured,
  generateImage,
  generateAudio,
  generateVideo,
  OPENAI_TTS_VOICES,
  moderateUploadedImage,
  moderateUploadedVideo,
} from "./aiService";
import { renderToStaticMarkup } from "react-dom/server";
import "./App.css";

const ENV_OPENAI_API_KEY = (import.meta.env.VITE_OPENAI_API_KEY || "").trim();

function newEvent() {
  return { name: "", desc: "", date: "", mediaType: "image", mediaFile: null };
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [events, setEvents] = useState([newEvent()]);
  const [preview, setPreview] = useState(false);

  // OpenAI key
  const [apiKey, setApiKeyState] = useState(() => {
    const saved = localStorage.getItem("openai_api_key") || "";
    const configuredKey = ENV_OPENAI_API_KEY || saved;
    if (configuredKey) setApiKey(configuredKey);
    return configuredKey;
  });
  const [showOpenAIModal, setShowOpenAIModal] = useState(false);

  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrc = useRef(null);

  function saveOpenAIKey(key) {
    localStorage.setItem("openai_api_key", key);
    setApiKeyState(key);
    setApiKey(key);
    setShowOpenAIModal(false);
  }

  function addEvent() {
    setEvents((e) => [...e, newEvent()]);
  }
  function deleteEvent(idx) {
    setEvents((e) => e.filter((_, i) => i !== idx));
  }
  function updateEvent(updated, idx) {
    setEvents((e) => e.map((ev, i) => (i === idx ? updated : ev)));
  }

  function handleDragStart(idx) {
    dragSrc.current = idx;
  }
  function handleDrop(idx) {
    if (dragSrc.current === null || dragSrc.current === idx) return;
    setEvents((e) => {
      const next = [...e];
      const [moved] = next.splice(dragSrc.current, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragSrc.current = null;
    setDragOverIdx(null);
  }

  async function exportHTML() {
    const eventsWithData = await Promise.all(
      events.map(async (ev) => {
        if (!ev.mediaFile) return ev;
        return { ...ev, mediaDataUrl: await fileToDataUrl(ev.mediaFile) };
      }),
    );

    const body = renderToStaticMarkup(
      <div className="timeline">
        {eventsWithData.map((ev, i) => (
          <ExportItem key={i} event={ev} />
        ))}
      </div>,
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Portfolio</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#f7f5f2;--surface:#fff;--border:#e2ddd8;--text:#1a1918;--muted:#6f6b66;--accent:#2e5e4e}
body{margin:0;background:var(--bg);font-family:'Jost',sans-serif;color:var(--text)}
.wrap{max-width:660px;margin:0 auto;padding:3rem 1.5rem}
h1{font-family:'Cormorant Garamond',serif;font-size:2.25rem;font-weight:600;margin:0 0 2rem;letter-spacing:-0.01em}
.timeline{position:relative;padding-left:2rem}
.timeline::before{content:'';position:absolute;left:0.5rem;top:0.5rem;bottom:0.5rem;width:1px;background:var(--border)}
.timeline-item{position:relative;margin-bottom:2.25rem}
.timeline-dot{position:absolute;left:-1.625rem;top:0.5rem;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--bg)}
.preview-layout{display:grid;grid-template-columns:1.2fr 1fr;gap:1rem;align-items:start}
.preview-media-col{min-height:80px}
.preview-name{font-family:'Cormorant Garamond',serif;font-size:1.75rem;font-weight:600;margin:0 0 0.4rem}
.preview-desc{color:var(--muted);margin:0 0 1rem;line-height:1.6;font-size:0.9rem}
.preview-media{max-width:100%;border-radius:4px;margin-bottom:1rem}
audio{width:100%;margin-bottom:1rem}
video{max-width:100%;border-radius:4px;margin-bottom:1rem}
.muted{color:var(--muted);font-size:0.85rem}
@media (max-width:720px){.preview-layout{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
<h1>Portfolio</h1>
${body}
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <h1>Portfolio Builder</h1>

      {/* API key controls */}
      <div className="api-keys-bar">
        <button
          className="btn btn-ghost"
          onClick={() => setShowOpenAIModal(true)}
        >
          {isConfigured() ? "Update OpenAI Key" : "Set OpenAI Key"}
        </button>
        {isConfigured() && (
          <span className="api-badge api-badge-openai">✓ OpenAI</span>
        )}
      </div>

      {showOpenAIModal && (
        <ApiKeyModal
          title="OpenAI API Key"
          description="Required for DALL-E 3 image generation. Get yours at platform.openai.com/api-keys"
          placeholder="sk-..."
          currentKey={apiKey}
          onSave={saveOpenAIKey}
          onClose={() => setShowOpenAIModal(false)}
        />
      )}

      {events.map((event, i) =>
        preview ? (
          <EventPreview key={i} event={event} />
        ) : (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIdx(i);
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={() => handleDrop(i)}
            className={`card${dragOverIdx === i ? " drag-over" : ""}`}
          >
            <div className="card-header">
              <span>⠿ drag to reorder</span>
              <button className="btn-danger" onClick={() => deleteEvent(i)}>
                Delete
              </button>
            </div>
            <EventForm
              event={event}
              onChange={(updated) => updateEvent(updated, i)}
            />
          </div>
        ),
      )}

      <div className="actions">
        {!preview && (
          <button className="btn btn-ghost" onClick={addEvent}>
            + Add event
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "Edit" : "Preview"}
        </button>
        <button className="btn btn-ghost" onClick={exportHTML}>
          Export HTML
        </button>
      </div>
    </div>
  );
}

// ─── Export helper ────────────────────────────────────────────────────────────

function ExportItem({ event }) {
  const { name, desc, date, mediaType, mediaDataUrl } = event;

  let media = null;
  if (mediaDataUrl) {
    if (mediaType === "image")
      media = <img src={mediaDataUrl} className="preview-media" />;
    else if (mediaType === "audio")
      media = <audio src={mediaDataUrl} controls />;
    else
      media = <video src={mediaDataUrl} controls className="preview-media" />;
  }

  return (
    <div className="timeline-item">
      <div className="timeline-dot" />
      <div className="preview-layout">
        <div>
          <div className="timeline-date">{date}</div>
          <p className="preview-name">{name || "Untitled"}</p>
          <p className="preview-desc">{desc}</p>
        </div>
        <div className="preview-media-col">
          {media || <span className="muted">No media uploaded.</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function EventPreview({ event }) {
  const mediaUrlRef = useRef(null);
  const mediaElementRef = useRef(null);

  useEffect(() => {
    if (!event.mediaFile) return;
    mediaUrlRef.current = URL.createObjectURL(event.mediaFile);
    mediaElementRef.current.src = mediaUrlRef.current;
    return () => URL.revokeObjectURL(mediaUrlRef.current);
  }, [event]);

  return (
    <div className="timeline-item">
      <div className="timeline-dot" />
      <div className="preview-layout">
        <div>
          <div className="timeline-date">{event.date || "No date"}</div>
          <p className="preview-name">{event.name || "Untitled"}</p>
          <p className="preview-desc">{event.desc || "No description."}</p>
        </div>
        <div className="preview-media-col">
          {event.mediaFile ? (
            event.mediaType === "image" ? (
              <img ref={mediaElementRef} className="preview-media" />
            ) : event.mediaType === "audio" ? (
              <audio ref={mediaElementRef} controls />
            ) : (
              <video ref={mediaElementRef} className="preview-media" controls />
            )
          ) : (
            <span className="muted">No media uploaded.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event Form ───────────────────────────────────────────────────────────────

function EventForm({ event, onChange }) {
  const formId = useId();
  const [uploadError, setUploadError] = useState("");

  function handleChange(e) {
    const name = e.target.name.substr(e.target.name.indexOf("-") + 1);
    let updated = { ...event, [name]: e.target.value };
    if (name === "mediaType" && e.target.value !== event.mediaType) {
      updated = { ...updated, mediaFile: null };
    }
    onChange(updated);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError("");

    const runModeration = async () => {
      try {
        if (event.mediaType === "image") {
          await moderateUploadedImage(file);
        } else if (event.mediaType === "video") {
          await moderateUploadedVideo(file);
        }

        onChange({ ...event, mediaFile: file });
      } catch (error) {
        setUploadError(error.message);
        onChange({ ...event, mediaFile: null });
        e.target.value = "";
      }
    };

    void runModeration();
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.substr(1);
  }

  return (
    <>
      <div className="field">
        <label className="label" htmlFor={`${formId}-name`}>
          Name
        </label>
        <input
          className="text-input"
          id={`${formId}-name`}
          name={`${formId}-name`}
          value={event.name}
          onChange={handleChange}
          placeholder="Event name"
        />
      </div>
      <div className="field">
        <label className="label" htmlFor={`${formId}-date`}>
          Date
        </label>
        <input
          className="text-input"
          id={`${formId}-date`}
          name={`${formId}-date`}
          type="date"
          value={event.date}
          onChange={handleChange}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor={`${formId}-desc`}>
          Description
        </label>
        <input
          className="text-input"
          id={`${formId}-desc`}
          name={`${formId}-desc`}
          value={event.desc}
          onChange={handleChange}
          placeholder="Short description"
        />
      </div>
      <div className="field">
        <span className="label">Media Type</span>
        <div className="radio-group">
          {["image", "audio", "video"].map((type) => (
            <label key={type} className="radio-label">
              <input
                type="radio"
                name={`${formId}-mediaType`}
                value={type}
                checked={event.mediaType === type}
                onChange={handleChange}
              />
              {capitalize(type)}
            </label>
          ))}
        </div>
      </div>

      <div className="field upload-row">
        <label className="btn btn-ghost" htmlFor={`${formId}-mediaFile`}>
          Upload
        </label>
        <input
          type="file"
          accept={`${event.mediaType}/*`}
          id={`${formId}-mediaFile`}
          onChange={handleFileUpload}
          className="file-input-hidden"
        />
        <span className="muted">
          {event.mediaFile?.name ?? "No file selected"}
        </span>
      </div>

      {uploadError && <p className="error-message">{uploadError}</p>}

      {/* AI Generation panel — shown for all media types */}
      <AIGeneratePanel
        mediaType={event.mediaType}
        onGenerated={(file) => onChange({ ...event, mediaFile: file })}
      />

      <InlineMediaPreview
        mediaFile={event.mediaFile}
        mediaType={event.mediaType}
      />
    </>
  );
}

function InlineMediaPreview({ mediaFile, mediaType }) {
  const [mediaUrl, setMediaUrl] = useState("");

  useEffect(() => {
    if (!mediaFile) {
      setMediaUrl("");
      return;
    }

    const url = URL.createObjectURL(mediaFile);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  if (!mediaUrl) return null;

  return (
    <div className="field">
      <span className="label">Embedded Preview</span>
      {mediaType === "image" ? (
        <img src={mediaUrl} className="preview-media" alt="Generated preview" />
      ) : mediaType === "audio" ? (
        <audio src={mediaUrl} controls />
      ) : (
        <video src={mediaUrl} controls className="preview-media" />
      )}
    </div>
  );
}

// ─── AI Generate Panel ────────────────────────────────────────────────────────

function AIGeneratePanel({ mediaType, onGenerated }) {
  const [prompt, setPrompt] = useState("");
  const [ttsVoice, setTtsVoice] = useState("alloy");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");
    setStatus("");

    if (!isConfigured()) {
      setError("Please set your OpenAI API key first.");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    setGenerating(true);

    try {
      let file;

      if (mediaType === "image") {
        setStatus("Generating with DALL-E 3…");
        file = await generateImage(prompt);
      } else if (mediaType === "audio") {
        setStatus("Generating speech with OpenAI TTS…");
        file = await generateAudio(prompt, ttsVoice);
      } else {
        setStatus(
          "Starting OpenAI video generation… this may take a few minutes ☕",
        );
        file = await generateVideo(prompt);
      }

      onGenerated(file);
      setPrompt("");
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    } finally {
      setGenerating(false);
    }
  }

  const promptLabel =
    mediaType === "audio" ? "Text to speak" : "Describe what to generate";

  const promptPlaceholder =
    mediaType === "audio"
      ? "Enter the text you want spoken aloud…"
      : mediaType === "video"
        ? "A slow pan over a misty mountain valley at sunrise…"
        : "A vibrant abstract painting of neural networks…";

  return (
    <div className="field">
      <span className="label">AI Generate</span>

      {mediaType === "audio" && (
        <div className="field" style={{ marginBottom: "0.75rem" }}>
          <label className="label">Voice</label>
          <select
            className="select-input"
            value={ttsVoice}
            onChange={(e) => setTtsVoice(e.target.value)}
            disabled={generating}
          >
            {OPENAI_TTS_VOICES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ai-generate-controls">
        <input
          className="text-input ai-prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={promptPlaceholder}
          disabled={generating}
        />
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
        >
          {generating ? "…" : "Generate"}
        </button>
      </div>

      {mediaType === "video" && (
        <p className="info-note">
          OpenAI video generation can take a few minutes. The page will wait
          automatically.
        </p>
      )}

      {/* Status / spinner */}
      {status && (
        <div className="generation-status">
          <span className="spinner" />
          {status}
        </div>
      )}

      {/* Error */}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

// ─── Generic API Key Modal ────────────────────────────────────────────────────

function ApiKeyModal({ title, description, placeholder, currentKey, onSave, onClose }) {
  const [key, setKey] = useState(currentKey);

  function handleSave() {
    if (key.trim()) onSave(key.trim());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p className="muted modal-text">{description}</p>
        <div className="field">
          <input
            className="text-input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
