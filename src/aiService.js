let openaiApiKey = "";

export function setApiKey(apiKey) {
  openaiApiKey = apiKey;
}

export function isConfigured() {
  return Boolean(openaiApiKey);
}

function assertConfigured() {
  if (!openaiApiKey) {
    throw new Error("API key not configured. Please set your OpenAI API key.");
  }
}

function authHeaders() {
  return openaiApiKey ? { Authorization: `Bearer ${openaiApiKey}` } : {};
}

async function callOpenAI(path, init = {}) {
  const response = await fetch(`/api/openai${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    const message = await readApiError(
      response,
      `OpenAI API error: ${response.status}`,
    );
    throw new Error(message);
  }

  return response;
}

async function moderatePrompt(prompt) {
  assertConfigured();

  const response = await callOpenAI("/moderations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: prompt,
    }),
  });
  const moderation = await response.json();

  const result = moderation?.results?.[0];
  if (result?.flagged) {
    const flaggedCategories = Object.entries(result.categories || {})
      .filter(([, isFlagged]) => isFlagged)
      .map(([category]) => category.replace(/_/g, " "));

    throw new Error(
      flaggedCategories.length
        ? `Prompt blocked by moderation: ${flaggedCategories.join(", ")}.`
        : "Prompt blocked by moderation.",
    );
  }
}

async function moderateImageDataUrl(dataUrl) {
  assertConfigured();

  const response = await callOpenAI("/moderations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
      ],
    }),
  });
  const moderation = await response.json();

  const result = moderation?.results?.[0];
  if (result?.flagged) {
    const flaggedCategories = Object.entries(result.categories || {})
      .filter(([, isFlagged]) => isFlagged)
      .map(([category]) => category.replace(/_/g, " "));

    throw new Error(
      flaggedCategories.length
        ? `Image blocked by moderation: ${flaggedCategories.join(", ")}.`
        : "Image blocked by moderation.",
    );
  }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Failed to read uploaded file."));
    reader.readAsDataURL(file);
  });
}

async function extractVideoFrameDataUrl(file) {
  const videoUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load uploaded video."));
    });

    video.currentTime = 0.1;
    await new Promise((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Failed to seek uploaded video."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to analyze uploaded video frame.");
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

export async function moderateUploadedImage(file) {
  const dataUrl = await fileToDataUrl(file);
  await moderateImageDataUrl(dataUrl);
}

export async function moderateUploadedVideo(file) {
  const frameDataUrl = await extractVideoFrameDataUrl(file);
  await moderateImageDataUrl(frameDataUrl);
}

export async function generateImage(prompt) {
  await moderatePrompt(prompt);
  assertConfigured();

  try {
    const httpResponse = await callOpenAI("/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json",
      }),
    });
    const response = await httpResponse.json();

    const base64Data = response?.data?.[0]?.b64_json;
    if (!base64Data) {
      throw new Error("No image data was returned by the API.");
    }
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: "image/png" });
    const fileName = `ai-generated-${Date.now()}.png`;
    const file = new File([imageBlob], fileName, { type: "image/png" });

    return file;
  } catch (error) {
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

export async function generateAudio(prompt, voice = "alloy") {
  await moderatePrompt(prompt);
  assertConfigured();

  try {
    const response = await callOpenAI("/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: prompt,
        format: "wav",
      }),
    });

    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    return new File([audioBlob], `ai-audio-${Date.now()}.wav`, {
      type: "audio/wav",
    });
  } catch (error) {
    throw new Error(`Failed to generate audio: ${error.message}`);
  }
}

export async function generateVideo(prompt) {
  await moderatePrompt(prompt);
  assertConfigured();

  try {
    const createRes = await fetch("/api/openai/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        model: "sora-2",
        prompt,
        seconds: "4",
        size: "720x1280",
      }),
    });

    if (!createRes.ok) {
      const message = await readApiError(
        createRes,
        `Video generation error: ${createRes.status}`,
      );
      throw new Error(message);
    }

    const created = await createRes.json();
    const videoId = created?.id;
    if (!videoId) {
      throw new Error("Video generation started but no job id was returned.");
    }

    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));

      const pollRes = await fetch(`/api/openai/videos/${videoId}`, {
        headers: {
          ...authHeaders(),
        },
      });
      if (!pollRes.ok) {
        const message = await readApiError(
          pollRes,
          `Video poll error: ${pollRes.status}`,
        );
        throw new Error(message);
      }

      const pollData = await pollRes.json();
      const status = pollData?.status;

      if (status === "failed" || pollData?.error) {
        throw new Error(pollData?.error?.message || "Video generation failed.");
      }

      if (status === "completed") {
        const mediaRes = await fetch(`/api/openai/videos/${videoId}/content`, {
          headers: {
            ...authHeaders(),
          },
        });
        if (!mediaRes.ok) {
          const message = await readApiError(
            mediaRes,
            `Video download failed: ${mediaRes.status}`,
          );
          throw new Error(message);
        }
        const blob = await mediaRes.blob();
        return new File([blob], `ai-video-${Date.now()}.mp4`, {
          type: "video/mp4",
        });
      }
    }

    throw new Error("Video generation timed out. Please try again.");
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Video request failed due to network/proxy connection. Restart the dev server after config changes and try again.",
      );
    }
    throw new Error(`Failed to generate video: ${error.message}`);
  }
}

async function readApiError(response, fallback) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const err = await response.json().catch(() => ({}));
    return err?.error?.message || fallback;
  }

  const text = await response.text().catch(() => "");
  return text || fallback;
}

export const OPENAI_TTS_VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "ash", label: "Ash" },
  { value: "coral", label: "Coral" },
  { value: "echo", label: "Echo" },
  { value: "sage", label: "Sage" },
  { value: "verse", label: "Verse" },
];
