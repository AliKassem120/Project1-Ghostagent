"use client";
import { Download } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Downloads"
            subtitle="Manage your digital products and let the AI handle purchase questions."
            description="Digital downloads management is coming soon."
            icon={Download}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            whatItWillDo={[
                "Answer questions about your digital products automatically",
                "Share pricing, formats, and delivery details via DM",
                "Capture purchase intent and hand off to your checkout flow",
            ]}
            settingsLink={true}
        />
    );
}