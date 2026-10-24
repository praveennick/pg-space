const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxInput = 10 * 1024 * 1024;

export async function detectedImageType(file: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  )
    return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not prepare this photo.")),
      "image/jpeg",
      quality,
    ),
  );

export async function prepareProfilePhoto(file: Blob): Promise<Blob> {
  if (!allowed.has(file.type) || file.size > maxInput || !file.size)
    throw new Error("Choose a JPEG, PNG or WebP image under 10 MB.");
  if ((await detectedImageType(file)) !== file.type)
    throw new Error("This file does not match its image type.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 24_000_000
    )
      throw new Error("This image is too large to process.");
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo processing is unavailable in this browser.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let output = await toBlob(canvas, 0.86);
    for (const quality of [0.74, 0.62, 0.5]) {
      if (output.size <= 300_000) break;
      output = await toBlob(canvas, quality);
    }
    if (output.size > 500_000)
      throw new Error("This photo is still too large. Try another image.");
    return output;
  } finally {
    bitmap.close();
  }
}
