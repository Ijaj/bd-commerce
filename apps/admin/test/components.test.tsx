import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import { DataTable } from '~/components/DataTable';
import { MoneyInput } from '~/components/MoneyInput';
import { isoToLocalInput, localInputToIso } from '~/features/settings/SchemaForm';
import { renderWithMantine } from './utils';

function MoneyHarness({ onChange }: { onChange: (p: number | null) => void }) {
  const [v, setV] = useState<number | null>(12550);
  return (
    <MoneyInput
      label="Price"
      value={v}
      onChange={(p) => {
        setV(p);
        onChange(p);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('shows taka and reports integer paisa', () => {
    const onChange = vi.fn();
    renderWithMantine(<MoneyHarness onChange={onChange} />);
    const input = screen.getByLabelText('Price') as HTMLInputElement;
    expect(input.value).toBe('৳125.50');
    fireEvent.change(input, { target: { value: '99.9' } });
    expect(onChange).toHaveBeenLastCalledWith(9990);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('BilingualTextInput', () => {
  it('edits English and Bangla independently', () => {
    const onChange = vi.fn();
    renderWithMantine(
      <BilingualTextInput label="Title" value={{ en: 'Shirt', bn: '' }} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText('Title (Bangla)'), { target: { value: 'শার্ট' } });
    expect(onChange).toHaveBeenCalledWith({ en: 'Shirt', bn: 'শার্ট' });
  });
});

describe('DataTable', () => {
  const columns = [{ key: 'n', header: 'Name', render: (r: { n: string }) => r.n }];

  it('renders rows and the pagination summary', () => {
    const onPageChange = vi.fn();
    renderWithMantine(
      <DataTable
        columns={columns}
        rows={[{ n: 'Alpha' }, { n: 'Beta' }]}
        rowKey={(r) => r.n}
        page={1}
        pageSize={2}
        total={5}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('1-2 of 5')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    renderWithMantine(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.n} emptyMessage="No brands" />,
    );
    expect(screen.getByText('No brands')).toBeInTheDocument();
  });

  it('shows the loader while loading', () => {
    renderWithMantine(<DataTable columns={columns} rows={undefined} rowKey={(r) => r.n} loading />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });
});

describe('datetime helpers', () => {
  it('round-trips local datetime input', () => {
    const iso = '2026-10-23T10:30:00.000Z';
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
    expect(localInputToIso('')).toBeNull();
    expect(isoToLocalInput(null)).toBe('');
  });
});
