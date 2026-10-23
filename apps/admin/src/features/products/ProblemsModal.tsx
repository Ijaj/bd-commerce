import { Button, List, Modal, Stack, Text } from '@mantine/core';

/** Lists the reasons the API refused to publish a product (400 `problems[]`). */
export function ProblemsModal({
  problems,
  onClose,
}: {
  problems: string[] | null;
  onClose: () => void;
}) {
  return (
    <Modal opened={!!problems} onClose={onClose} title="Cannot publish yet" size="md" centered>
      <Stack gap="sm">
        <Text size="sm">Fix these before publishing:</Text>
        <List size="sm" spacing={4}>
          {problems?.map((p) => (
            <List.Item key={p}>{p}</List.Item>
          ))}
        </List>
        <Button onClick={onClose} ml="auto">
          Close
        </Button>
      </Stack>
    </Modal>
  );
}
