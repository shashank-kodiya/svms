import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function cloudinaryReady() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
  if (!configured) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true
    });
    configured = true;
  }
  return true;
}

// Uploads an image held in memory. Large photos are scaled down to 1200 px wide.
export function uploadImage(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId) {
  if (!publicId || !cloudinaryReady()) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('Cloudinary delete failed:', err.message);
  }
}
