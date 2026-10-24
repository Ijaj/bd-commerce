import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { api, unwrap } from '~/api';
import { AuthLayout } from '~/components/AuthLayout';
import { t } from '~/i18n';
import { validateRedirectSearch } from '~/lib/redirect';

export const Route = createFileRoute('/login')({
  validateSearch: validateRedirectSearch,
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : t('emailInvalid')),
      password: (v) => (v ? null : t('passwordRequired')),
    },
  });

  const login = useMutation({
    mutationFn: (v: { email: string; password: string }) =>
      unwrap(api.POST('/v1/admin/auth/login', { body: v })),
    onSuccess: ({ next }) => {
      qc.removeQueries({ queryKey: ['me'] });
      void navigate({
        to: next === 'mfa_setup' ? '/2fa/setup' : '/2fa/verify',
        search: { redirect },
      });
    },
  });

  return (
    <AuthLayout title={t('signIn')} subtitle={t('signInSub')}>
      <form onSubmit={form.onSubmit((v) => login.mutate(v))}>
        <Stack gap="sm">
          {login.error && (
            <Alert color="red" variant="light">
              {login.error.message}
            </Alert>
          )}
          <TextInput
            label={t('email')}
            type="email"
            autoComplete="username"
            inputMode="email"
            data-autofocus
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label={t('password')}
            autoComplete="current-password"
            {...form.getInputProps('password')}
          />
          <Button type="submit" loading={login.isPending}>
            {t('continue')}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
