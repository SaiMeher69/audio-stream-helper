
import React from "react";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
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
  );
};

export default ConnectionStatus;
