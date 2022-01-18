import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { clamp } from "./util";

export function useKeyBinding(
  keys: KeyboardEvent["key"][],
  callback: Function,
  keydown = false
) {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (keys.includes(event.key)) {
        callback();
      }
    }
    document.addEventListener(keydown ? "keydown" : "keyup", handler);
    return () =>
      document.removeEventListener(keydown ? "keydown" : "keyup", handler);
  }, [callback, keys, keydown]);
}

export function usePress(downHandler?: Function) {
  const [pressPos, setPressPos] = useState<[number, number] | null>(null);

  function onMouseDown(event: MouseEvent) {
    setPressPos([event.pageX, event.pageY]);
    if (downHandler) downHandler();
  }
  function onMouseMove(event: MouseEvent) {
    if (pressPos) {
      setPressPos([event.pageX, event.pageY]);
    }
  }
  function onMouseUp() {
    setPressPos(null);
  }
  function onTouchStart(event: TouchEvent) {
    setPressPos([event.touches[0].clientX, event.touches[0].clientY]);
  }
  function onTouchMove(event: TouchEvent) {
    if (pressPos) {
      setPressPos([event.touches[0].clientX, event.touches[0].clientY]);
    }
  }
  function onTouchEnd() {
    setPressPos(null);
  }

  // if (element) {
  //   // element.addEventListener("mousedown", mousedownHandler);
  //   // element.addEventListener("mousemove", mousemoveHandler);
  //   // element.addEventListener("mouseup", mouseupHandler);
  //   element.addEventListener("touchstart", onTouchStart);
  //   element.addEventListener("touchmove", onTouchMove);
  //   element.addEventListener("touchend", touchendHandler);
  // }

  // return () => {
  //   // element.removeEventListener("mousedown", mousedownHandler);
  //   // element.addEventListener("mousemove", mousemoveHandler);
  //   // element.removeEventListener("mouseup", mouseupHandler);
  //   if (element) {
  //     element.removeEventListener("touchstart", onTouchStart);
  //     element.addEventListener("touchmove", onTouchMove);
  //     element.removeEventListener("touchend", touchendHandler);
  //   }
  // };
  // }, [downHandler, elementRef, pressPos]);

  return {
    pressProps: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    pressPos,
  };
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
