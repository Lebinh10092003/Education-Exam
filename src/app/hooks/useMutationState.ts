import { useCallback, useState } from "react";

export const useMutationState = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <TResult,>(mutation: () => Promise<TResult>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await mutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setError(message);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    isSubmitting,
    error,
    setError,
    run,
  };
};
