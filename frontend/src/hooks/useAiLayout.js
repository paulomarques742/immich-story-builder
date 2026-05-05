import { useState, useRef, useCallback } from 'react';
import api from '../lib/api.js';

export function useAiLayout(storyId, onDone) {
  const [status, setStatus] = useState('idle'); // idle | loading | processing | suggestions_ready | applying | done | error
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [blocksCreated, setBlocksCreated] = useState(0);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState(null);   // array of concept objects
  const [suggestJobId, setSuggestJobId] = useState(null); // job that holds suggestions
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollJob = useCallback((jobId, onSuggestionsReady) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        setProgress(data.progress || 0);
        setProcessed(data.processed || 0);
        setTotal(data.total || 0);
        setBlocksCreated(data.blocks_created || 0);

        if (data.status === 'suggestions_ready') {
          stopPolling();
          setSuggestions(data.suggestions || []);
          setStatus('suggestions_ready');
          onSuggestionsReady?.();
        } else if (data.status === 'done') {
          stopPolling();
          setStatus('done');
          onDone?.();
        } else if (data.status === 'error') {
          stopPolling();
          setStatus('error');
          setError(data.error || 'Erro desconhecido');
        }
      } catch {
        stopPolling();
        setStatus('error');
        setError('Erro ao verificar estado do job');
      }
    }, 2000);
  }, [onDone]);

  // Phase 1: ask AI for story concept suggestions
  const triggerSuggestAiLayout = useCallback(async ({ albumIds, language = 'pt' }) => {
    setStatus('loading');
    setError(null);
    setProgress(0);
    setProcessed(0);
    setSuggestions(null);
    setSuggestJobId(null);

    try {
      const { data } = await api.post(`/api/stories/${storyId}/blocks/ai-suggestions`, {
        album_ids: albumIds,
        language,
      });
      setTotal(data.total_assets || 0);
      setStatus('processing');
      setSuggestJobId(data.job_id);
      pollJob(data.job_id);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao iniciar análise';
      setStatus('error');
      setError(msg);
    }
  }, [storyId, pollJob]);

  // Phase 2: apply the chosen suggestion
  const applySelectedSuggestion = useCallback(async ({ suggestionIdx = 0, replaceExisting = false }) => {
    if (!suggestJobId) return;
    setStatus('applying');
    setError(null);
    setProgress(0);
    setProcessed(0);
    setBlocksCreated(0);

    try {
      const { data } = await api.post(`/api/stories/${storyId}/blocks/ai-apply`, {
        suggestion_job_id: suggestJobId,
        suggestion_idx: suggestionIdx,
        replace_existing: replaceExisting,
      });
      setTotal(data.total_assets || 0);
      pollJob(data.job_id);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao aplicar sugestão';
      setStatus('error');
      setError(msg);
    }
  }, [storyId, suggestJobId, pollJob]);

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setProgress(0);
    setProcessed(0);
    setTotal(0);
    setBlocksCreated(0);
    setError(null);
    setSuggestions(null);
    setSuggestJobId(null);
  }, []);

  return {
    status, progress, processed, total, blocksCreated, error,
    suggestions,
    triggerSuggestAiLayout,
    applySelectedSuggestion,
    reset,
  };
}
