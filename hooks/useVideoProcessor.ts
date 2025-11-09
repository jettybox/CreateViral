import { useCallback } from 'react';

type ProcessedVideo = {
  frames: string[];
  width: number;
  height: number;
};

export const useVideoProcessor = () => {
  const extractFrames = useCallback(
    (file: File, frameCount: number): Promise<ProcessedVideo> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
            return reject(new Error('Could not get canvas context.'));
        }

        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;

        const frames: string[] = [];
        let capturedFrames = 0;

        video.onloadeddata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const { videoWidth, videoHeight } = video;
          
          const duration = video.duration;
          
          const isVideoInvalid = duration === Infinity || isNaN(duration) || duration <= 0;
          const effectiveFrameCount = isVideoInvalid ? 1 : frameCount;

          const captureFrame = (frameIndex: number) => {
            const time = isVideoInvalid ? 0 : (duration / (effectiveFrameCount + 1)) * (frameIndex + 1);
            video.currentTime = time;
          };

          video.onseeked = () => {
            if (capturedFrames >= effectiveFrameCount) {
              return; // Already captured all required frames
            }
            
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            frames.push(canvas.toDataURL('image/jpeg', 0.8));
            capturedFrames++;

            if (capturedFrames < effectiveFrameCount) {
              captureFrame(capturedFrames);
            } else {
              URL.revokeObjectURL(objectUrl);
              resolve({ frames, width: videoWidth, height: videoHeight });
            }
          };
          
          // Start the process
          captureFrame(0);
        };

        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load video file. It may be corrupt or in an unsupported format.'));
        };
      });
    },
    []
  );

  return { extractFrames };
};