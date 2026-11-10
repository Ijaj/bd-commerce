import { Banner, Icon } from '@bdc/ui';
import { ActionIcon, Badge, Button } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { type PageRow, pagesApi } from './api';
import { shopPageUrl } from './logic';
import classes from './Pages.module.css';
import { pagesListQuery, useInvalidatePages } from './queries';

/** Static shop pages (about, privacy, ...): publish toggle, edit, delete. */
export function PagesPage() {
  const canEdit = useCan('content.manage');
  const navigate = useNavigate();
  const invalidate = useInvalidatePages();
  const list = useQuery(pagesListQuery);
  const [deleting, setDeleting] = useState<PageRow | null>(null);

  const toggle = useMutation({
    mutationFn: (p: PageRow) => pagesApi.update(p.id, { isPublished: !p.isPublished }),
    onSuccess: (saved) => {
      notifyOk(saved.isPublished ? 'Page published' : 'Page unpublished');
      invalidate();
    },
    onError: (e) => notifyError(e, 'Could not update the page'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => pagesApi.remove(id),
    onSuccess: () => {
      notifyOk('Page deleted');
      invalidate();
    },
  });

  const columns: Column<PageRow>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (p) => (
        <>
          <Link to="/content/pages/$id" params={{ id: p.id }}>
            {p.titleEn}
          </Link>
          {p.titleBn ? <span className={classes.sub}>{p.titleBn}</span> : null}
        </>
      ),
    },
    { key: 'slug', header: 'Slug', render: (p) => <code>/pages/{p.slug}</code> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div className={classes.badges}>
          <Badge size="sm" variant="light" color={p.isPublished ? 'green' : 'gray'}>
            {p.isPublished ? 'Published' : 'Draft'}
          </Badge>
          {p.showInFooter && (
            <Badge size="sm" variant="outline" color="gray">
              Footer
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'sort', header: 'Order', className: 'num', render: (p) => p.sortOrder },
    {
      key: 'acts',
      header: '',
      className: 'act',
      render: (p) =>
        canEdit ? (
          <div className={classes.acts}>
            <Button
              size="compact-xs"
              variant="light"
              loading={toggle.isPending && toggle.variables?.id === p.id}
              onClick={() => toggle.mutate(p)}
            >
              {p.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            <ActionIcon
              variant="subtle"
              aria-label={`Edit ${p.titleEn}`}
              onClick={() => navigate({ to: '/content/pages/$id', params: { id: p.id } })}
            >
              <Icon name="edit" size={15} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Delete ${p.titleEn}`}
              onClick={() => setDeleting(p)}
            >
              <Icon name="trash" size={15} />
            </ActionIcon>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Pages"
        crumbs={['Marketing', 'Pages']}
        description="About, privacy, terms and other fixed pages. Published pages marked Footer are linked from the shop footer."
        actions={
          canEdit && (
            <Button
              size="xs"
              onClick={() => navigate({ to: '/content/pages/$id', params: { id: 'new' } })}
              leftSection={<Icon name="plus" size={14} />}
            >
              New page
            </Button>
          )
        }
      />
      {list.isError && <Banner tone="danger">{(list.error as Error).message}</Banner>}
      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        emptyMessage="No pages yet."
      />
      <ConfirmDelete
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete page"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutateAsync(deleting.id)}
      >
        Delete page <b>{deleting?.titleEn}</b>? Its link at{' '}
        {deleting ? shopPageUrl(deleting.slug) : ''} stops working straight away.
      </ConfirmDelete>
    </>
  );
}
