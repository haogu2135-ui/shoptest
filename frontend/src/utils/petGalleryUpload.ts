const PET_GALLERY_SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
]);

export const isSupportedPetGalleryImageFile = (file: Pick<File, 'type'>): boolean => {
  const normalizedType = String(file.type || '').trim().toLowerCase();
  return PET_GALLERY_SUPPORTED_IMAGE_TYPES.has(normalizedType);
};
