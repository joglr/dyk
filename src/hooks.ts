import { useEffect, useState } from "react";
import { clamp } from "./util";

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
): [number, Function] {
  const [value, setValueRaw] = useState(initialValue);

  const setValue = (valueOrFunction: number | Function) => {
    setValueRaw((prevValue: number) => {
      let value =
        typeof valueOrFunction === "function"
          ? valueOrFunction(prevValue)
          : valueOrFunction;
      return clamp(min, max, value);
    });
  };

  return [value, setValue];
}
