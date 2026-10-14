'use client';
import { Column, DataColumn, DataTable, Row, Text } from '@umami/react-zen';
import { useMemo, useState } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { DateDistance } from '@/components/common/DateDistance';
import { Empty } from '@/components/common/Empty';
import Link from '@/components/common/Link';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { Pager } from '@/components/common/Pager';
import {
  useEventDataPivotQuery,
  useEventDataPropertiesQuery,
  useMessages,
  useMobile,
  useNavigation,
} from '@/components/hooks';
import type { EventPropertyFilter } from '@/lib/types';

export function EventDataPivotTable({
  websiteId,
  eventName,
  eventFilters = [],
}: {
  websiteId: string;
  eventName: string;
  eventFilters?: EventPropertyFilter[];
}) {
  const { t, labels } = useMessages();
  const { router, updateParams } = useNavigation();
  const { isMobile } = useMobile();
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' as 'asc' | 'desc' });

  const propertiesQuery = useEventDataPropertiesQuery(websiteId);
  const pivotQuery = useEventDataPivotQuery(websiteId, eventName, eventFilters);

  const propertyKeys = useMemo(() => {
    if (!propertiesQuery.data || !eventName) return [];
    const keys = propertiesQuery.data
      .filter((e: { eventName: string }) => e.eventName === eventName)
      .map((e: { propertyName: string }) => e.propertyName);
    return [...new Set<string>(keys)];
  }, [propertiesQuery.data, eventName]);

  const tableMinWidth = useMemo(() => {
    return `${72 + 220 + 180 + propertyKeys.length * 160}px`;
  }, [propertyKeys.length]);

  const tableData = useMemo(() => {
    if (!pivotQuery.data?.data) return [];
    return pivotQuery.data.data.map(
      (row: {
        eventId: string;
        sessionId: string;
        eventName: string;
        urlPath: string;
        createdAt: string;
        propertyKeys: string[];
        propertyValues: string[];
      }) => {
        const flat: Record<string, any> = {
          eventId: row.eventId,
          sessionId: row.sessionId,
          urlPath: row.urlPath,
          createdAt: row.createdAt,
        };
        row.propertyKeys.forEach((key, i) => {
          flat[key] = row.propertyValues[i] ?? '';
        });
        return flat;
      },
    );
  }, [pivotQuery.data]);

  const sortedTableData = useMemo(() => [...tableData].sort((a, b) => {
    const left = a[sort.key] ?? '';
    const right = b[sort.key] ?? '';
    const leftNumber = Number(left), rightNumber = Number(right);
    const compared = left !== '' && right !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? compared : -compared;
  }), [tableData, sort]);

  const sortLabel = (key: string, label: string) => (
    <button
      type="button"
      aria-label={`Sort by ${label}`}
      aria-pressed={sort.key === key}
      onClick={() => setSort(current => ({
        key,
        direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
      }))}
      className="inline-flex appearance-none items-center gap-1 border-0 bg-transparent p-0 text-inherit"
    >
      {label}{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );

  const tableQuery = useMemo(
    () => (pivotQuery.data ? { ...pivotQuery.data, data: sortedTableData } : undefined),
    [pivotQuery.data, sortedTableData],
  );

  const showPager = tableQuery && tableQuery.count > tableQuery.pageSize;

  const handlePageChange = (page: number) => {
    router.push(updateParams({ page }));
  };

  const renderTruncatedText = (value: string) => (
    <Row overflow="hidden" minWidth="0" width="100%">
      <Text truncate title={value} style={{ maxWidth: '100%' }}>
        {value}
      </Text>
    </Row>
  );

  return (
    <Column gap="4" minWidth="0" width="100%" maxWidth="100%">
      <LoadingPanel
        data={tableQuery?.data}
        isLoading={pivotQuery.isLoading}
        isFetching={pivotQuery.isFetching}
        error={pivotQuery.error}
        renderEmpty={() => <Empty />}
      >
        <Column gap="4" minWidth="0" width="100%" maxWidth="100%">
          {isMobile ? (
            <DataTable data={tableQuery?.data} style={{ width: '100%' }} displayMode="cards">
              <DataColumn id="session" label={t(labels.session)} width="72px">
                {(row: any) => (
                  <Link href={updateParams({ session: row.sessionId })}>
                    <Avatar seed={row.sessionId} size={32} />
                  </Link>
                )}
              </DataColumn>
              <DataColumn id="urlPath" label={sortLabel('urlPath', t(labels.path))} width="220px">
                {(row: any) => renderTruncatedText(row.urlPath ?? '')}
              </DataColumn>
              {propertyKeys.map(key => (
                <DataColumn key={key} id={key} label={sortLabel(key, key)} width="160px">
                  {(row: any) => renderTruncatedText(row[key] ?? '')}
                </DataColumn>
              ))}
              <DataColumn id="createdAt" label={sortLabel('createdAt', t(labels.created))} width="180px">
                {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
              </DataColumn>
            </DataTable>
          ) : (
            <div
              style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
            >
              <div style={{ width: tableMinWidth, minWidth: tableMinWidth }}>
                <DataTable data={tableQuery?.data} style={{ width: '100%' }} displayMode="table">
                  <DataColumn id="session" label={t(labels.session)} width="72px">
                    {(row: any) => (
                      <Link href={updateParams({ session: row.sessionId })}>
                        <Avatar seed={row.sessionId} size={32} />
                      </Link>
                    )}
                  </DataColumn>
                  <DataColumn id="urlPath" label={sortLabel('urlPath', t(labels.path))} width="220px">
                    {(row: any) => renderTruncatedText(row.urlPath ?? '')}
                  </DataColumn>
                  {propertyKeys.map(key => (
                    <DataColumn key={key} id={key} label={sortLabel(key, key)} width="160px">
                      {(row: any) => renderTruncatedText(row[key] ?? '')}
                    </DataColumn>
                  ))}
                  <DataColumn id="createdAt" label={sortLabel('createdAt', t(labels.created))} width="180px">
                    {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
                  </DataColumn>
                </DataTable>
              </div>
            </div>
          )}
          {showPager && tableQuery && (
            <Row marginTop="6">
              <Pager
                page={tableQuery.page}
                pageSize={tableQuery.pageSize}
                count={tableQuery.count}
                onPageChange={handlePageChange}
              />
            </Row>
          )}
        </Column>
      </LoadingPanel>
    </Column>
  );
}
