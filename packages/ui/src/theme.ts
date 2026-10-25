import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  type CSSVariablesResolver,
  createTheme,
  Drawer,
  Input,
  InputWrapper,
  localStorageColorSchemeManager,
  type MantineColorsTuple,
  Menu,
  Modal,
  Notification,
  Pagination,
  Paper,
  SegmentedControl,
  Skeleton,
  Stepper,
  Switch,
  Table,
  Tabs,
  Timeline,
  Tooltip,
} from '@mantine/core';

// Real scales stay as fallbacks (Mantine needs 10 parseable shades); every variant colour that components
// actually paint with is remapped to brand tokens in `bdcCssVariablesResolver` below.
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

/** Mantine colour name → brand token. Badges/buttons pick their tone through the `color` prop. */
export const TONE_TOKENS: Record<string, string> = {
  indigo: '--bdc-primary',
  violet: '--bdc-primary',
  teal: '--bdc-accent',
  red: '--bdc-danger',
  pink: '--bdc-danger',
  green: '--bdc-success',
  lime: '--bdc-success',
  yellow: '--bdc-warn',
  orange: '--bdc-warn',
  blue: '--bdc-info',
  cyan: '--bdc-info',
  grape: '--bdc-c6',
};

function toneVars(name: string, token: string): Record<string, string> {
  const t = `var(${token})`;
  return {
    [`--mantine-color-${name}-filled`]: t,
    [`--mantine-color-${name}-filled-hover`]: `color-mix(in srgb, ${t} 88%, #000)`,
    [`--mantine-color-${name}-light`]: `color-mix(in srgb, ${t} 15%, var(--bdc-surface))`,
    [`--mantine-color-${name}-light-hover`]: `color-mix(in srgb, ${t} 22%, var(--bdc-surface))`,
    [`--mantine-color-${name}-light-color`]: t,
    [`--mantine-color-${name}-outline`]: t,
    [`--mantine-color-${name}-outline-hover`]: `color-mix(in srgb, ${t} 8%, transparent)`,
    [`--mantine-color-${name}-text`]: t,
  };
}

function schemeVars(): Record<string, string> {
  const vars: Record<string, string> = {
    '--mantine-color-body': 'var(--bdc-surface)',
    '--mantine-color-text': 'var(--bdc-text)',
    '--mantine-color-bright': 'var(--bdc-text)',
    '--mantine-color-dimmed': 'var(--bdc-muted)',
    '--mantine-color-anchor': 'var(--bdc-primary)',
    '--mantine-color-error': 'var(--bdc-danger)',
    '--mantine-color-success': 'var(--bdc-success)',
    '--mantine-color-placeholder': 'var(--bdc-muted)',
    '--mantine-color-default': 'var(--bdc-surface)',
    '--mantine-color-default-hover': 'var(--bdc-surface-2)',
    '--mantine-color-default-color': 'var(--bdc-text)',
    '--mantine-color-default-border': 'var(--bdc-border)',
    '--mantine-color-disabled': 'var(--bdc-surface-2)',
    '--mantine-color-disabled-color': 'var(--bdc-muted)',
    '--mantine-color-disabled-border': 'var(--bdc-border)',
    '--mantine-primary-color-filled': 'var(--bdc-primary)',
    '--mantine-primary-color-filled-hover': 'color-mix(in srgb, var(--bdc-primary) 88%, #000)',
    '--mantine-primary-color-light':
      'color-mix(in srgb, var(--bdc-primary) 15%, var(--bdc-surface))',
    '--mantine-primary-color-light-hover':
      'color-mix(in srgb, var(--bdc-primary) 22%, var(--bdc-surface))',
    '--mantine-primary-color-light-color': 'var(--bdc-primary)',
    '--mantine-primary-color-contrast': 'var(--bdc-on-primary)',
    // gray = .a-badge.muted / neutral buttons
    '--mantine-color-gray-filled': 'var(--bdc-muted)',
    '--mantine-color-gray-filled-hover': 'color-mix(in srgb, var(--bdc-muted) 88%, #000)',
    '--mantine-color-gray-light': 'var(--bdc-surface-2)',
    '--mantine-color-gray-light-hover':
      'color-mix(in srgb, var(--bdc-muted) 18%, var(--bdc-surface))',
    '--mantine-color-gray-light-color': 'var(--bdc-muted)',
    '--mantine-color-gray-outline': 'var(--bdc-muted)',
    '--mantine-color-gray-outline-hover': 'var(--bdc-surface-2)',
    '--mantine-color-gray-text': 'var(--bdc-muted)',
  };
  for (const [name, token] of Object.entries(TONE_TOKENS))
    Object.assign(vars, toneVars(name, token));
  return vars;
}

/** Points Mantine's own colour variables at the brand tokens; tokens.css switches them per scheme. */
export const bdcCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: schemeVars(),
  dark: schemeVars(),
});

/** Persists light / dark / auto ("system") under `bdc.theme`. */
export const bdcColorSchemeManager = localStorageColorSchemeManager({ key: 'bdc.theme' });

/** Brand D admin theme (C60): dense controls, 3/4/6 radius, DM Sans, mockup component looks. */
export const bdcTheme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 7, dark: 4 },
  colors: { indigo, teal },
  fontFamily: 'var(--bdc-font)',
  fontFamilyMonospace: 'var(--bdc-font-mono)',
  fontSizes: { xs: '11.5px', sm: '12.5px', md: '13.5px', lg: '15px', xl: '17px' },
  lineHeights: { md: '1.45' },
  radius: { xs: '3px', sm: '4px', md: '6px', lg: '6px', xl: '8px' },
  defaultRadius: 'sm',
  shadows: {
    xs: 'var(--bdc-sh-1)',
    sm: 'var(--bdc-sh-1)',
    md: 'var(--bdc-sh-2)',
    lg: 'var(--bdc-sh-2)',
  },
  spacing: { xs: '6px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  headings: {
    fontFamily: 'var(--bdc-font)',
    fontWeight: '800',
    sizes: {
      h1: { fontSize: '22px', lineHeight: '1.15' },
      h2: { fontSize: '18px', lineHeight: '1.2' },
      h3: { fontSize: '14px', lineHeight: '1.3' },
      h4: { fontSize: '13.5px', lineHeight: '1.3' },
    },
  },
  components: {
    Button: Button.extend({
      defaultProps: { size: 'xs' },
      classNames: { root: 'bdc-btn' },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { size: 'md' },
      classNames: { root: 'bdc-action' },
    }),
    Badge: Badge.extend({
      defaultProps: { size: 'sm', variant: 'light', radius: 'xs' },
      classNames: { root: 'bdc-badge' },
    }),
    Paper: Paper.extend({
      defaultProps: { withBorder: true, p: 'md' },
      classNames: { root: 'bdc-paper' },
    }),
    Card: Card.extend({ defaultProps: { withBorder: true }, classNames: { root: 'bdc-paper' } }),
    Table: Table.extend({
      defaultProps: { verticalSpacing: 4, horizontalSpacing: 'sm', highlightOnHover: true },
      classNames: { table: 'bdc-table' },
    }),
    Tabs: Tabs.extend({ classNames: { list: 'bdc-tabs-list', tab: 'bdc-tab' } }),
    Input: Input.extend({ defaultProps: { size: 'xs' }, classNames: { input: 'bdc-input' } }),
    InputWrapper: InputWrapper.extend({
      classNames: { label: 'bdc-label', description: 'bdc-hint', error: 'bdc-err' },
    }),
    TextInput: { defaultProps: { size: 'xs' } },
    PasswordInput: { defaultProps: { size: 'xs' } },
    NumberInput: { defaultProps: { size: 'xs' } },
    Textarea: { defaultProps: { size: 'xs' } },
    Select: { defaultProps: { size: 'xs' } },
    MultiSelect: { defaultProps: { size: 'xs' } },
    Checkbox: { defaultProps: { size: 'xs' } },
    Switch: Switch.extend({
      defaultProps: { size: 'sm', color: 'green' },
      classNames: { track: 'bdc-switch-track', thumb: 'bdc-switch-thumb' },
    }),
    Modal: Modal.extend({
      classNames: {
        content: 'bdc-modal',
        header: 'bdc-modal-h',
        title: 'bdc-modal-t',
        body: 'bdc-modal-b',
        overlay: 'bdc-overlay',
      },
    }),
    Drawer: Drawer.extend({
      classNames: {
        content: 'bdc-drawer',
        header: 'bdc-modal-h',
        title: 'bdc-modal-t',
        body: 'bdc-modal-b',
        overlay: 'bdc-overlay',
      },
    }),
    Menu: Menu.extend({ classNames: { dropdown: 'bdc-menu', item: 'bdc-menu-item' } }),
    Tooltip: Tooltip.extend({ classNames: { tooltip: 'bdc-tooltip' } }),
    Notification: Notification.extend({
      classNames: {
        root: 'bdc-toast',
        title: 'bdc-toast-title',
        description: 'bdc-toast-desc',
        closeButton: 'bdc-toast-close',
      },
    }),
    Pagination: Pagination.extend({
      defaultProps: { size: 'sm' },
      classNames: { control: 'bdc-pg' },
    }),
    Timeline: Timeline.extend({
      defaultProps: { color: 'green', bulletSize: 14, lineWidth: 2 },
      classNames: { item: 'bdc-tl-item', itemBullet: 'bdc-tl-bullet', itemTitle: 'bdc-tl-title' },
    }),
    Stepper: Stepper.extend({
      defaultProps: { color: 'green', size: 'sm' },
      classNames: { stepIcon: 'bdc-step-icon', stepLabel: 'bdc-step-label' },
    }),
    Alert: Alert.extend({
      defaultProps: { variant: 'light' },
      classNames: { root: 'bdc-alert', title: 'bdc-alert-title', message: 'bdc-alert-msg' },
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { size: 'xs' },
      classNames: { root: 'bdc-seg', label: 'bdc-seg-label' },
    }),
    Skeleton: Skeleton.extend({ classNames: { root: 'bdc-skeleton' } }),
    Anchor: Anchor.extend({ classNames: { root: 'bdc-anchor' } }),
  },
});
