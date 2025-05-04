declare global {
  interface Window {
    showSaveFilePicker: any;
    showOpenFilePicker: any;
  }
}

export const saveToFile = async (
  content: string,
  defaultFileName: string,
  enqueueSnackbar: Function
) => {
  const blob = new Blob([content], { type: 'text/plain' });

  const createSaveFilePicker = async (): Promise<FileSystemFileHandle> => {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: defaultFileName,
    });

    return fileHandle;
  };

  let fileName = defaultFileName;
  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await createSaveFilePicker();
      fileName = fileHandle.name;
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      console.error('Error selecting a file:', error);
      return null;
    }
  } else {
    // For browsers that don't support window.showSaveFilePicker
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = defaultFileName;

    // Trigger the download
    a.click();

    // Clean up
    window.URL.revokeObjectURL(a.href);
  }

  enqueueSnackbar(`${fileName} saved successfully`, { variant: 'success' });
};
