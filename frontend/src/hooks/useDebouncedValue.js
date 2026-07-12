import { useEffect, useState } from 'react';

// Returns `value`, but only after it hasn't changed for `delay` ms — lets a
// controlled input stay instantly responsive while expensive derived work
// (filtering, search requests) waits for the user to pause typing.
export function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
