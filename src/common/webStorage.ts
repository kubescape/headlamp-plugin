import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export enum KubescapeSettings {
  ComplianceTab,
  ExceptionPolicyGroups,
  FailedControls,
  FixedCVEs,
  Framework,
  FrameworkNames,
  KubescapeNamespace,
  RelevantCVEs,
  SelectedExceptionGroup,
  VulnerabilityTab,
}

export function useLocalStorage<T>(
  key: KubescapeSettings,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getItemFromStorage(localStorage, key) ?? defaultValue;
  });

  useEffect(() => {
    setItemInStorage(localStorage, key, value);
  }, [key, value]);

  return [value, setValue];
}

export function useSessionStorage<T>(
  key: KubescapeSettings,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getItemFromStorage(sessionStorage, key) ?? defaultValue;
  });

  useEffect(() => {
    setItemInStorage(sessionStorage, key, value);
  }, [key, value]);

  return [value, setValue];
}

export function setItemInStorage<T>(storage: Storage, key: KubescapeSettings, value: T) {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;
  if (value) {
    storage.setItem(storageKey, JSON.stringify(value));
  } else {
    storage.removeItem(storageKey);
  }
}

export function getItemFromStorage<T>(storage: Storage, key: KubescapeSettings): T | null {
  const storageKey = `kubescape.${KubescapeSettings[key]}`;
  const saved = storage.getItem(storageKey);
  if (saved) {
    return JSON.parse(saved);
  }
  return null;
}

export function setItemInSessionStorage<T>(key: KubescapeSettings, value: T) {
  return setItemInStorage(sessionStorage, key, value);
}

export function getItemFromSessionStorage<T>(key: KubescapeSettings) {
  return getItemFromStorage(sessionStorage, key);
}

export function setItemInLocalStorage<T>(key: KubescapeSettings, value: T) {
  return setItemInStorage(localStorage, key, value);
}
export function getItemFromLocalStorage<T>(key: KubescapeSettings) {
  return getItemFromStorage(localStorage, key);
}
