import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'pfbxognr',
  api_key: process.env.CLOUDINARY_API_KEY || '965964265717522',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'p7J5cC6DnKwdaV2-eTwate2dbKE',
  secure: true,
});

/**
 * Optimizes student delivery by face-cropping to square aspect ratio and applying auto-format and auto-quality
 */
export function getOptimizedStudentPhotoUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    crop: 'thumb',
    gravity: 'face',
    width: 500,
    height: 500,
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
  });
}

export { cloudinary };
