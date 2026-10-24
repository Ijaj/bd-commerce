import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Code,
  CopyButton,
  Image,
  Loader,
  PinInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api, unwrap } from '~/api';
import { AuthLayout } from '~/components/AuthLayout';
import { t } from '~/i18n';
import { validateRedirectSearch } from '~/lib/redirect';

export const Route = createFileRoute('/2fa/setup')({
  validateSearch: validateRedirectSearch,
  component: SetupPage,
});

function SetupPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const setup = useQuery({
    queryKey: ['2fa-setup'],
    queryFn: () => unwrap(api.POST('/v1/admin/auth/2fa/setup')),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!setup.data) return;
    void QRCode.toDataURL(setup.data.otpauthUri, { margin: 1, width: 200 }).then(setQr);
  }, [setup.data]);

  // Session gone or never started: back to sign-in.
  useEffect(() => {
    if (setup.error && 'status' in setup.error && setup.error.status === 401) {
      void navigate({ to: '/login', search: { redirect } });
    }
  }, [setup.error, navigate, redirect]);

  const enable = useMutation({
    mutationFn: (value: string) =>
      unwrap(api.POST('/v1/admin/auth/2fa/enable', { body: { code: value } })),
    onSuccess: (d) => setCodes(d.backupCodes),
  });

  if (codes) {
    return (
      <AuthLayout title={t('saveCodes')} subtitle={t('saveCodesSub')}>
        <Stack gap="sm">
          <SimpleGrid cols={2} spacing="xs">
            {codes.map((c) => (
              <Code key={c} fz="sm" ta="center" p={6}>
                {c}
              </Code>
            ))}
          </SimpleGrid>
          <CopyButton value={codes.join('\n')}>
            {({ copied, copy }) => (
              <Button variant="default" onClick={copy}>
                {copied ? t('copied') : t('copy')}
              </Button>
            )}
          </CopyButton>
          <Checkbox
            label={t('codesSaved')}
            checked={saved}
            onChange={(e) => setSaved(e.currentTarget.checked)}
          />
          <Button
            disabled={!saved}
            onClick={() => {
              qc.removeQueries({ queryKey: ['me'] });
              router.history.push(redirect ?? '/');
            }}
          >
            {t('continue')}
          </Button>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('setup2fa')} subtitle={t('setup2faSub')}>
      {setup.isPending && <Loader size="sm" mx="auto" />}
      {setup.error && (
        <Alert color="red" variant="light">
          {setup.error.message}
        </Alert>
      )}
      {setup.data && (
        <Stack gap="sm" align="center">
          {qr ? <Image src={qr} w={200} h={200} alt="Two-factor QR code" /> : <Loader size="sm" />}
          <Text size="xs" c="dimmed" ta="center">
            {t('cannotScan')}
          </Text>
          <Code fz="sm" style={{ wordBreak: 'break-all' }}>
            {setup.data.secret}
          </Code>
          <Text size="sm">{t('enterCode')}</Text>
          {enable.error && (
            <Alert color="red" variant="light" w="100%">
              {enable.error.message}
            </Alert>
          )}
          <PinInput
            length={6}
            type="number"
            oneTimeCode
            size="lg"
            value={code}
            onChange={setCode}
            onComplete={(v) => enable.mutate(v)}
            aria-label="Authenticator code"
          />
          <Button
            fullWidth
            loading={enable.isPending}
            disabled={code.length !== 6}
            onClick={() => enable.mutate(code)}
          >
            {t('turnOn2fa')}
          </Button>
          <Anchor
            component="button"
            type="button"
            size="xs"
            onClick={() => navigate({ to: '/login', search: {} })}
          >
            {t('backToSignIn')}
          </Anchor>
        </Stack>
      )}
    </AuthLayout>
  );
}
