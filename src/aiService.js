import OpenAI from "openai";

let openaiClient = null;

export function setApiKey(apiKey) {
  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export function isConfigured() {
  return openaiClient !== null;
}

export async function generateImage(prompt, size = "1024x1024") {
  if (!openaiClient) {
    throw new Error("API key not configured. Please set your OpenAI API key.");
  }

  try {
    const response = await openaiClient.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "b64_json",
    });

    const base64Data = response.data[0].b64_json;
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
