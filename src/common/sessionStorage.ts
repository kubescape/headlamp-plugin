import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export enum KubescapeSettings {
  ComplianceTab,
  FailedControls,
  FixedCVEs,
  KubescapeNamespace,
  RelevantCVEs,
  SelectedExceptionGroup,
  VulnerabilityTab,
}

export function useSessionStorage<T>(
  key: KubescapeSettings,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getItemFromSessionStorage(key) ?? defaultValue;
  });

  useEffect(() => {
    setItemInSessionStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}

export function setItemInSessionStorage<T>(key: KubescapeSettings, value: T) {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;

  if (value) {
    //console.log('Updating session storage', storageKey, value);
    sessionStorage.setItem(storageKey, JSON.stringify(value));
  } else {
    sessionStorage.removeItem(storageKey);
  }
}

export function getItemFromSessionStorage<T>(key: KubescapeSettings) {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;
  const saved = sessionStorage.getItem(storageKey);
  if (saved) {
    return JSON.parse(saved) as T;
  }
  return null;
}
