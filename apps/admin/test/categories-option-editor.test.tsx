import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OptionEditor } from '~/features/categories/OptionEditor';
import type { Attribute } from '~/features/categories/types';
import { renderWithMantine } from './utils';

const attribute: Attribute = {
  id: '00000000-0000-4000-8000-000000000001',
  categoryId: '00000000-0000-4000-8000-000000000002',
  key: 'colour',
  nameEn: 'Colour',
  nameBn: null,
  type: 'select',
  unit: null,
  isFilterable: true,
  isRequired: false,
  sort: 0,
  options: [
    { id: '00000000-0000-4000-8000-0000000000a1', valueEn: 'Red', valueBn: null, sort: 0 },
    { id: '00000000-0000-4000-8000-0000000000a2', valueEn: 'Blue', valueBn: null, sort: 1 },
  ],
};

function setup() {
  renderWithMantine(
    <QueryClientProvider client={new QueryClient()}>
      <OptionEditor attribute={attribute} />
    </QueryClientProvider>,
  );
}

describe('OptionEditor', () => {
  it('lists one row per option and keeps Add option in the header', () => {
    setup();
    expect(screen.getAllByLabelText('Option (English)')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /add option/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    expect(screen.getAllByLabelText('Option (English)')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /add option/i })).toBeInTheDocument();
  });

  it('highlights case-insensitive duplicates and blank rows on save', () => {
    setup();
    fireEvent.change(screen.getAllByLabelText('Option (English)')[1] as HTMLElement, {
      target: { value: 'red' },
    });
    expect(screen.getAllByText('Duplicate')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    fireEvent.click(screen.getByRole('button', { name: /save options/i }));
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
