import { AppProvider } from '../lib/context';

export default function SchoolsLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
