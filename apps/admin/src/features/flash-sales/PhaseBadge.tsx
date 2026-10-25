import { Badge } from '@mantine/core';
import { PHASE_COLOR, PHASE_LABEL } from './logic';
import type { FlashPhase } from './queries';

export function PhaseBadge({ phase }: { phase: FlashPhase }) {
  return (
    <Badge size="sm" variant="light" color={PHASE_COLOR[phase]}>
      {PHASE_LABEL[phase]}
    </Badge>
  );
}
