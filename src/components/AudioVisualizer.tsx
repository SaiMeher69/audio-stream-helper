
import React from "react";
import { Mic, Volume2 } from "lucide-react";

interface AudioVisualizerProps {
  inputLevel: number;
  outputLevel: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  inputLevel, 
  outputLevel 
}) => {
  // Render audio level indicators
  const renderAudioLevel = (level: number, color: string) => {
    const bars = 10;
    const activeBars = Math.ceil(level * bars);
    
    return (
      <div className="flex h-4 gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div 
            key={i}
            className={`w-1 rounded-sm transition-all duration-100 ${i < activeBars ? 'opacity-100' : 'opacity-20'}`}
            style={{ 
              height: `${Math.min(100, 40 + (i * 6))}%`,
              backgroundColor: color
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Input audio visualizer */}
      <div className="flex flex-col items-center space-y-2 w-full">
        <div className="flex justify-between w-full">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Mic className="w-3 h-3" /> Input
          </span>
          <div className="h-4 w-full flex-1 mx-4">
            {renderAudioLevel(inputLevel, '#4CAF50')}
          </div>
        </div>
      </div>
      
      {/* Output audio visualizer */}
      <div className="flex flex-col items-center space-y-2 w-full">
        <div className="flex justify-between w-full">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Volume2 className="w-3 h-3" /> Output
          </span>
          <div className="h-4 w-full flex-1 mx-4">
            {renderAudioLevel(outputLevel, '#2196F3')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioVisualizer;
