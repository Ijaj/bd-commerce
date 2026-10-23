import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { theme } from '~/theme';

/** Render with the Mantine provider the app uses. */
export function renderWithMantine(ui: ReactElement) {
  return render(
    <MantineProvider theme={theme} env="test">
      {ui}
    </MantineProvider>,
  );
}
