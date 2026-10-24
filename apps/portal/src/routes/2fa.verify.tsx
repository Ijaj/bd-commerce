import { Alert, Anchor, Button, PinInput, Stack, Text, TextInput } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { AuthLayout } from '~/components/AuthLayout';
import { t } from '~/i18n';
import { validateRedirectSearch } from '~/lib/redirect';

export const Route = createFileRoute('/2fa/verify')({
  validateSearch: validateRedirectSearch,
  component: VerifyPage,
});

function VerifyPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');

  const verify = useMutation({
    mutationFn: (body: { code: string } | { backupCode: string }) =>
      unwrap(api.POST('/v1/admin/auth/2fa/verify', { body })),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['me'] });
      router.history.push(redirect ?? '/');
    },
  });

  const submit = (value: string) => {
    if (useBackup) verify.mutate({ backupCode: value.trim() });
    else verify.mutate({ code: value });
  };

  return (
    <AuthLayout
      title={t('twoFactorCode')}
      subtitle={useBackup ? t('backupCodeSub') : t('twoFactorCodeSub')}
    >
      <Stack gap="sm">
        {verify.error && (
          <Alert color="red" variant="light">
            {verify.error.message}
          </Alert>
        )}
        {useBackup ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(backup);
            }}
          >
            <Stack gap="sm">
              <TextInput
                label={t('backupCode')}
                value={backup}
                onChange={(e) => setBackup(e.currentTarget.value)}
                data-autofocus
                autoComplete="off"
              />
              <Button type="submit" loading={verify.isPending} disabled={backup.trim().length < 8}>
                {t('verify')}
              </Button>
            </Stack>
          </form>
        ) : (
          <Stack gap="sm" align="center">
            <PinInput
              length={6}
              type="number"
              oneTimeCode
              autoFocus
              size="lg"
              value={code}
              onChange={setCode}
              onComplete={submit}
              aria-label="Authenticator code"
            />
            <Button
              fullWidth
              loading={verify.isPending}
              disabled={code.length !== 6}
              onClick={() => submit(code)}
            >
              {t('verify')}
            </Button>
          </Stack>
        )}
        <Text size="xs" ta="center">
          <Anchor
            component="button"
            type="button"
            onClick={() => {
              setUseBackup((b) => !b);
              verify.reset();
            }}
          >
            {useBackup ? t('useAuthenticator') : t('useBackup')}
          </Anchor>
        </Text>
      </Stack>
    </AuthLayout>
  );
}
