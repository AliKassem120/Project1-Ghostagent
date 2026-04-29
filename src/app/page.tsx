// This page is handled by [locale]/page.tsx via next-intl middleware.
// Root page redirects to the default locale automatically.
import { redirect } from 'next/navigation';

export default function RootPage() {
    redirect('/en');
}
