// Feature #48: VideoPlayer component extracted from TestDetailPage.tsx
import { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  videoFile: string;
  token: string | null;
}

// Video Player Component - handles authenticated video loading
export function VideoPlayer({ videoFile, token }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/videos/${videoFile}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load video: ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    if (token && videoFile) {
      fetchVideo();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [videoFile, token]);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/videos/${videoFile}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = videoFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">Test Recording:</p>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Download className="h-3 w-3" />
          Download Video
        </button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden bg-black">
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="animate-spin h-6 w-6 mr-2" />
            Loading video...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-48 text-destructive text-sm">
            <span>⚠️ {error}</span>
          </div>
        )}
        {videoUrl && !isLoading && (
          <video
            controls
            preload="metadata"
            className="w-full max-h-96"
            controlsList="nodownload"
            playsInline
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Use controls: Play/Pause, Seek, Fullscreen, Playback Speed (right-click for more options)
      </p>
    </div>
  );
}
