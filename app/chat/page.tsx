import type { Metadata } from 'next';
import ChatClient from './ChatClient';
import { AppProvider } from '../lib/context';

export const metadata: Metadata = {
  title: 'Counselor — Scholara',
};

export default function ChatPage() {
  return (
    <AppProvider>
      <ChatClient />
    </AppProvider>
  );
}
