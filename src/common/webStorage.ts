import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export enum KubescapeSettings {
  ComplianceTab,
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
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
    return defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
