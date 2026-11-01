import { createTheme, ThemeProvider } from '@mui/material';
import { cleanup, render, screen } from '@testing-library/react';
import { useEditorTheme } from './theme';

function EditorThemeName() {
  return <span>{useEditorTheme()}</span>;
}

afterEach(() => {
  cleanup();
  localStorage.removeItem('headlampThemePreference');
});

it('follows the mode of the theme, whatever the theme is called', () => {
  // a dark theme of another name, as Headlamp offers several
  localStorage.headlampThemePreference = 'headlamp-classic-dark';
  render(
    <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
      <EditorThemeName />
    </ThemeProvider>
  );
  expect(screen.getByText('vs-dark')).toBeTruthy();
});

it('uses the light editor theme in a light theme', () => {
  render(
    <ThemeProvider theme={createTheme({ palette: { mode: 'light' } })}>
      <EditorThemeName />
    </ThemeProvider>
  );
  expect(screen.getByText('light')).toBeTruthy();
});
