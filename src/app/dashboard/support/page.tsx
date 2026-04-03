"use client";
import { HeadphonesIcon } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Support"
            subtitle="View and manage support tickets generated from customer conversations."
            description="AI-powered support ticket management is coming soon."
            icon={HeadphonesIcon}
            iconColor="text-rose-400"
            iconBg="bg-rose-500/10"
            whatItWillDo={[
                "Automatically tag conversations that need human follow-up",
                "The AI handles common questions, escalates the rest to you",
                "Track open vs resolved tickets without leaving your dashboard",
            ]}
            settingsLink={true}
        />
    );
}