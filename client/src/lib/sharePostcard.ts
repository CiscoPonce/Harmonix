/**
 * Postcard share helpers — PNG + link for Web Share, download, and classic apps.
 */

export type PostcardSharePayload = {
  id: string;
  shareUrl: string;
  title: string;
  caption: string;
  fileName: string;
  file: File | null;
};

export function postcardFileName(wordText: string): string {
  const slug = wordText
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .slice(0, 24);
  return `harmonix-${slug || 'word'}.png`;
}

export async function fetchPostcardPng(
  id: string,
  fileName: string
): Promise<File | null> {
  if (typeof window === 'undefined') return null;
  try {
    const headers: HeadersInit = {};
    if (window.location.hostname.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    const res = await fetch(
      `/api/share/postcards/${encodeURIComponent(id)}/og.png?v=4`,
      { headers, credentials: 'omit' }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
}

export function shareBody(payload: Pick<PostcardSharePayload, 'caption' | 'shareUrl'>): string {
  return `${payload.caption}\n\n${payload.shareUrl}`;
}

export async function copyShareText(
  payload: Pick<PostcardSharePayload, 'caption' | 'shareUrl'>
): Promise<void> {
  await navigator.clipboard.writeText(shareBody(payload));
}

export function downloadPostcardFile(file: File): void {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export type NativeShareResult = 'shared' | 'aborted' | 'unsupported';

/**
 * Prefer PNG + caption (link in text). Fall back to link-only share.
 * Avoid mixing `files` + `url` — that breaks canShare on iOS/Safari.
 */
export async function tryNativeShare(
  payload: PostcardSharePayload
): Promise<NativeShareResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported';
  }

  const title = `${payload.title} · Harmonix`;
  const text = shareBody(payload);

  try {
    if (
      payload.file &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [payload.file] })
    ) {
      await navigator.share({
        files: [payload.file],
        title,
        text,
      });
      return 'shared';
    }

    await navigator.share({
      title,
      text: payload.caption,
      url: payload.shareUrl,
    });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'aborted';
    }
    return 'unsupported';
  }
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canShareFiles(file: File | null): boolean {
  if (!file || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function whatsappShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareHref(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function mailtoShareHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function smsShareHref(body: string): string {
  // iOS uses &body=, Android commonly uses ?body=
  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIos
    ? `sms:&body=${encodeURIComponent(body)}`
    : `sms:?body=${encodeURIComponent(body)}`;
}
