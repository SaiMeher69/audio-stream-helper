
import AudioStreamer from "@/components/AudioStreamer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 px-4 border-b border-border">
        <h1 className="text-2xl font-bold text-center">Audio Stream Processor</h1>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <AudioStreamer backendUrl="ws://localhost:8008/ws" />
      </main>
      
      <footer className="py-4 px-4 border-t border-border text-center text-sm text-muted-foreground">
        <p>Low-latency audio streaming with FastAPI WebSockets</p>
      </footer>
    </div>
  );
};

export default Index;
