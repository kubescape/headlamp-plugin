declare global {
  interface Window {
    showSaveFilePicker: any;
    showOpenFilePicker: any;
  }
}

/**
 * Whether the plugin runs in the Headlamp desktop app. Electron lets a page pick a file to
 * save to, but not write to it, which left empty files behind.
 */
function isDesktopApp(): boolean {
  return /\belectron\//i.test(navigator.userAgent);
}

// Saves the file through the download of the browser, or the save dialog of the desktop app
function download(blob: Blob, fileName: string) {
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  // the download needs the URL a moment longer than the click
  window.setTimeout(() => window.URL.revokeObjectURL(a.href), 1000);
}

export const saveToFile = async (
  content: string,
  defaultFileName: string,
  enqueueSnackbar: Function
) => {
  const blob = new Blob([content], { type: 'text/plain' });

  if (window.showSaveFilePicker && !isDesktopApp()) {
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await window.showSaveFilePicker({ suggestedName: defaultFileName });
    } catch (error: any) {
      // the user closed the dialog
      if (error?.name === 'AbortError') return null;
      console.error('Error selecting a file:', error);
      download(blob, defaultFileName);
      return null;
    }

    try {
      const writable = await (fileHandle as any).createWritable();
      await writable.write(blob);
      await writable.close();
      enqueueSnackbar(`${fileHandle.name} saved successfully`, { variant: 'success' });
    } catch (error: any) {
      console.error('Error writing the file:', error);
      enqueueSnackbar(
        `Unable to write ${fileHandle.name}: ${error?.message ?? error}. Downloading it instead.`,
        { variant: 'warning' }
      );
      download(blob, defaultFileName);
    }
    return null;
  }

  download(blob, defaultFileName);
  enqueueSnackbar(`Downloading ${defaultFileName}`, { variant: 'success' });
  return null;
};
