import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { clamp } from "./util";

export function useKeyBinding(
  key: KeyboardEvent["key"],
  callback: Function,
  keyup = false
) {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (event.key === key) {
        callback();
      }
    }
    document.addEventListener(keyup ? "keyup" : "keydown", handler);
    return () =>
      document.removeEventListener(keyup ? "keyup" : "keydown", handler);
  }, [callback, key, keyup]);
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.log(error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.log(error);
    }
  };

  return [storedValue, setValue];
}

export function useKeys() {
  const [keys, setKeys] = useState<KeyboardEvent["key"][]>([]);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      setKeys((prevKeys) => {
        if (prevKeys.includes(event.key)) return prevKeys;
        return [...prevKeys, event.key];
      });
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      setKeys((prevKeys: any) => {
        return prevKeys.filter((k: KeyboardEvent["key"]) => k !== event.key);
      });
    }
    document.addEventListener("keyup", handler);
    return () => document.removeEventListener("keyup", handler);
  }, []);

  return keys;
}

export function useClampedState(
  min: number,
  max: number,
  initialValue: number
): [number, Function, Function] {
  const [value, setValueRaw, reset] = useResetableState<number>(initialValue);

  const setValue = (valueOrFunction: number | Function) => {
    setValueRaw((prevValue: number) => {
      let value =
        typeof valueOrFunction === "function"
          ? valueOrFunction(prevValue)
          : valueOrFunction;
      return clamp(min, max, value);
    });
  };

  return [value, setValue, reset];
}

export function useResetableState<T>(
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>, Function] {
  // T = T ?? typeof initialValue
  const [value, setValue] = useState<T>(initialValue);
  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);
  return [value, setValue, reset];
}
