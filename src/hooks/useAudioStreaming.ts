import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  defaultAudioConstraints, 
  connectStreamToAnalyzer,
  createAudioProcessor
} from "@/utils/audioUtils";
import WebSocketService from "@/services/websocketService";

interface UseAudioStreamingProps {
  backendUrl: string;
}

export const useAudioStreaming = ({ backendUrl }: UseAudioStreamingProps) => {
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

  // Setup WebSocket connection
  useEffect(() => {
    const setupWebSocketConnection = async () => {
      try {
        // Only create a new WebSocket connection if one doesn't exist
        if (!webSocketRef.current) {
          console.log("Setting up new WebSocket connection");
          
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
            console.log("WebSocket connected successfully");
            toast({
              title: "Connected to server",
              description: "Audio streaming connection established."
            });
          });
          
          webSocketService.onDisconnect(() => {
            setIsConnected(false);
            console.log("WebSocket disconnected");
            toast({
              title: "Disconnected from server",
              description: "The connection to the audio server was lost.",
              variant: "destructive",
            });
          });
          
          webSocketService.onMessage((audioData) => {
            console.log("Audio data received from server, size:", audioData.byteLength);
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

    setupWebSocketConnection();
    
    // Cleanup only when component unmounts
    return () => {
      if (webSocketRef.current) {
        console.log("Cleaning up WebSocket connection on unmount");
        webSocketRef.current.disconnect();
        webSocketRef.current = null;
      }
    };
  }, [backendUrl, toast]);

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

  // Clean up resources when component unmounts or streaming stops
  const cleanupStreamingResources = () => {
    console.log("Cleaning up streaming resources");
    
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
    
    // Reset state
    setIsStreaming(false);
    setInputLevel(0);
    setOutputLevel(0);
  };

  // Function to get audio level from analyzer
  const getAudioLevel = (analyzer: AnalyserNode): number => {
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(dataArray);
    
    // Calculate average level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    // Normalize to 0-1 range
    return sum / (dataArray.length * 255);
  };

  // Set up audio processor when streaming starts
  useEffect(() => {
    if (isStreaming && audioContextRef.current && localStreamRef.current && webSocketRef.current) {
      console.log("Setting up audio processor for streaming");
      const processor = createAudioProcessor(audioContextRef.current, localStreamRef.current);
      processorRef.current = processor;
      
      // Connect processor to destination to keep it running
      processor.connect(audioContextRef.current.destination);
      
      // Process audio data and send it over WebSocket
      processor.onaudioprocess = (e) => {
        if (webSocketRef.current && webSocketRef.current.connected) {
          console.log("Processing audio buffer");
          const inputData = e.inputBuffer.getChannelData(0);
          webSocketRef.current.sendAudioData(inputData);
        }
      };
    }
    
    return () => {
      if (processorRef.current && audioContextRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
    };
  }, [isStreaming]);

  // Request microphone access and start streaming
  const toggleStreaming = async () => {
    try {
      // If already streaming, stop it
      if (isStreaming) {
        console.log("Stopping streaming");
        cleanupStreamingResources();
        return;
      }
      
      console.log("Starting streaming");
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: defaultAudioConstraints,
        video: false
      });
      
      localStreamRef.current = stream;
      setMicPermission(true);
      
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          latencyHint: 'interactive', // Low latency mode
          sampleRate: 48000
        });
      }
      
      // Connect input stream to analyzer
      const { analyzer } = connectStreamToAnalyzer(stream, audioContextRef.current);
      inputAnalyzerRef.current = analyzer;
      
      // Create output analyzer if it doesn't exist
      if (!outputAnalyzerRef.current && audioContextRef.current) {
        const outputAnalyzer = audioContextRef.current.createAnalyser();
        outputAnalyzer.fftSize = 256;
        outputAnalyzer.smoothingTimeConstant = 0.5;
        outputAnalyzerRef.current = outputAnalyzer;
      }
      
      // Start streaming
      setIsStreaming(true);
      
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
      
      cleanupStreamingResources();
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupStreamingResources();
      
      // Only disconnect and close on full component unmount
      if (webSocketRef.current) {
        webSocketRef.current.disconnect();
        webSocketRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    isStreaming,
    isConnected,
    micPermission,
    inputLevel,
    outputLevel,
    toggleStreaming
  };
};
