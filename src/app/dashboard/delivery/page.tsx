"use client";
import { Map } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Delivery Zones"
            subtitle="Manage your delivery zones so the AI can answer location-based queries."
            description="Delivery zone management is coming soon."
            icon={Map}
            iconColor="text-green-400"
            iconBg="bg-green-500/10"
            whatItWillDo={[
                "Specify delivery areas, fees, and minimum orders",
                "Automatically check customer addresses via DM",
                "Route out-of-zone customers to alternative options",
            ]}
            settingsLink={true}
        />
    );
}