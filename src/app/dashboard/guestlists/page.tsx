"use client";
import { Ticket } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Guestlists"
            subtitle="Manage your event guestlists and let the AI confirm attendance."
            description="Guestlist management is coming soon."
            icon={Ticket}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10"
            whatItWillDo={[
                "Check names off your guestlist automatically via DM",
                "Send confirmation messages to approved guests",
                "Instantly notify you when capacity limits are reached",
            ]}
            settingsLink={true}
        />
    );
}