"use client";
import { Users } from "lucide-react";
import ComingSoonPage from "@/components/ComingSoonPage";

export default function Page() {
    return (
        <ComingSoonPage
            title="CRM"
            subtitle="Track leads and prospects generated from your AI agent."
            description="Lead CRM is coming soon."
            icon={Users}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/10"
            whatItWillDo={[
                "Every lead captured by the AI is automatically stored here",
                "Track which conversations turned into real inquiries",
                "Follow up manually or let the AI re-engage warm leads",
            ]}
            settingsLink={true}
        />
    );
}