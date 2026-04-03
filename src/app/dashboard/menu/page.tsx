"use client";
import { UtensilsCrossed } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Menu"
            subtitle="Manage your menu items so the AI can answer product & pricing questions."
            description="AI-powered menu management is coming soon."
            icon={UtensilsCrossed}
            iconColor="text-orange-400"
            iconBg="bg-orange-500/10"
            whatItWillDo={[
                "Let the AI answer questions about dishes, prices, and availability",
                "Mark items as out-of-stock so the AI stops promoting them",
                "Set up categories so customers can browse your menu via DM",
            ]}
            settingsLink={true}
        />
    );
}