/** Resize uploads before storing a self-contained preset snapshot. */
export async function readPresetImage(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8_000_000
  )
    throw new Error("Choose a PNG, JPEG, or WebP image under 8 MB.")
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1920 / image.width, 1080 / image.height)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Could not prepare this image.")
    context.fillStyle = "#000"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL("image/jpeg", 0.82)
    if (result.length > 3_000_000)
      throw new Error("This image is too detailed. Choose a smaller image.")
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}
