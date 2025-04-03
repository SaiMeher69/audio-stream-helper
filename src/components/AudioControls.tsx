
import React from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioControlsProps {
  isStreaming: boolean;
  micPermission: boolean | null;
  onToggleStreaming: () => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({ 
  isStreaming, 
  micPermission, 
  onToggleStreaming 
}) => {
  return (
    <div className="flex flex-col items-center">
      <Button
        onClick={onToggleStreaming}
        className={`mt-8 px-8 py-6 rounded-full w-32 h-32 flex items-center justify-center transition-all ${
          isStreaming 
            ? 'bg-destructive hover:bg-destructive/90' 
            : 'bg-primary hover:bg-primary/90'
        }`}
      >
        <div className="relative">
          <Mic className={`w-10 h-10 ${isStreaming ? 'animate-pulse-slow' : ''}`} />
          {isStreaming && (
            <span className="absolute inset-0 rounded-full border-4 border-primary-foreground/30 animate-ping"></span>
          )}
        </div>
      </Button>
      
      {/* Status/instruction text */}
      <p className="text-sm text-muted-foreground mt-2">
        {isStreaming 
          ? "Tap to stop streaming" 
          : micPermission === false 
            ? "Microphone access denied" 
            : "Tap to start streaming"}
      </p>
    </div>
  );
};

export default AudioControls;
