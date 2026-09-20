import type { Metadata } from 'next';
import TimelineClient from './TimelineClient';
import { AppProvider } from '../lib/context';

export const metadata: Metadata = {
  title: 'Timeline',
};

export default function TimelinePage() {
  return (
    <AppProvider>
      <TimelineClient />
    </AppProvider>
  );
}
