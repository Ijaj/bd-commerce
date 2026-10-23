import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HtmlEditor } from '~/components/HtmlEditor';
import { renderWithMantine } from './utils';

describe('HtmlEditor', () => {
  it('toggles to the HTML source and reports edits', async () => {
    const onChange = vi.fn();
    renderWithMantine(<HtmlEditor value="<p>Hello</p>" onChange={onChange} />);
    fireEvent.click(await screen.findByRole('button', { name: 'View HTML' }));
    const source = screen.getByLabelText('HTML source') as HTMLTextAreaElement;
    expect(source.value).toBe('<p>Hello</p>');
    fireEvent.change(source, { target: { value: '<h2>Hi</h2>' } });
    expect(onChange).toHaveBeenCalledWith('<h2>Hi</h2>');
  });
});
