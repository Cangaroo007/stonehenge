import { useState, useEffect, useCallback } from 'react';

interface UseDrawingUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDrawingUrl(drawingId: string | null): UseDrawingUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = useCallback(async () => {
    if (!drawingId) {
      setUrl(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/drawings/${drawingId}/url`);
      if (!response.ok) {
        throw new Error('Failed to fetch drawing URL');
      }
      const data = await response.json();
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }, [drawingId]);

  useEffect(() => {
    fetchUrl();
  }, [fetchUrl]);

  // URLs expire after 1 hour, so refresh periodically
  useEffect(() => {
    if (!drawingId) return;

    const interval = setInterval(fetchUrl, 50 * 60 * 1000); // Refresh every 50 min
    return () => clearInterval(interval);
  }, [drawingId, fetchUrl]);

  return { url, loading, error, refresh: fetchUrl };
}
