import ChecklistClient from './ChecklistClient';
import { AppProvider } from '../../../lib/context';
import schoolsData from '../../../../data/schools.json';
import { School } from '../../../lib/types';

type Params = Promise<{ unitid: string }>;

const schools = schoolsData as School[];

export function generateStaticParams() {
  return schools.map((s) => ({ unitid: s.unitid }));
}

export default async function ChecklistPage({ params }: { params: Params }) {
  const { unitid } = await params;
  return (
    <AppProvider>
      <ChecklistClient unitid={unitid} />
    </AppProvider>
  );
}
