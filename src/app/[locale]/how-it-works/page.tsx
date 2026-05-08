import { setRequestLocale } from 'next-intl/server';
import HowItWorksPage from '../../../components/pages/HowItWorksPage';

export const metadata = {
    title: 'How It Works | GhostAgent',
    description: 'See how GhostAgent handles Instagram and WhatsApp conversations automatically — from message to smart reply, for ecommerce and appointment businesses.',
};

export default async function Page({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <HowItWorksPage />;
}
