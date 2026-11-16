/**
 * A picked photo as something FormData can send.
 * expo-file-system's File is a real Blob backed by the file on disk, so nothing is copied through base64 (this is what the
 * "Response.blob() is slow" warning was about). If the build predates that, fall back to fetch().blob(), and make sure the part
 * carries an image type: the server also checks the file's own bytes, so a missing label can no longer cause a refusal.
 */
const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

export function mimeFor(uri: string, hint?: string | null): string {
  if (hint && hint.startsWith('image/')) return hint;
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'image/jpeg';
}

export function extFor(mime: string): string {
  return mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
}

export async function imagePart(uri: string, mimeHint?: string | null): Promise<{ part: Blob; name: string }> {
  const mime = mimeFor(uri, mimeHint);
  const name = `photo.${extFor(mime)}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system');
    const file = new File(uri);
    if (file && typeof file.size === 'number' && file.size > 0) return { part: file as Blob, name };
  } catch { /* older build: use the fallback below */ }
  const blob = await (await fetch(uri)).blob();
  return { part: blob.type ? blob : blob.slice(0, blob.size, mime), name };
}
