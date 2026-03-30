import { useState, useId } from "react";

// High-level idea: create a single page with a 'edit' and 'preview' mode

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
      events.map((event, i) => (i == idx ? updated : event)),
    );
  }

  function togglePreview() {
    setPreview((p) => !p);
  }

  return (
    <div>
      {events.map((event, i) =>
        preview ? (
          <EventPreview key={i} event={event} />
        ) : (
          <EventForm
            key={i}
            event={event}
            onChange={(event) => updateEvent(event, i)}
          />
        ),
      )}
      {!preview && <button onClick={addEvent}>Add event</button>}
      <button onClick={togglePreview}>Toggle preview</button>
    </div>
  );
}

function EventPreview({ event }) {
  function renderMedia() {
    const mediaUrl = event.mediaFile
      ? URL.createObjectURL(event.mediaFile)
      : null;
    if (mediaUrl) {
      return event.mediaType === "image" ? (
        <img src={mediaUrl} />
      ) : event.mediaType === "audio" ? (
        <audio src={mediaUrl} controls />
      ) : (
        <video src={mediaUrl} width='800px' controls />
      );
    } else {
      return <div>No media uploaded.</div>;
    }
  }

  const media = renderMedia();
  return (
    <div style={{ padding: "2rem", border: "1px solid black" }}>
      <div>Name: {event.name}</div>
      <div>Description: {event.desc}</div>
      {media}
    </div>
  );
}

function EventForm({ event, onChange }) {
  const formId = useId();

  function handleChange(e) {
    const name = e.target.name.substr(e.target.name.indexOf("-") + 1);
    let updated = { ...event, [name]: e.target.value };
    if (name == "mediaType" && e.target.value != event.mediaType) {
      updated = { ...updated, mediaFile: null };
    }
    onChange(updated);
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    onChange({ ...event, mediaFile: file });
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.substr(1);
  }

  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: "1rem",
        border: "1px solid black",
        marginBottom: "1rem",
      }}
    >
      <div>
        Name:
        <input
          name={`${formId}-name`}
          value={event.name}
          onChange={handleChange}
        />
      </div>
      <div>
        Description:
        <input
          name={`${formId}-desc`}
          value={event.desc}
          onChange={handleChange}
        />
      </div>
      <div>
        Media Type:
        <div>
          {["image", "audio", "video"].map((type, i) => (
            <span key={i}>
              <input
                type="radio"
                id={`${formId}-${type}`}
                name={`${formId}-mediaType`}
                value={type}
                checked={event.mediaType === type}
                onChange={handleChange}
              />
              <label htmlFor={`${formId}-${type}`}>{capitalize(type)}</label>
            </span>
          ))}
        </div>
      </div>
      <div>
        <button>
          <label htmlFor={`${formId}-mediaFile`}>Upload</label>
        </button>
        <input
          type="file"
          accept={`${event.mediaType}/*`}
          id={`${formId}-mediaFile`}
          name="mediaFile"
          onChange={handleFileUpload}
          style={{ opacity: 0 }}
        />
        <div>{event.mediaFile?.name ?? "No file selected"}</div>
      </div>
    </div>
  );
}

export default App;
