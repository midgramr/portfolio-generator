import { useEffect, useId, useRef, useState } from "react";
import { setApiKey, isConfigured, generateImage } from "./aiService";
import { renderToStaticMarkup } from "react-dom/server";
import "./App.css";

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

function App() {
  const [events, setEvents] = useState([newEvent()]);
  const [preview, setPreview] = useState(false);
  const [apiKey, setApiKeyState] = useState(() => {
    const savedKey = localStorage.getItem("openai_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
    return savedKey || "";
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  function saveApiKey(key) {
    localStorage.setItem("openai_api_key", key);
    setApiKeyState(key);
    setApiKey(key);
    setShowApiKeyModal(false);
  }
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrc = useRef(null);

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
.preview-name{font-family:'Cormorant Garamond',serif;font-size:1.75rem;font-weight:600;margin:0 0 0.4rem}
.preview-desc{color:var(--muted);margin:0 0 1rem;line-height:1.6;font-size:0.9rem}
.preview-media{max-width:100%;border-radius:4px;margin-bottom:1rem}
audio{width:100%;margin-bottom:1rem}
video{max-width:100%;border-radius:4px;margin-bottom:1rem}
.muted{color:var(--muted);font-size:0.85rem}
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
      <div className="api-key-header">
        <button
          className="btn btn-ghost"
          onClick={() => setShowApiKeyModal(true)}
        >
          {isConfigured() ? "Update API Key" : "Set API Key"}
        </button>
        {isConfigured() && <span className="muted">API key configured</span>}
      </div>
      {showApiKeyModal && (
        <ApiKeyModal
          currentKey={apiKey}
          onSave={saveApiKey}
          onClose={() => setShowApiKeyModal(false)}
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

// Used only for export — accepts mediaDataUrl instead of a File object
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
      <div className="timeline-date">{date}</div>
      <p className="preview-name">{name || "Untitled"}</p>
      <p className="preview-desc">{desc}</p>
      {media}
    </div>
  );
}

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
      <div className="timeline-date">{event.date || "No date"}</div>
      <p className="preview-name">{event.name || "Untitled"}</p>
      <p className="preview-desc">{event.desc || "No description."}</p>
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
  );
}

function EventForm({ event, onChange }) {
  const formId = useId();
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const name = e.target.name.substr(e.target.name.indexOf("-") + 1);
    let updated = { ...event, [name]: e.target.value };
    if (name === "mediaType" && e.target.value !== event.mediaType) {
      updated = { ...updated, mediaFile: null };
    }
    onChange(updated);
  }

  function handleFileUpload(e) {
    onChange({ ...event, mediaFile: e.target.files[0] });
  }

  async function handleAiGenerate() {
    if (!isConfigured()) {
      setError("Please set your OpenAI API key first");
      return;
    }

    if (!aiPrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const file = await generateImage(aiPrompt);
      onChange({ ...event, mediaFile: file });
      setAiPrompt("");
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
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
      {event.mediaType === "image" && (
        <div className="field">
          <label className="label">AI Generate Image</label>
          <div className="ai-generate-controls">
            <input
              className="text-input ai-prompt-input"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              disabled={generating}
            />
            <button
              className="btn btn-primary"
              onClick={handleAiGenerate}
              disabled={generating || !aiPrompt.trim()}
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
          {error && <span className="error-message">{error}</span>}
        </div>
      )}
    </>
  );
}

function ApiKeyModal({ currentKey, onSave, onClose }) {
  const [key, setKey] = useState(currentKey);

  function handleSave() {
    if (key.trim()) {
      onSave(key.trim());
    }
  }

  return (
    <div className="modal-overlay">
      <div className="card modal-card">
        <h2>OpenAI API Key</h2>
        <p className="muted modal-text">
          Enter your OpenAI API key to enable AI image generation. Get your key
          at: https://platform.openai.com/api-keys
        </p>
        <div className="field">
          <input
            className="text-input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
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
