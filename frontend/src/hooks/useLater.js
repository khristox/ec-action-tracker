import { useCallback, useEffect, useRef } from 'react';

// setTimeout that is cancelled automatically when the component unmounts
export const useLater = () => {
  const timers = useRef(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
};