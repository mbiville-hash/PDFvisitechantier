import imageCompression from 'browser-image-compression'

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

async function readUploadResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.secure_url) {
    const message = data.error?.message || `Erreur Cloudinary ${res.status}`
    throw new Error(message)
  }
  return data.secure_url
}

export async function compressAndUpload(file) {
  if (!CLOUD || !PRESET) {
    throw new Error('Configuration Cloudinary manquante')
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.45,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  })

  const form = new FormData()
  form.append('file', compressed)
  form.append('upload_preset', PRESET)
  form.append('folder', 'fortis-visites-sdb')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  })
  return readUploadResponse(res)
}

