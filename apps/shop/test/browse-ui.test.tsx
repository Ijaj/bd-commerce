import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '~/features/browse/Pagination';
import { parseListingQuery } from '~/features/browse/query';
import { SortSelect } from '~/features/browse/SortSelect';
import { browseBn } from '~/features/browse/strings.bn';
import { browseEn } from '~/features/browse/strings.en';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('Pagination', () => {
  it('renders crawlable links with prev/next and a window of pages', () => {
    render(
      <Pagination
        lang="en"
        path="/c/phones"
        q={parseListingQuery({ brand: 'walton', page: '5' })}
        page={5}
        pages={12}
        label="Pagination"
      />,
    );
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/c/phones?brand=walton&page=4',
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('rel', 'next');
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'href',
      '/c/phones?brand=walton',
    );
    expect(screen.getByText('5')).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('prefixes /bn and uses Bangla digits', () => {
    render(
      <Pagination
        lang="bn"
        path="/search"
        q={parseListingQuery({ q: 'a' })}
        page={1}
        pages={3}
        label="x"
      />,
    );
    expect(screen.getByRole('link', { name: browseBn.next })).toHaveAttribute(
      'href',
      '/bn/search?q=a&page=2',
    );
    expect(screen.getByText('১')).toBeInTheDocument();
  });
});

describe('SortSelect', () => {
  it('submits its GET form when the value changes and keeps other params', () => {
    const submit = vi.fn();
    HTMLFormElement.prototype.requestSubmit = submit;
    const { container } = render(
      <SortSelect
        action="/c/x"
        hidden={[['brand', 'walton']]}
        value="popular"
        options={[
          { value: 'popular', label: 'Popular' },
          { value: 'newest', label: 'Newest' },
        ]}
        label="Sort by"
        apply="Apply"
      />,
    );
    expect(container.querySelector('input[name=brand]')).toHaveValue('walton');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'newest' } });
    expect(submit).toHaveBeenCalled();
  });
});

describe('browse strings', () => {
  it('has the same keys in English and Bangla', () => {
    expect(Object.keys(browseBn).sort()).toEqual(Object.keys(browseEn).sort());
    expect(Object.keys(browseBn.sorts)).toEqual(Object.keys(browseEn.sorts));
  });
});
