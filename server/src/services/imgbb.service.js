export async function uploadSelfieToImgBB(imageInput, name = 'geoattend-selfie') {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    throw new Error('IMGBB_API_KEY is not configured on server');
  }

  // Strip "data:image/png;base64," or "data:image/jpeg;base64," if present
  const base64Clean =
    typeof imageInput === 'string' && imageInput.includes(',')
      ? imageInput.split(',')[1]
      : imageInput;

  const formData = new URLSearchParams();
  formData.append('key', apiKey);
  formData.append('image', base64Clean);
  formData.append('name', name);

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message || 'ImgBB upload failed');
  }

  return {
    url: payload.data.display_url || payload.data.url,
    deleteUrl: payload.data.delete_url,
  };
}