
/**
 * Audio and WebRTC utility functions for low-latency audio streaming
 */

// Configuration for WebRTC connections
export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

// Default audio constraints for high quality, low latency
export const defaultAudioConstraints: MediaTrackConstraints = {
  echoCancellation: false, // Disable echo cancellation for lower latency
  noiseSuppression: false, // Disable noise suppression for lower latency
  autoGainControl: false,  // Disable auto gain for more consistent levels
  // latency: 0.005,       // Removed - not a valid MediaTrackConstraints property
  sampleRate: 48000,       // Higher sample rate for better quality
  channelCount: 1,         // Mono for simplicity and lower bandwidth
};

// Creates an analyzer node for visualizing audio levels
export function createAnalyzer(audioContext: AudioContext): AnalyserNode {
  const analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 256;
  analyzer.smoothingTimeConstant = 0.5;
  return analyzer;
}

// Get audio level from analyzer node (0-1 range)
export function getAudioLevel(analyzer: AnalyserNode): number {
  const dataArray = new Uint8Array(analyzer.frequencyBinCount);
  analyzer.getByteFrequencyData(dataArray);
  
  // Calculate average level
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  
  // Normalize to 0-1 range
  return sum / (dataArray.length * 255);
}

// Connect stream to audio context with analyzer
export function connectStreamToAnalyzer(
  stream: MediaStream, 
  audioContext: AudioContext
): { source: MediaStreamAudioSourceNode; analyzer: AnalyserNode } {
  const source = audioContext.createMediaStreamSource(stream);
  const analyzer = createAnalyzer(audioContext);
  source.connect(analyzer);
  return { source, analyzer };
}

// Create an audio processor for WebSocket streaming
export function createAudioProcessor(
  audioContext: AudioContext,
  stream: MediaStream
): ScriptProcessorNode {
  // Create script processor node for raw audio processing
  const processor = audioContext.createScriptProcessor(1024, 1, 1);
  
  // Connect stream to processor
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(processor);
  
  return processor;
}
