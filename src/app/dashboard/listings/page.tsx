"use client";
import { Home } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Property Listings"
            subtitle="Add and manage your property listings for AI-assisted lead qualification."
            description="AI-powered listings management is coming soon."
            icon={Home}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            whatItWillDo={[
                "The AI will answer inquiries about specific properties automatically",
                "Capture buyer and renter leads directly from Instagram DMs",
                "Share property details, price, and location when prospects ask",
            ]}
            settingsLink={true}
        />
    );
}