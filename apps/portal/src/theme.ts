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

/** Mobile-first partner theme: indigo primary, teal accent, finger-sized controls. */
export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 7, dark: 5 },
  colors: { indigo, teal },
  fontFamily: '"DM Sans", "Noto Sans Bengali", system-ui, -apple-system, "Segoe UI", sans-serif',
  fontSizes: { xs: '12px', sm: '13.5px', md: '15px', lg: '17px', xl: '20px' },
  defaultRadius: 'md',
  headings: { fontWeight: '700', sizes: { h1: { fontSize: '22px' }, h2: { fontSize: '17px' } } },
  components: {
    Button: { defaultProps: { size: 'md' } },
    TextInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    NumberInput: { defaultProps: { size: 'md', hideControls: true, inputMode: 'numeric' } },
    Textarea: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
    SegmentedControl: { defaultProps: { size: 'md' } },
    Paper: { defaultProps: { withBorder: true, p: 'md' } },
  },
});
