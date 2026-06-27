import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contractly — Generate contracts from your template',
  description:
    'Upload a Word contract template once, fill a short form, and download a finished .docx every time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink-900 antialiased">{children}</body>
    </html>
  );
}
