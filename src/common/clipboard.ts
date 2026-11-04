/*
  Copying text to the clipboard.
*/

/**
 * Copies the text to the clipboard. The clipboard API needs a secure context, which the desktop
 * app and a Headlamp on localhost are; elsewhere the text is copied the old way, from a hidden
 * text area next to the focused element, so that a dialog keeps the focus.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // not allowed here, copy the old way
    }
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  const container = document.activeElement?.parentElement ?? document.body;
  container.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  container.removeChild(area);
  if (!copied) throw new Error('The clipboard is not available.');
}
