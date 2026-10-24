export type CopyOutcome = 'copied' | 'copied-fallback' | 'failed';

function copyWithSelection(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  try {
    // The legacy command is deprecated but is the only route in browsers without the Clipboard API
    // or outside a secure context.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/**
 * Copies text for the user: the Clipboard API first, then the legacy selection route. `failed` means
 * the caller must show the text so it can be copied by hand; nothing is reported as copied that was not.
 */
export async function copyText(text: string): Promise<CopyOutcome> {
  if (
    typeof navigator !== 'undefined' &&
    'clipboard' in navigator &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Permission denied or insecure context: fall through to the selection route below.
    }
  }
  return copyWithSelection(text) ? 'copied-fallback' : 'failed';
}

/** Offers a text file for download from the browser's own memory; nothing is uploaded. */
export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
