/**
 * Profile photos are saved on the server as a path such as /uploads/profile/abc.jpg. A screen has to put the server address in front,
 * and when the server is reached through an ngrok tunnel the request needs a header that skips ngrok's browser warning page
 * (without it the "image" that comes back is a web page, so nothing shows).
 */
import { resolveBaseUrl } from './baseUrl';

export function profileImageSource(value?: string | null): { uri: string; headers?: Record<string, string> } | null {
  if (!value) return null;
  const base = resolveBaseUrl();
  const uri = /^https?:\/\//i.test(value) ? value : `${base}${value.startsWith('/') ? '' : '/'}${value}`;
  return base.includes('ngrok') || uri.includes('ngrok') ? { uri, headers: { 'ngrok-skip-browser-warning': 'true' } } : { uri };
}
