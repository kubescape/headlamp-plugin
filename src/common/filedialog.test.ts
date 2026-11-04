import { vi } from 'vitest';
import { saveToFile } from './filedialog';

const userAgent = navigator.userAgent;

// jsdom's Blob has no text()
function textOf(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
}

let downloads: Array<{ fileName: string; content: Promise<string> }>;
let blobs: Map<string, Blob>;

beforeEach(() => {
  downloads = [];
  blobs = new Map();
  window.URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:${blobs.size}`;
    blobs.set(url, blob);
    return url;
  });
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push({ fileName: this.download, content: textOf(blobs.get(this.href)!) });
  });
  window.showSaveFilePicker = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
});

function asDesktopApp() {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0) Chrome/138.0.0.0 Electron/37.2.0 Safari/537.36',
    configurable: true,
  });
}

it('downloads the file in the desktop app, where a picked file cannot be written', async () => {
  asDesktopApp();
  const picker = vi.fn();
  window.showSaveFilePicker = picker;
  const enqueueSnackbar = vi.fn();

  await saveToFile('a,b\r\n1,2\r\n', 'export.csv', enqueueSnackbar);

  expect(picker).not.toHaveBeenCalled();
  expect(downloads.map(download => download.fileName)).toEqual(['export.csv']);
  expect(await downloads[0].content).toBe('a,b\r\n1,2\r\n');
});

it('writes the picked file in a browser', async () => {
  const written: Blob[] = [];
  window.showSaveFilePicker = vi.fn(async () => ({
    name: 'chosen.csv',
    createWritable: async () => ({
      write: async (blob: Blob) => written.push(blob),
      close: async () => {},
    }),
  }));
  const enqueueSnackbar = vi.fn();

  await saveToFile('content', 'export.csv', enqueueSnackbar);

  expect(await textOf(written[0])).toBe('content');
  expect(downloads).toEqual([]);
  expect(enqueueSnackbar).toHaveBeenCalledWith('chosen.csv saved successfully', {
    variant: 'success',
  });
});

it('downloads the file instead when the picked file cannot be written', async () => {
  window.showSaveFilePicker = vi.fn(async () => ({
    name: 'chosen.csv',
    createWritable: async () => {
      throw Object.assign(new Error('not allowed'), { name: 'NotAllowedError' });
    },
  }));
  const enqueueSnackbar = vi.fn();

  await saveToFile('content', 'export.csv', enqueueSnackbar);

  expect(await downloads[0].content).toBe('content');
  expect(enqueueSnackbar.mock.calls[0][1]).toEqual({ variant: 'warning' });
});

it('does nothing when the save dialog is closed', async () => {
  window.showSaveFilePicker = vi.fn(async () => {
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  });
  const enqueueSnackbar = vi.fn();

  await saveToFile('content', 'export.csv', enqueueSnackbar);

  expect(downloads).toEqual([]);
  expect(enqueueSnackbar).not.toHaveBeenCalled();
});
