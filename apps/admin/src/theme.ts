import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Tailwind indigo/teal scales so shade 7 matches the mockup brand (#4338ca / #0f766e).
const indigo: MantineColorsTuple = [
  '#eef2ff',
  '#e0e7ff',
  '#c7d2fe',
  '#a5b4fc',
  '#818cf8',
  '#6366f1',
  '#4f46e5',
  '#4338ca',
  '#3730a3',
  '#312e81',
];
const teal: MantineColorsTuple = [
  '#f0fdfa',
  '#ccfbf1',
  '#99f6e4',
  '#5eead4',
  '#2dd4bf',
  '#14b8a6',
  '#0d9488',
  '#0f766e',
  '#115e59',
  '#134e4a',
];

/** Dense admin theme: indigo primary, teal accent, small controls. */
export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 7, dark: 5 },
  colors: { indigo, teal },
  fontFamily: '"DM Sans", "Noto Sans Bengali", system-ui, -apple-system, "Segoe UI", sans-serif',
  fontSizes: { xs: '11.5px', sm: '12.5px', md: '13.5px', lg: '15px', xl: '17px' },
  defaultRadius: 'sm',
  headings: { fontWeight: '700', sizes: { h1: { fontSize: '22px' }, h2: { fontSize: '18px' } } },
  spacing: { xs: '6px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  components: {
    Button: { defaultProps: { size: 'xs' } },
    ActionIcon: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'xs' } },
    PasswordInput: { defaultProps: { size: 'xs' } },
    NumberInput: { defaultProps: { size: 'xs' } },
    Textarea: { defaultProps: { size: 'xs' } },
    Select: { defaultProps: { size: 'xs' } },
    MultiSelect: { defaultProps: { size: 'xs' } },
    Checkbox: { defaultProps: { size: 'xs' } },
    Switch: { defaultProps: { size: 'xs' } },
    Badge: { defaultProps: { size: 'sm' } },
    Table: {
      defaultProps: { verticalSpacing: 4, horizontalSpacing: 'sm', highlightOnHover: true },
    },
    Paper: { defaultProps: { withBorder: true, p: 'md' } },
  },
});
