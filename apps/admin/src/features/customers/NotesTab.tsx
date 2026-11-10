import { EmptyState } from '@bdc/ui';
import { Button, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime } from '~/lib/format';
import { customersApi } from './api';
import classes from './customers.module.css';
import { notifyApiError } from './errors';
import { customerNotesQuery } from './queries';

/** Append-only staff notes: add, never edit or delete. */
export function NotesTab({ customerId, canAdd }: { customerId: string; canAdd: boolean }) {
  const qc = useQueryClient();
  const notes = useQuery(customerNotesQuery(customerId));
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: (b: string) => customersApi.addNote(customerId, b),
    onSuccess: () => {
      notifyOk('Note added');
      setBody('');
      qc.invalidateQueries({ queryKey: ['customers', 'notes', customerId] });
    },
    onError: (e) => notifyApiError(e, 'Could not add the note'),
  });
  const items = notes.data?.items ?? [];

  return (
    <div style={{ padding: 12 }}>
      {canAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) add.mutate(body.trim());
          }}
        >
          <Textarea
            label="New note"
            description="Notes are internal and cannot be edited or deleted."
            autosize
            minRows={2}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
          />
          <div className={classes.actions}>
            <Button type="submit" loading={add.isPending} disabled={!body.trim()}>
              Add note
            </Button>
          </div>
        </form>
      )}
      {items.length === 0 && !notes.isLoading ? (
        <EmptyState icon="audit" title="No notes yet" />
      ) : (
        <ul className={classes.noteList} data-testid="notes">
          {items.map((n) => (
            <li key={n.id} className={classes.note}>
              <span className={classes.muted} style={{ fontSize: 12 }}>
                {n.staff?.name ?? 'Former staff'} · {formatDateTime(n.createdAt)}
              </span>
              <p>{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
