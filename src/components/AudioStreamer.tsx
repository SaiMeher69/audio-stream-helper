import React, { useState, useEffect, useRef } from "react";
import { Mic, Volume2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  defaultAudioConstraints, 
  getAudioLevel, 
  connectStreamToAnalyzer,
  createAudioProcessor
} from "@/utils/audioUtils";
import WebSocketService from "@/services/websocketService";

interface AudioStreamerProps {
  backendUrl?: string; // WebSocket URL for backend
}

const AudioStreamer: React.FC<AudioStreamerProps> = ({ 
  backendUrl = "http://localhost:8008/ws" // Default to local FastAPI WebSocket
}) => {
  const { toast } = useToast();
  
  // Stream and connection state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  
  // Audio levels for visualization
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  
  // Refs for persistent values between renders
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const outputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const webSocketRef = useRef<WebSocketService | null>(null);
  
  // Clean up resources when component unmounts or streaming stops
  const cleanupResources = () => {
    // Stop animation frame if running
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop processor if running
    if (processorRef.current && audioContextRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Disconnect WebSocket last after all other resources are cleaned up
    if (webSocketRef.current) {
      webSocketRef.current.disconnect();
      webSocketRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Reset state
    setIsStreaming(false);
    setIsConnected(false);
    setInputLevel(0);
    setOutputLevel(0);
  };

  // Setup WebSocket connection
  const setupWebSocketConnection = async () => {
    try {
      // Create new audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          latencyHint: 'interactive', // Low latency mode
          sampleRate: 48000
        });
      }
      
      const webSocketService = new WebSocketService(backendUrl);
      webSocketRef.current = webSocketService;
      
      // Register event handlers
      webSocketService.onConnect(() => {
        setIsConnected(true);
        toast({
          title: "Connected to server",
          description: "Audio streaming connection established."
        });
      });
      
      webSocketService.onDisconnect(() => {
        setIsConnected(false);
        toast({
          title: "Disconnected from server",
          description: "The connection to the audio server was lost.",
          variant: "destructive",
        });
      });
      
      webSocketService.onMessage((audioData) => {
        console.log("1")
        if (audioContextRef.current) {
          try {
            // Process received audio data
            const audioContext = audioContextRef.current;
            
            // Convert ArrayBuffer to AudioBuffer and play it
            audioContext.decodeAudioData(audioData, (buffer) => {
              // Create a buffer source for playback
              const source = audioContext.createBufferSource();
              source.buffer = buffer;
              
              // Connect to output analyzer for visualization if available
              if (outputAnalyzerRef.current) {
                source.connect(outputAnalyzerRef.current);
                outputAnalyzerRef.current.connect(audioContext.destination);
              } else {
                // Connect directly to destination if no analyzer
                source.connect(audioContext.destination);
              }
              
              // Start playing the audio immediately
              source.start(0);
              
              console.log("Playing received audio data");
            }).catch(err => {
              console.error("Error decoding audio data:", err);
            });
          } catch (error) {
            console.error("Error processing audio response:", error);
          }
        }
      });
      
      // Connect to WebSocket server
      await webSocketService.connect();
      
      // Set up audio processor for sending data only if we have local stream
      if (audioContextRef.current && localStreamRef.current) {
        const processor = createAudioProcessor(audioContextRef.current, localStreamRef.current);
        processorRef.current = processor;
        
        // Process audio data and send it over WebSocket
        processor.onaudioprocess = (e) => {
          if (webSocketService.connected) {
            console.log("Sending audio data...........");
            const inputData = e.inputBuffer.getChannelData(0);
            webSocketService.sendAudioData(inputData);
          }
        };
      }
      
    } catch (error) {
      console.error("Error setting up WebSocket:", error);
      toast({
        title: "Connection error",
        description: "Could not establish connection to the audio server.",
        variant: "destructive",
      });
    }
  };

  // Monitor audio levels for visualization
  const startAudioLevelMonitoring = () => {
    const updateLevels = () => {
      if (inputAnalyzerRef.current) {
        setInputLevel(getAudioLevel(inputAnalyzerRef.current));
      }
      
      if (outputAnalyzerRef.current) {
        setOutputLevel(getAudioLevel(outputAnalyzerRef.current));
      }
      
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateLevels);
  };

  // Request microphone access and start streaming
  const startStreaming = async () => {
    try {
      // If already streaming, stop it
      if (isStreaming) {
        cleanupResources();
        return;

      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: defaultAudioConstraints,
        video: false
      });
      
      localStreamRef.current = stream;
      setMicPermission(true);
      
      // Create audio context
      const audioContext = new AudioContext({
        latencyHint: 'interactive', // Low latency mode
        sampleRate: 48000
      });
      audioContextRef.current = audioContext;
      
      // Connect input stream to analyzer
      const { analyzer } = connectStreamToAnalyzer(stream, audioContext);
      inputAnalyzerRef.current = analyzer;
      
      // Create output analyzer
      const outputAnalyzer = audioContext.createAnalyser();
      outputAnalyzer.fftSize = 256;
      outputAnalyzer.smoothingTimeConstant = 0.5;
      outputAnalyzerRef.current = outputAnalyzer;
      
      // Start streaming
      setIsStreaming(true);
      
      // Setup WebSocket connection
      await setupWebSocketConnection();
      
      // Start audio level monitoring
      startAudioLevelMonitoring();
      
      toast({
        title: "Streaming started",
        description: "Microphone is now streaming to the server.",
      });
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      
      if ((error as DOMException).name === 'NotAllowedError') {
        setMicPermission(false);
        toast({
          title: "Permission denied",
          description: "Please allow microphone access to use this app.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Streaming error",
          description: "Could not access microphone or start streaming.",
          variant: "destructive",
        });
      }
      
      cleanupResources();
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

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
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-6 space-y-8">
      <div className="flex flex-col items-center space-y-4 w-full">
        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-primary" />
              <span>Connected to FastAPI server</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-muted-foreground" />
              <span>Not connected</span>
            </>
          )}
        </div>
        
        {/* Audio controls */}
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
        
        {/* Stream control button */}
        <Button
          onClick={startStreaming}
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
    </div>
  );
};

export default AudioStreamer;
