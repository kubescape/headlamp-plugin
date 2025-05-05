import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export enum KubescapeSettings {
  ComplianceTab,
  Exceptions,
  FailedControls,
  FixedCVEs,
  Framework,
  FrameworkNames,
  RelevantCVEs,
  VulnerabilityTab,
}

export function useLocalStorage<T>(
  key: KubescapeSettings,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;

  const [value, setValue] = useState<T>(() => {
    return getItemFromLocalStorage(key) ?? defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export function getItemFromLocalStorage<T>(key: KubescapeSettings): T | null {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    return JSON.parse(saved);
  }
  return null;
}

export function setItemInLocalStorage<T>(key: KubescapeSettings, value: T) {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;
  localStorage.setItem(storageKey, JSON.stringify(value));
}

export function clearItemFromLocalStorage(key: KubescapeSettings) {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;
  localStorage.removeItem(storageKey);
}
