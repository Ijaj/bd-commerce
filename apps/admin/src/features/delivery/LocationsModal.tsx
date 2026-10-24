import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { deliveryApi, type LocationRef } from './api';
import {
  districtsQuery,
  divisionsQuery,
  upazilasQuery,
  useInvalidateZones,
  type Zone,
  zonesQuery,
} from './queries';

const LEVEL_LABEL = { district: 'District', upazila: 'Upazila', area: 'Area' } as const;

/**
 * Coverage editor. A location can belong to one zone only; the API answers 409 with the owning
 * zone's name when it is taken, which is shown as-is.
 */
export function LocationsModal({ zoneId, onClose }: { zoneId: string; onClose: () => void }) {
  const invalidate = useInvalidateZones();
  const zones = useQuery(zonesQuery);
  const zone: Zone | undefined = zones.data?.find((z) => z.id === zoneId);

  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [upazilaId, setUpazilaId] = useState<string | null>(null);

  const divisions = useQuery(divisionsQuery);
  const districts = useQuery({
    ...districtsQuery(Number(divisionId)),
    enabled: divisionId !== null,
  });
  const upazilas = useQuery({
    ...upazilasQuery(Number(districtId)),
    enabled: districtId !== null,
  });

  const add = useMutation({
    mutationFn: (loc: LocationRef) => deliveryApi.addLocation(zoneId, loc),
    onSuccess: () => {
      notifyOk('Location added');
      invalidate();
    },
    onError: (e) => notifyError(e, 'Could not add the location'),
  });
  const remove = useMutation({
    mutationFn: (locationId: string) => deliveryApi.removeLocation(zoneId, locationId),
    onSuccess: () => {
      invalidate();
    },
    onError: (e) => notifyError(e, 'Could not remove the location'),
  });

  const opts = (rows: { id: number; nameEn: string }[] | undefined) =>
    (rows ?? []).map((r) => ({ value: String(r.id), label: r.nameEn }));

  return (
    <Modal opened onClose={onClose} title={`Coverage: ${zone?.nameEn ?? ''}`} centered size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          The most specific match wins: an upazila overrides its district. Places no zone covers use
          the default zone.
        </Text>

        <Group gap={6}>
          {zone?.locations.length === 0 && (
            <Text size="sm" c="dimmed">
              No places yet.
            </Text>
          )}
          {zone?.locations.map((l) => (
            <Badge
              key={l.id}
              variant="light"
              size="lg"
              tt="none"
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  aria-label={`Remove ${l.nameEn}`}
                  loading={remove.isPending && remove.variables === l.id}
                  onClick={() => remove.mutate(l.id)}
                >
                  <IconX size={12} />
                </ActionIcon>
              }
            >
              {l.nameEn} <span style={{ opacity: 0.6 }}>({LEVEL_LABEL[l.level]})</span>
            </Badge>
          ))}
        </Group>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Add a place
          </Text>
          <Group grow align="flex-start">
            <Select
              label="Division"
              placeholder="Pick a division"
              data={opts(divisions.data)}
              value={divisionId}
              searchable
              onChange={(v) => {
                setDivisionId(v);
                setDistrictId(null);
                setUpazilaId(null);
              }}
            />
            <Select
              label="District"
              placeholder="Pick a district"
              data={opts(districts.data)}
              value={districtId}
              disabled={!divisionId}
              searchable
              onChange={(v) => {
                setDistrictId(v);
                setUpazilaId(null);
              }}
            />
            <Select
              label="Upazila"
              placeholder="Whole district"
              data={opts(upazilas.data)}
              value={upazilaId}
              disabled={!districtId}
              searchable
              clearable
              onChange={setUpazilaId}
            />
          </Group>
          <Group justify="flex-end">
            <Button
              disabled={!districtId}
              loading={add.isPending}
              onClick={() =>
                add.mutate(
                  upazilaId ? { upazilaId: Number(upazilaId) } : { districtId: Number(districtId) },
                )
              }
            >
              {upazilaId ? 'Add upazila' : 'Add whole district'}
            </Button>
          </Group>
        </Stack>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
