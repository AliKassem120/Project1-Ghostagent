"use client";
import { PartyPopper } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Events"
            subtitle="Add events and let your AI handle RSVPs and ticket questions automatically."
            description="AI-powered event management is coming soon."
            icon={PartyPopper}
            iconColor="text-pink-400"
            iconBg="bg-pink-500/10"
            whatItWillDo={[
                "Share event details, dates, and ticket prices via Instagram DM",
                "Capture RSVP intent and guest information automatically",
                "Handle FAQs about location, lineup, and entry requirements",
            ]}
            settingsLink={true}
        />
    );
}