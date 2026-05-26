import * as ImagePicker from 'expo-image-picker';

/** Launches the camera and returns the captured photo, or null if denied/cancelled. */
export async function capturePhoto(): Promise<{ uri: string; mimeType: string } | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}
