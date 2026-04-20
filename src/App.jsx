import { useEffect, useId, useRef, useState } from "react";
import "./App.css";

function newEvent() {
  return { name: "", desc: "", mediaType: "image", mediaFile: null };
}

function App() {
  const [events, setEvents] = useState([newEvent()]);
  const [preview, setPreview] = useState(false);

  function addEvent() {
    setEvents((events) => [...events, newEvent()]);
  }

  function updateEvent(updated, idx) {
    setEvents((events) =>
      events.map((event, i) => (i === idx ? updated : event)),
    );
  }

  return (
    <div className="app">
      <h1>Portfolio Builder</h1>
      {events.map((event, i) =>
        preview ? (
          <EventPreview key={i} event={event} />
        ) : (
          <EventForm
            key={i}
            event={event}
            onChange={(updated) => updateEvent(updated, i)}
          />
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
      </div>
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
    <div className="card">
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

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.substr(1);
  }

  return (
    <div className="card">
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
      <div
        className="field"
        style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
      >
        <label
          className="btn btn-ghost"
          htmlFor={`${formId}-mediaFile`}
          style={{ cursor: "pointer" }}
        >
          Upload
        </label>
        <input
          type="file"
          accept={`${event.mediaType}/*`}
          id={`${formId}-mediaFile`}
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <span className="muted">
          {event.mediaFile?.name ?? "No file selected"}
        </span>
      </div>
    </div>
  );
}

export default App;
