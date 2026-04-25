import GhostAgentDemoVideoScene from '@/components/demo/GhostAgentDemoVideoScene';

export default function DemoRecordingPage() {
  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center m-0 p-0 overflow-hidden">
        {/* We center the fixed 1920x1080 scene. Playwright will be sized to 1920x1080 precisely. */}
        <div style={{ width: 1920, height: 1080, overflow: 'hidden' }}>
            <GhostAgentDemoVideoScene />
        </div>
    </div>
  );
}
