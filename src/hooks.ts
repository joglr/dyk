import { useEffect, useState } from "react";

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
