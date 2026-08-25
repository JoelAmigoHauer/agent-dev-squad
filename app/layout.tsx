import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Thelma',
  description: 'Supervised agentic portfolio management for RIAs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
