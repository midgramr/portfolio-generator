import { useState } from "react";

// High-level idea: create a single page with a 'edit' and 'preview' mode

function newEvent() {
  return { name: "", desc: "", mediaType: "image", mediaFile: null };
}

function App() {
  const [events, setEvents] = useState([newEvent()]);
  const [editMode, setEditMode] = useState(true);

  function addEvent() {
    setEvents((events) => [...events, newEvent()]);
  }

  function updateEvent(updated, idx) {
    setEvents((events) =>
      events.map((event, i) => (i == idx ? updated : event)),
    );
  }

  return (
    <div>
      {events.map((event, i) =>
        editMode ? (
          <EventForm
            key={i}
            event={event}
            onChange={(event) => updateEvent(event, i)}
          />
        ) : (
          <EventPreview />
        ),
      )}
      <button onClick={addEvent}>Add event</button>
    </div>
  );
}

function EventForm({ event, onChange }) {
  function handleChange(e) {
    onChange({ ...event, [e.target.name]: e.target.value });
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    onChange({ ...event, 'mediaFile': file });
  }

  return (
    <div>
      <div>
        Name:
        <input name="name" value={event.name} onChange={handleChange} />
      </div>
      <div>
        Description:
        <input name="desc" value={event.desc} onChange={handleChange} />
      </div>
      <div>
        Media Type:
        <div>
          <input
            type="radio"
            id={`${event.name}-image`}
            name="mediaType"
            value="image"
            checked={event.mediaType === "image"}
            onChange={handleChange}
          />
          <label htmlFor={`${event.name}-image`}>Image</label>
          <input
            type="radio"
            id={`${event.name}-video`}
            name="mediaType"
            value="video"
            checked={event.mediaType === "video"}
            onChange={handleChange}
          />
          <label htmlFor={`${event.name}-video`}>Video</label>
          <input
            type="radio"
            id={`${event.name}-audio`}
            name="mediaType"
            value="audio"
            checked={event.mediaType === "audio"}
            onChange={handleChange}
          />
          <label htmlFor={`${event.name}-audio`}>Audio</label>
        </div>
      </div>
      <div>
        Upload:
        <input type="file" name="mediaFile" onChange={handleFileUpload} />
      </div>
    </div>
  );
}

function EventPreview({ event }) {}

export default App;
