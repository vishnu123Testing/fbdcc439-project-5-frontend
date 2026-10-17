'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  AlertTriangle,
  FileText,
  Subtitles,
  Settings,
  Film,
  RefreshCw,
} from 'lucide-react';
import { Attachment } from '../../services/knowledge';
import { AttachmentList } from './AttachmentList';

/**
 * Format time in seconds to mm:ss or hh:mm:ss digital clock format [FR-5].
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const formattedHrs = String(hrs).padStart(2, '0');
    return `${formattedHrs}:${formattedMins}:${formattedSecs}`;
  }
  return `${formattedMins}:${formattedSecs}`;
}

/**
 * Available playback speeds [FR-5].
 */
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

/**
 * Properties for the MediaStreamPlayer component [FR-5, FR-6].
 */
export interface MediaStreamPlayerProps {
  /**
   * Video media stream URL (e.g. MP4/WebM CDN link or stream URL) [FR-5].
   */
  videoUrl?: string | null;
  /**
   * Title of the training video module [FR-5].
   */
  title?: string;
  /**
   * Optional thumbnail poster image URL [FR-5].
   */
  posterUrl?: string;
  /**
   * Optional closed caption track URL (.vtt format) [FR-5].
   */
  captionUrl?: string;
  /**
   * Associated technical documentation attachments [FR-6].
   */
  attachments?: Attachment[];
  /**
   * Whether to auto-play video upon mount [FR-5].
   */
  autoPlay?: boolean;
  /**
   * Callback fired when video playback reaches the end [FR-5].
   */
  onEnded?: () => void;
  /**
   * Additional CSS class names.
   */
  className?: string;
}

/**
 * Reusable On-Demand Media Stream Player Component [FR-5, FR-6].
 *
 * Provides on-demand training video streaming with standard media controls (play, pause,
 * seek timeline, volume/mute, speed selection, closed captions, fullscreen) and client-side
 * network interruption handling with fallback technical documentation downloads.
 */
export const MediaStreamPlayer: React.FC<MediaStreamPlayerProps> = ({
  videoUrl,
  title,
  posterUrl,
  captionUrl,
  attachments = [],
  autoPlay = false,
  onEnded,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [showCaptions, setShowCaptions] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Media stream error state [plan.md §Error Handling, FR-5, FR-6]
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Toggle Play / Pause [FR-5]
  const togglePlay = useCallback(() => {
    if (!videoRef.current || hasError) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          setHasError(true);
          setErrorMessage(`Playback error: ${err.message || 'Stream interrupted'}`);
        });
    }
  }, [isPlaying, hasError]);

  // Handle Seek / Time Slider change [FR-5]
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || hasError) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle Volume change [FR-5]
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVol = parseFloat(e.target.value);
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  // Toggle Mute [FR-5]
  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (volume === 0) setVolume(0.5);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  // Change Playback Speed Rate [FR-5]
  const handleSpeedChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  // Toggle Captions / Subtitles [FR-5]
  const toggleCaptions = () => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    if (tracks && tracks.length > 0) {
      const track = tracks[0];
      const nextMode = track.mode === 'showing' ? 'hidden' : 'showing';
      track.mode = nextMode;
      setShowCaptions(nextMode === 'showing');
    } else {
      setShowCaptions((prev) => !prev);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      if (typeof playerContainerRef.current.requestFullscreen === 'function') {
        playerContainerRef.current
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {});
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      if (typeof document.exitFullscreen === 'function') {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(() => {});
      } else {
        setIsFullscreen(false);
      }
    }
  };

  // Handle stream error event [plan.md §Error Handling, FR-5]
  const handleVideoError = () => {
    setHasError(true);
    setIsPlaying(false);
    setErrorMessage('Training video media stream interrupted or resource format unsupported.');
  };

  // Retry media stream playback [FR-5]
  const handleRetryStream = () => {
    setHasError(false);
    setErrorMessage('');
    setIsRetrying(true);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsRetrying(false);
        })
        .catch(() => {
          setHasError(true);
          setErrorMessage('Retry failed. Video stream remains unavailable.');
          setIsRetrying(false);
        });
    } else {
      setIsRetrying(false);
    }
  };

  // Keyboard navigation shortcuts for media accessibility [FR-5, NFR-3]
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (videoRef.current) videoRef.current.currentTime += 5;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (videoRef.current) videoRef.current.currentTime -= 5;
    }
  };

  // Handle missing video URL
  useEffect(() => {
    if (!videoUrl) {
      setHasError(true);
      setErrorMessage('No video stream URL provided for this training module.');
    } else {
      setHasError(false);
      setErrorMessage('');
    }
  }, [videoUrl]);

  return (
    <div
      data-testid="media-stream-player"
      className={twMerge('space-y-6 text-[#1b1c19]', className)}
    >
      {/* Player Container */}
      <div
        ref={playerContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={title ? `Video Player: ${title}` : 'Training Video Stream Player'}
        data-testid="player-wrapper"
        className="relative bg-[#1b1c19] rounded-md overflow-hidden border border-[#d1c4b9] shadow-md group focus:outline-none focus:ring-2 focus:ring-[#735c41]"
      >
        {/* Module Title Overlay Header */}
        {title && (
          <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-[#1b1c19]/80 to-transparent z-10 text-xs font-semibold text-[#fbf9f4] flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <Film className="h-4 w-4 text-[#e0c1a1]" />
              {title}
            </span>
          </div>
        )}

        {/* Video Element [FR-5] */}
        {!hasError && videoUrl ? (
          <video
            ref={videoRef}
            data-testid="video-element"
            src={videoUrl}
            poster={posterUrl}
            autoPlay={autoPlay}
            playsInline
            onTimeUpdate={() => {
              if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) setDuration(videoRef.current.duration);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              if (onEnded) onEnded();
            }}
            onError={handleVideoError}
            className="w-full aspect-video object-contain bg-[#1b1c19] cursor-pointer"
            onClick={togglePlay}
          >
            {captionUrl && (
              <track
                kind="captions"
                src={captionUrl}
                srcLang="en"
                label="English Captions"
                default={showCaptions}
              />
            )}
          </video>
        ) : (
          /* Error / Stream Failure Fallback Banner [plan.md §Error Handling, FR-5, FR-6] */
          <div
            data-testid="media-error-banner"
            className="w-full aspect-video bg-[#30312e] text-[#fbf9f4] p-6 flex flex-col items-center justify-center text-center space-y-4"
          >
            <AlertTriangle className="h-10 w-10 text-[#fd7d69] animate-pulse" />
            <div className="space-y-1 max-w-md">
              <h4 className="font-serif text-base font-semibold text-[#f2f1ec]">
                Media Stream Interrupted
              </h4>
              <p className="text-xs text-[#d1c4b9]">
                {errorMessage ||
                  'The training video stream encountered a network error or format restriction.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                data-testid="retry-stream-btn"
                onClick={handleRetryStream}
                disabled={isRetrying || !videoUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#735c41] hover:bg-[#59452b] text-[#ffffff] rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
                <span>{isRetrying ? 'Retrying...' : 'Retry Video Stream'}</span>
              </button>
            </div>

            <p className="text-[11px] text-[#c2b9a7] italic pt-2">
              Note: You can access complete technical documentation and user guide attachments below.
            </p>
          </div>
        )}

        {/* Video Custom Media Controls Bar [FR-5] */}
        {!hasError && (
          <div
            data-testid="controls-bar"
            className="p-3 bg-gradient-to-t from-[#1b1c19] via-[#1b1c19]/90 to-transparent space-y-2 text-[#fbf9f4] z-10"
          >
            {/* Timeline Slider / Progress Seek Bar */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#d1c4b9] min-w-[40px] text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                data-testid="seek-bar"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeekChange}
                aria-label="Seek video position"
                className="flex-1 h-1.5 bg-[#4e453d] rounded-lg appearance-none cursor-pointer accent-[#735c41]"
              />
              <span className="text-[11px] font-mono text-[#d1c4b9] min-w-[40px]">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-3">
                {/* Play / Pause Toggle */}
                <button
                  type="button"
                  data-testid="play-pause-btn"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  className="p-1.5 text-[#fbf9f4] hover:text-[#e0c1a1] transition-colors"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>

                {/* Volume & Mute Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="mute-btn"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                    className="p-1.5 text-[#fbf9f4] hover:text-[#e0c1a1] transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    data-testid="volume-slider"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume level"
                    className="w-16 h-1 bg-[#4e453d] rounded appearance-none cursor-pointer accent-[#735c41] hidden sm:block"
                  />
                </div>
              </div>

              {/* Right Controls: Speed, Captions, Fullscreen */}
              <div className="flex items-center gap-3">
                {/* Playback Speed Control Selector [FR-5] */}
                <div className="relative flex items-center gap-1" data-testid="speed-control">
                  <span className="text-[11px] text-[#d1c4b9] hidden sm:inline">Speed:</span>
                  <select
                    value={playbackRate}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    aria-label="Playback speed"
                    className="bg-[#30312e] text-[#fbf9f4] text-xs px-2 py-1 rounded border border-[#80756b] focus:outline-none focus:ring-1 focus:ring-[#735c41]"
                  >
                    {PLAYBACK_SPEEDS.map((spd) => (
                      <option key={spd} value={spd}>
                        {spd}x
                      </option>
                    ))}
                  </select>
                </div>

                {/* Captions Toggle [FR-5] */}
                <button
                  type="button"
                  data-testid="captions-btn"
                  onClick={toggleCaptions}
                  aria-label="Toggle closed captions"
                  aria-pressed={showCaptions}
                  className={clsx(
                    'p-1.5 rounded transition-colors',
                    showCaptions
                      ? 'text-[#e0c1a1] bg-[#4e453d]'
                      : 'text-[#fbf9f4] hover:text-[#e0c1a1]'
                  )}
                >
                  <Subtitles className="h-4 w-4" />
                </button>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  data-testid="fullscreen-btn"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="p-1.5 text-[#fbf9f4] hover:text-[#e0c1a1] transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Technical Documentation Link Section [FR-6] */}
      {attachments.length > 0 && (
        <div className="space-y-2" data-testid="stream-attachments-section">
          <AttachmentList
            attachments={attachments}
            title="Linked Technical Documentation & Onboarding Resources"
          />
        </div>
      )}
    </div>
  );
};

export default MediaStreamPlayer;
