import { useCallback, useEffect, useRef, useState } from "react";

export const useAsyncList = <TData,>(
  load: () => Promise<TData>,
  dependencies: unknown[] = [],
) => {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadRef = useRef(load);

  loadRef.current = load;

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextData = await loadRef.current();
      setData(nextData);
      return nextData;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load data.";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, dependencies);

  return {
    data,
    error,
    isLoading,
    reload,
    setData,
  };
};
