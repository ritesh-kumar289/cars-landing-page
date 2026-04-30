import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'OFFFINDS — Reel 07 · Curated rare finds',
  description:
    'A 3D immersive cinematic reel by OFFFINDS. Curated rare cars filmed in 70mm. Scroll to enter.',
  openGraph: {
    title: 'OFFFINDS — Reel 07',
    description: 'Curated rare finds. Driven obsessions.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Layered cinematic overlays — each on its own element to avoid
            the ::before / ::after pseudo-element conflict when multiple
            overlay classes are stacked on the same node. */}
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="scanlines" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
