/**
 * Encodes a MongoDB ObjectID into a URL-safe base64 string
 * @param {string} id - MongoDB ObjectID as string
 * @returns {string} Base64 encoded ID
 */
export const encodeId = (id) => {
  if (!id) return null;
  // Convert the ID string to Base64
  return btoa(id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Decodes a base64 encoded ID back to a MongoDB ObjectID string
 * @param {string} encodedId - Base64 encoded ID
 * @returns {string} MongoDB ObjectID as string
 */
export const decodeId = (encodedId) => {
  if (!encodedId) return null;
  // Convert back from Base64 to string
  try {
    const base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  } catch (e) {
    console.error('Error decoding ID:', e);
    return encodedId; // Return original if decoding fails
  }
}; 