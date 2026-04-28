import { useState, useRef, useCallback } from 'react';
import api from '../lib/api.js';

export function useAiLayout(storyId, onDone) {
  const [status, setStatus] = useState('idle'); // idle | loading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [blocksCreated, setBlocksCreated] = useState(0);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollJob = useCallback((jobId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        setProgress(data.progress || 0);
        setProcessed(data.processed || 0);
        setTotal(data.total || 0);
        setBlocksCreated(data.blocks_created || 0);

        if (data.status === 'done') {
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

  const triggerAiLayout = useCallback(async ({ albumIds, language = 'pt', replaceExisting = false }) => {
    setStatus('loading');
    setError(null);
    setProgress(0);
    setProcessed(0);
    setBlocksCreated(0);

    try {
      const { data } = await api.post(`/api/stories/${storyId}/blocks/ai-layout`, {
        album_ids: albumIds,
        language,
        replace_existing: replaceExisting,
      });
      setTotal(data.total_assets || 0);
      setStatus('processing');
      pollJob(data.job_id);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao iniciar AI Layout';
      setStatus('error');
      setError(msg);
    }
  }, [storyId, pollJob]);

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setProgress(0);
    setProcessed(0);
    setTotal(0);
    setBlocksCreated(0);
    setError(null);
  }, []);

  return { status, progress, processed, total, blocksCreated, error, triggerAiLayout, reset };
}
