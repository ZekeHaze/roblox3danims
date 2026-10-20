import './dashboard.module.css';

export const metadata = {
  title: 'Roblox Profile Inspector',
  description: 'Inspector de avatares y assets de Roblox',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}