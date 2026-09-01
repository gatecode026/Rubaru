import { useState, useCallback, useEffect, useRef } from 'react';
import datingService from '../services/datingService';

export function useDatingDiscovery() {
  const [candidates, setCandidates] = useState([]);
  const [currentCursor, setCurrentCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [batchId, setBatchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passUndoAvailable, setPassUndoAvailable] = useState(false);
  const pendingImpressions = useRef(new Set());

  const fetchCandidates = useCallback(async (isInitial = false) => {
    try {
      setLoading(true);
      setError(null);

      const cursorParam = isInitial ? null : currentCursor;
      const res = await datingService.getDiscoveryCandidates({ cursor: cursorParam });

      if (res.success && res.data) {
        const newItems = res.data.items || [];
        setBatchId(res.data.batchId);
        setCurrentCursor(res.data.nextCursor);
        setHasMore(res.data.hasMore);

        if (isInitial) {
          setCandidates(newItems);
        } else {
          setCandidates((prev) => [...prev, ...newItems]);
        }
      }
    } catch (err) {
      console.warn('[DATING DISCOVERY ERROR]', err.message);
      setError(err.message || 'Failed to load candidates');
    } finally {
      setLoading(false);
    }
  }, [currentCursor]);

  useEffect(() => {
    fetchCandidates(true);
  }, []);

  const handlePass = useCallback(async (recommendationId) => {
    // Optimistically remove card
    setCandidates((prev) => prev.filter((c) => c.recommendationId !== recommendationId));
    setPassUndoAvailable(true);

    try {
      await datingService.passCandidate(recommendationId, {
        idempotencyKey: `pass_${recommendationId}_${Date.now()}`,
      });
    } catch (err) {
      console.warn('[PASS ACTION ERROR]', err.message);
    }
  }, []);

  const handleLike = useCallback(async (recommendationId, { type = 'LIKE', comment = '', targetElement } = {}) => {
    // Optimistically remove card
    setCandidates((prev) => prev.filter((c) => c.recommendationId !== recommendationId));

    try {
      const res = await datingService.sendLike({
        recommendationId,
        type,
        comment,
        targetElement,
        idempotencyKey: `like_${recommendationId}_${Date.now()}`,
      });
      return res;
    } catch (err) {
      console.warn('[LIKE ACTION ERROR]', err.message);
      throw err;
    }
  }, []);

  const handleUndo = useCallback(async () => {
    try {
      const res = await datingService.undoPass({
        idempotencyKey: `undo_${Date.now()}`,
      });
      if (res.success && res.data && res.data.restoredCandidate) {
        setCandidates((prev) => [res.data.restoredCandidate, ...prev]);
        setPassUndoAvailable(false);
      }
    } catch (err) {
      console.warn('[UNDO ACTION ERROR]', err.message);
    }
  }, []);

  return {
    candidates,
    loading,
    error,
    hasMore,
    passUndoAvailable,
    fetchNextPage: () => fetchCandidates(false),
    refresh: () => fetchCandidates(true),
    passCandidate: handlePass,
    likeCandidate: handleLike,
    undoPass: handleUndo,
  };
}

export default useDatingDiscovery;
