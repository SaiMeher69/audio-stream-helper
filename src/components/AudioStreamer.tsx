
import React, { useState, useEffect, useRef } from "react";
import { Mic, Volume2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  rtcConfig, 
  defaultAudioConstraints, 
  getAudioLevel, 
  connectStreamToAnalyzer 
} from "@/utils/audioUtils";

interface AudioStreamerProps {
  backendUrl?: string; // Optional backend URL (default to echo server if not provided)
}

const AudioStreamer: React.FC<AudioStreamerProps> = ({ 
  backendUrl = "wss://echo.webrtc.org" // Default echo server for testing
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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const outputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Audio element for playback
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Clean up resources when component unmounts or streaming stops
  const cleanupResources = () => {
    // Stop animation frame if running
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
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

  // Setup WebRTC connection
  const setupPeerConnection = async () => {
    try {
      // Create peer connection
      const peerConnection = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = peerConnection;
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate:", event.candidate);
        }
      };
      
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);
        setIsConnected(peerConnection.connectionState === 'connected');
        
        if (
          peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed'
        ) {
          toast({
            title: "Connection lost",
            description: "The connection to the audio server was lost.",
            variant: "destructive",
          });
          cleanupResources();
        }
      };
      
      // Create remote stream for receiving audio
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      
      // When remote tracks are received, add them to our remote stream
      peerConnection.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = remoteStream;
          
          // Set up analyzer for output audio
          if (audioContextRef.current) {
            const audioContext = audioContextRef.current;
            const { analyzer } = connectStreamToAnalyzer(remoteStream, audioContext);
            outputAnalyzerRef.current = analyzer;
            
            // Start polling audio levels
            startAudioLevelMonitoring();
          }
        }
      };
      
      // Add local audio track to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }
      
      // Create and set local description (offer)
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await peerConnection.setLocalDescription(offer);
      
      // For this example, we'll simulate a server response with a local answer
      // In a real application, you would send the offer to your server and get an answer back
      setTimeout(async () => {
        if (peerConnection.localDescription) {
          const answer = await peerConnection.createAnswer();
          await peerConnection.setRemoteDescription(
            peerConnection.localDescription
          );
          await peerConnection.setLocalDescription(answer);
          
          console.log("Local connection established");
          setIsConnected(true);
        }
      }, 500);
      
    } catch (error) {
      console.error("Error setting up WebRTC:", error);
      toast({
        title: "Connection error",
        description: "Could not establish WebRTC connection.",
        variant: "destructive",
      });
      cleanupResources();
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
      // Check if already streaming
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
      
      // Start streaming
      setIsStreaming(true);
      
      // Setup WebRTC connection
      setupPeerConnection();
      
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
              <Wifi className="w-4 h-4 text-audio-input" />
              <span>Connected to server</span>
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
          
          {/* Hidden audio element for playback */}
          <audio 
            ref={audioElementRef} 
            autoPlay 
            playsInline 
            className="hidden" 
          />
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
