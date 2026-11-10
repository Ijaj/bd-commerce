import { Banner, SectionCard } from '@bdc/ui';
import {
  Alert,
  Button,
  Loader,
  NumberInput,
  Switch,
  Tabs,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { HtmlEditor } from '~/components/HtmlEditor';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { type PageFull, pagesApi } from './api';
import {
  EMPTY_PAGE,
  type PageFormValues,
  pageToValues,
  shopPageUrl,
  validatePage,
  valuesToBody,
} from './logic';
import classes from './Pages.module.css';
import { pageQuery, useInvalidatePages } from './queries';

/** `id` = 'new' creates; otherwise loads and edits that page. */
export function PageEditorPage({ id }: { id: string }) {
  const isNew = id === 'new';
  const detail = useQuery({ ...pageQuery(id), enabled: !isNew });
  const back = (
    <Button component={Link} to="/content/pages" variant="subtle" size="xs" mb="xs">
      All pages
    </Button>
  );

  if (!isNew && detail.isLoading) {
    return (
      <div className="a-card">
        <div className="a-empty">
          <Loader size="sm" aria-label="Loading" />
        </div>
      </div>
    );
  }
  if (!isNew && (detail.error || !detail.data)) {
    return (
      <>
        {back}
        <Banner tone="danger">{(detail.error as Error | null)?.message ?? 'Page not found'}</Banner>
      </>
    );
  }
  return (
    <>
      {back}
      {/* key: a save from elsewhere must reset the form to the server copy */}
      <PageForm key={detail.data?.updatedAt ?? 'new'} page={detail.data} />
    </>
  );
}

function PageForm({ page }: { page?: PageFull }) {
  const canEdit = useCan('content.manage');
  const navigate = useNavigate();
  const invalidate = useInvalidatePages();
  const form = useForm<PageFormValues>({
    initialValues: page ? pageToValues(page) : EMPTY_PAGE,
    validate: validatePage,
  });
  const v = form.values;

  const save = useMutation({
    mutationFn: (values: PageFormValues) =>
      page ? pagesApi.update(page.id, valuesToBody(values)) : pagesApi.create(valuesToBody(values)),
    onSuccess: (saved) => {
      notifyOk(page ? 'Page saved' : 'Page created');
      invalidate();
      if (!page) navigate({ to: '/content/pages/$id', params: { id: saved.id } });
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(values))} className={classes.editor}>
      <PageHeader
        title={page ? page.titleEn : 'New page'}
        crumbs={['Marketing', 'Pages', page ? page.titleEn : 'New']}
        description={
          page?.isPublished ? (
            <a href={shopPageUrl(page.slug)} target="_blank" rel="noreferrer">
              View on the shop
            </a>
          ) : (
            'Drafts are not visible on the shop.'
          )
        }
      />
      <SectionCard title="Content" bodyClassName={classes.form}>
        <Tabs defaultValue="en" variant="pills">
          <Tabs.List mb="sm">
            <Tabs.Tab value="en">English</Tabs.Tab>
            <Tabs.Tab value="bn">বাংলা</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="en">
            <div className={classes.form}>
              <TextInput
                label="Title (English)"
                required
                maxLength={120}
                disabled={!canEdit}
                {...form.getInputProps('titleEn')}
              />
              <HtmlEditor
                label="Body (English)"
                disabled={!canEdit}
                value={v.bodyHtmlEn}
                onChange={(html) => form.setFieldValue('bodyHtmlEn', html)}
                minHeight={300}
              />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="bn">
            <div className={classes.form}>
              <TextInput
                label="Title (Bangla)"
                description="Optional: the shop falls back to English."
                maxLength={120}
                disabled={!canEdit}
                {...form.getInputProps('titleBn')}
              />
              <HtmlEditor
                label="Body (Bangla)"
                disabled={!canEdit}
                value={v.bodyHtmlBn}
                onChange={(html) => form.setFieldValue('bodyHtmlBn', html)}
                minHeight={300}
              />
            </div>
          </Tabs.Panel>
        </Tabs>
      </SectionCard>

      <SectionCard title="Settings" bodyClassName={classes.form}>
        <div className={classes.row}>
          <TextInput
            label="Slug"
            description="Shop address: /pages/<slug>"
            required
            maxLength={60}
            disabled={!canEdit}
            {...form.getInputProps('slug')}
          />
          <NumberInput
            label="Sort order"
            description="Lower numbers come first."
            min={0}
            max={9999}
            allowDecimal={false}
            disabled={!canEdit}
            value={v.sortOrder}
            onChange={(n) => form.setFieldValue('sortOrder', typeof n === 'number' ? n : 0)}
            error={form.errors.sortOrder}
          />
        </div>
        <Switch
          label="Published"
          description="Drafts return 404 on the shop."
          disabled={!canEdit}
          {...form.getInputProps('isPublished', { type: 'checkbox' })}
        />
        <Switch
          label="Show in footer"
          description="Linked from the shop footer while published."
          disabled={!canEdit}
          {...form.getInputProps('showInFooter', { type: 'checkbox' })}
        />
      </SectionCard>

      <SectionCard title="Search engines" bodyClassName={classes.form}>
        <TextInput
          label="SEO title"
          description="Optional: defaults to the page title."
          maxLength={120}
          disabled={!canEdit}
          {...form.getInputProps('seoTitle')}
        />
        <Textarea
          label="SEO description"
          maxLength={300}
          autosize
          minRows={2}
          disabled={!canEdit}
          {...form.getInputProps('seoDescription')}
        />
        {save.error && (
          <Alert color="red" role="alert">
            {(save.error as Error).message}
          </Alert>
        )}
        {canEdit && (
          <div className={classes.foot}>
            <Button type="submit" loading={save.isPending}>
              {page ? 'Save page' : 'Create page'}
            </Button>
          </div>
        )}
      </SectionCard>
    </form>
  );
}
