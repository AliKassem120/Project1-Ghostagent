import GhostAgentDemoVideoScene from '@/components/demo/GhostAgentDemoVideoScene';

export default function DemoRecordingPage() {
  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center m-0 p-0 overflow-hidden">
        <div style={{ width: 1920, height: 1080, overflow: 'hidden' }}>
            <GhostAgentDemoVideoScene recordingMode={true} />
        </div>
    </div>
  );
}
