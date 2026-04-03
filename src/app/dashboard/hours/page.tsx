"use client";
import { Clock } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="Working Hours"
            subtitle="Set your availability so the AI knows when to hand off to a human."
            description="Working hours management is coming soon."
            icon={Clock}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10"
            whatItWillDo={[
                "Tell customers when you are open or closed",
                "Automatically adjust AI response behavior after hours",
                "Set rules for when manual hand-off is available",
            ]}
            settingsLink={true}
        />
    );
}