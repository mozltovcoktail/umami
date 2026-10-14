'use client';
import { Column, Tab, TabList, TabPanel, Tabs } from '@umami/react-zen';
import { type Key, useState } from 'react';
import { WebsiteControls } from '@/app/(main)/websites/[websiteId]/WebsiteControls';
import { Panel } from '@/components/common/Panel';
import { EventProperties } from '../events/EventProperties';

const GAME_DASHBOARDS = [
  { id: 'runs', label: 'Runs', prefixes: ['run_'] },
  { id: 'combat', label: 'Combat', prefixes: ['battle_'] },
  { id: 'choices', label: 'Choices', prefixes: ['route_', 'fate_', 'camp_'] },
  { id: 'inventory', label: 'Inventory and trade', prefixes: ['item_', 'merchant_'] },
];

export function GameAnalyticsPage({ websiteId }: { websiteId: string }) {
  const [dashboard, setDashboard] = useState<Key>('runs');
  return (
    <Column gap="3">
      <WebsiteControls websiteId={websiteId} allowCompare />
      <Panel title="Gameplay breakdowns" description="Filter by audience, build, outcome, and any event property. Sort the event rows by any property column.">
        <Tabs selectedKey={dashboard} onSelectionChange={setDashboard}>
          <TabList>
            {GAME_DASHBOARDS.map(view => <Tab key={view.id} id={view.id}>{view.label}</Tab>)}
          </TabList>
          {GAME_DASHBOARDS.map(view => (
            <TabPanel key={view.id} id={view.id}>
              <EventProperties websiteId={websiteId} gameOnly eventPrefixes={view.prefixes} />
            </TabPanel>
          ))}
        </Tabs>
      </Panel>
    </Column>
  );
}
