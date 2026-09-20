import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';
import { AppProvider } from '../lib/context';

export const metadata: Metadata = {
  title: 'Profile',
};

export default function ProfilePage() {
  return (
    <AppProvider>
      <ProfileClient />
    </AppProvider>
  );
}
