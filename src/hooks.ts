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
  }, []);
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
