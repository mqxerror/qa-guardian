// Feature #48: VideoPlayer component extracted from TestDetailPage.tsx
import { useState, useEffect } from 'react';

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
          `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/videos/${videoFile}`,
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
        `${import.meta.env.VITE_API_BASE_URL || 'https://qa.pixelcraftedmedia.com'}/api/v1/videos/${videoFile}`,
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
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Video
        </button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden bg-black">
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
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
