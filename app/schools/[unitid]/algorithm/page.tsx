import AlgorithmClient from './AlgorithmClient';
import { AppProvider } from '../../../lib/context';
import schoolsData from '../../../../data/schools.json';

type Params = Promise<{ unitid: string }>;

export function generateStaticParams() {
  return schoolsData.map((s: { unitid: string }) => ({ unitid: s.unitid }));
}

export default async function AlgorithmPage({ params }: { params: Params }) {
  const { unitid } = await params;
  return (
    <AppProvider>
      <AlgorithmClient unitid={unitid} />
    </AppProvider>
  );
}
