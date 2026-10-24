import { Tabs } from '@mantine/core';
import { PageHeader } from '~/components/PageHeader';
import { CommissionsTab } from './CommissionsTab';
import { TargetsTab } from './TargetsTab';
import { TeamTab } from './TeamTab';

export function SrSetupPage() {
  return (
    <div>
      <PageHeader
        title="SR team"
        description="Sales rep profiles, monthly targets and commissions."
      />
      <Tabs defaultValue="team" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="team">Team</Tabs.Tab>
          <Tabs.Tab value="targets">Targets</Tabs.Tab>
          <Tabs.Tab value="commissions">Commissions</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="team">
          <TeamTab />
        </Tabs.Panel>
        <Tabs.Panel value="targets">
          <TargetsTab />
        </Tabs.Panel>
        <Tabs.Panel value="commissions">
          <CommissionsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
