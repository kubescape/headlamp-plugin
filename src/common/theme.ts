/*
  The light or dark mode of Headlamp's theme. The name of the chosen theme, which Headlamp keeps
  in localStorage, says nothing about its mode: there are several dark themes.
*/
import { useTheme } from '@mui/material';

/** Whether Headlamp shows a dark theme. */
export function useDarkMode(): boolean {
  return useTheme().palette.mode === 'dark';
}

/** The Monaco editor theme that matches Headlamp's theme. */
export function useEditorTheme(): string {
  return useDarkMode() ? 'vs-dark' : 'light';
}
