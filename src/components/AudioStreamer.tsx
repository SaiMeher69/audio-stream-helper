
import React from "react";
import AudioVisualizer from "@/components/AudioVisualizer";
import ConnectionStatus from "@/components/ConnectionStatus";
import AudioControls from "@/components/AudioControls";
import { useAudioStreaming } from "@/hooks/useAudioStreaming";

interface AudioStreamerProps {
  backendUrl?: string;
}

const AudioStreamer: React.FC<AudioStreamerProps> = ({ 
  backendUrl = "ws://localhost:8000/ws" 
}) => {
  const {
    isStreaming,
    isConnected,
    micPermission,
    inputLevel,
    outputLevel,
    toggleStreaming
  } = useAudioStreaming({ backendUrl });

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-6 space-y-8">
      <div className="flex flex-col items-center space-y-4 w-full">
        {/* Connection status */}
        <ConnectionStatus isConnected={isConnected} />
        
        {/* Audio visualizers */}
        <AudioVisualizer inputLevel={inputLevel} outputLevel={outputLevel} />
        
        {/* Stream control button */}
        <AudioControls 
          isStreaming={isStreaming}
          micPermission={micPermission}
          onToggleStreaming={toggleStreaming}
        />
      </div>
    </div>
  );
};

export default AudioStreamer;
