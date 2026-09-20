import SchoolDetailClient from './SchoolDetailClient';
import { AppProvider } from '../../lib/context';
import schoolsData from '../../../data/schools.json';

type Params = Promise<{ unitid: string }>;

export function generateStaticParams() {
  return schoolsData.map((s: { unitid: string }) => ({ unitid: s.unitid }));
}

export default async function SchoolDetailPage({ params }: { params: Params }) {
  const { unitid } = await params;
  return (
    <AppProvider>
      <SchoolDetailClient unitid={unitid} />
    </AppProvider>
  );
}
