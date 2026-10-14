import type { Metadata } from 'next';
import { GameAnalyticsPage } from './GameAnalyticsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  return <GameAnalyticsPage websiteId={websiteId} />;
}

export const metadata: Metadata = { title: 'Game Analytics' };
