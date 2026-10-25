import { bdcTheme } from '@bdc/ui';
import { createTheme, mergeThemeOverrides } from '@mantine/core';

export { bdcColorSchemeManager, bdcCssVariablesResolver } from '@bdc/ui';

/** Brand D theme from @bdc/ui (C60) with the portal's mobile-first, finger-sized controls on top. */
export const theme = mergeThemeOverrides(
  bdcTheme,
  createTheme({
    fontSizes: { xs: '12px', sm: '13.5px', md: '15px', lg: '17px', xl: '20px' },
    components: {
      Button: { defaultProps: { size: 'md' } },
      TextInput: { defaultProps: { size: 'md' } },
      PasswordInput: { defaultProps: { size: 'md' } },
      NumberInput: { defaultProps: { size: 'md', hideControls: true, inputMode: 'numeric' } },
      Textarea: { defaultProps: { size: 'md' } },
      Select: { defaultProps: { size: 'md' } },
      SegmentedControl: { defaultProps: { size: 'md' } },
    },
  }),
);
