import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export enum KubescapeSettings {
  FailedControls = 'kubescape.FailedControls',
  FixedCVEs = 'kubescape.FixedCVEs',
  Framework = 'kubescape.Framework',
  FrameworkNames = 'kubescape.FrameworkNames',
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: any
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getLocalStorageValue(key, defaultValue);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function getLocalStorageValue(key: string, defaultValue: any) {
  const saved = localStorage.getItem(key);
  if (saved) {
    return JSON.parse(saved);
  }
  return defaultValue;
}
