import type { Metadata } from 'next';
import SchoolsClient from './SchoolsClient';

export const metadata: Metadata = {
  title: 'Schools',
};

export default function SchoolsPage() {
  return <SchoolsClient />;
}
