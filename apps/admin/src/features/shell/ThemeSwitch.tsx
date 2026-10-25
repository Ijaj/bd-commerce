import { Icon } from '@bdc/ui';
import { Menu, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';

/** Light / dark / system, persisted by Mantine's colour-scheme manager (`bdc.theme`). */
export function ThemeSwitch({ className }: { className?: string }) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  const options = [
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'auto', label: 'System', icon: 'device' },
  ] as const;
  return (
    <Menu position="bottom-end" width={160} withinPortal>
      <Menu.Target>
        <button
          type="button"
          className={className ? `a-btn ghost icon ${className}` : 'a-btn ghost icon'}
          aria-label="Theme"
        >
          <Icon name={computed === 'dark' ? 'sun' : 'moon'} />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {options.map((o) => (
          <Menu.Item
            key={o.value}
            leftSection={<Icon name={o.icon} size={16} />}
            rightSection={colorScheme === o.value ? <Icon name="check" size={14} /> : null}
            onClick={() => setColorScheme(o.value)}
          >
            {o.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
