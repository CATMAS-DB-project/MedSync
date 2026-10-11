import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { TextArea } from '../../../components/ui/TextArea';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { ApiError } from '../../../services/api/ApiError';
import { saveConsultationNotes } from '../../../services/api/appointmentTreatments';

export interface ConsultationNotesCardProps {
  appointmentId: number;
  initialNotes: string;
  canEdit: boolean;
  /** Parent registers a `flush` function so it can force a save before completing. */
  registerFlush: (flush: () => Promise<void>) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 2000;

export function ConsultationNotesCard({
  appointmentId,
  initialNotes,
  canEdit,
  registerFlush,
}: ConsultationNotesCardProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const notesRef = useRef(notes);
  const lastSavedRef = useRef(initialNotes);
  const debounceRef = useRef<number | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Serialized save. Every save queued onto the same chain, so two saves never overlap.
  const queueSave = useCallback(
    (value: string): Promise<void> => {
      const next = saveChainRef.current.then(async () => {
        if (value === lastSavedRef.current) return;
        if (!isMountedRef.current) return;
        setStatus('saving');
        setError(null);
        try {
          await saveConsultationNotes(appointmentId, value);
          lastSavedRef.current = value;
          if (!isMountedRef.current) return;
          setSavedAt(
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          );
          setStatus('saved');
        } catch (err) {
          if (!isMountedRef.current) return;
          setError(err instanceof ApiError ? err.message : 'Could not save notes.');
          setStatus('error');
          throw err;
        }
      });
      // Keep the chain alive even if this save rejects.
      saveChainRef.current = next.catch(() => undefined);
      return next;
    },
    [appointmentId],
  );

  const scheduleSave = useCallback(
    (value: string) => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void queueSave(value).catch(() => undefined);
      }, DEBOUNCE_MS);
    },
    [queueSave],
  );

  const flush = useCallback(async () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await queueSave(notesRef.current);
  }, [queueSave]);

  useEffect(() => {
    registerFlush(flush);
  }, [registerFlush, flush]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNotes(value);
    scheduleSave(value);
  };

  const handleBlur = () => {
    void flush().catch(() => undefined);
  };

  const handleRetry = () => {
    void queueSave(notesRef.current).catch(() => undefined);
  };

  return (
    <Card padding="none">
      <header className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-5">
        <h2 className="text-headline-sm text-on-surface">Consultation notes</h2>
      </header>

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {canEdit ? (
          <TextArea
            value={notes}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={10}
            placeholder="Objective findings, assessment, plan…"
            containerClassName="[&_textarea]:min-h-[240px]"
          />
        ) : (
          <div className="min-h-[240px] whitespace-pre-wrap rounded-xl bg-surface-container-low p-4 text-body-sm text-on-surface">
            {notes.trim().length > 0 ? (
              notes
            ) : (
              <span className="text-on-surface-variant">No notes</span>
            )}
          </div>
        )}

        {canEdit && status === 'saving' && (
          <p className="text-label-md text-on-surface-variant">Saving…</p>
        )}
        {canEdit && status === 'saved' && savedAt && (
          <p className="text-label-md text-on-surface-variant">Saved {savedAt}</p>
        )}
        {canEdit && status === 'error' && (
          <div className="flex items-center gap-2 text-label-md">
            <span className="text-error">Not saved</span>
            <button
              type="button"
              onClick={handleRetry}
              className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
