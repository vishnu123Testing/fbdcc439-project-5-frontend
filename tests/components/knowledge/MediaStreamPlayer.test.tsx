import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  MediaStreamPlayer,
  MediaStreamPlayerProps,
  formatTime,
} from '../../../src/components/knowledge/MediaStreamPlayer';
import { Attachment } from '../../../src/services/knowledge';

describe('MediaStreamPlayer Component', () => {
  const mockAttachments: Attachment[] = [
    {
      id: 'att-1',
      article_id: 'art-1',
      file_name: 'Training_Guide.pdf',
      file_url: 'https://cdn.example.com/docs/Guide.pdf',
      file_size_bytes: 1048576,
      created_at: '2026-01-01',
    },
  ];

  const defaultProps: MediaStreamPlayerProps = {
    videoUrl: 'https://cdn.example.com/videos/onboarding.mp4',
    title: 'Platform Overview Training Video',
    attachments: mockAttachments,
  };

  beforeEach(() => {
    // Mock HTMLMediaElement play, pause, and load methods for JSDOM environment
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.load = vi.fn();
  });

  it('formats seconds properly into mm:ss or hh:mm:ss digital time strings', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3661)).toBe('01:01:01');
    expect(formatTime(-10)).toBe('00:00');
  });

  it('renders video player wrapper, video element, media controls bar, timeline seek bar, volume controls, and playback speed dropdown', () => {
    render(<MediaStreamPlayer {...defaultProps} />);

    expect(screen.getByTestId('media-stream-player')).toBeInDocument();
    expect(screen.getByTestId('video-element')).toBeInDocument();
    expect(screen.getByTestId('controls-bar')).toBeInDocument();
    expect(screen.getByTestId('play-pause-btn')).toBeInDocument();
    expect(screen.getByTestId('seek-bar')).toBeInDocument();
    expect(screen.getByTestId('mute-btn')).toBeInDocument();
    expect(screen.getByTestId('volume-slider')).toBeInDocument();
    expect(screen.getByTestId('speed-control')).toBeInDocument();
    expect(screen.getByTestId('captions-btn')).toBeInDocument();
    expect(screen.getByTestId('fullscreen-btn')).toBeInDocument();
  });

  it('toggles playback when play/pause button is clicked', () => {
    render(<MediaStreamPlayer {...defaultProps} />);

    const playPauseBtn = screen.getByTestId('play-pause-btn');
    fireEvent.click(playPauseBtn);

    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('changes video volume level when volume slider is adjusted', () => {
    render(<MediaStreamPlayer {...defaultProps} />);

    const volumeSlider = screen.getByTestId('volume-slider');
    fireEvent.change(volumeSlider, { target: { value: '0.8' } });

    const videoEl = screen.getByTestId('video-element') as HTMLVideoElement;
    expect(videoEl.volume).toBe(0.8);
  });

  it('changes playback speed rate when selecting a rate from speed control', () => {
    render(<MediaStreamPlayer {...defaultProps} />);

    const speedSelect = screen.getByTestId('speed-control').querySelector('select')!;
    fireEvent.change(speedSelect, { target: { value: '1.5' } });

    const videoEl = screen.getByTestId('video-element') as HTMLVideoElement;
    expect(videoEl.playbackRate).toBe(1.5);
  });

  it('renders media stream error banner with retry button and fallback attachment list on error', () => {
    render(<MediaStreamPlayer {...defaultProps} />);

    const videoEl = screen.getByTestId('video-element');
    fireEvent.error(videoEl);

    expect(screen.getByTestId('media-error-banner')).toBeInDocument();
    expect(screen.getByTestId('retry-stream-btn')).toBeInDocument();
    expect(screen.getByTestId('stream-attachments-section')).toBeInDocument();
    expect(screen.getByTestId('attachment-list')).toBeInDocument();
  });

  it('attempts stream reload when clicking retry video stream button', () => {
    render(<MediaStreamPlayer {...defaultProps} />);

    // Trigger error first
    const videoEl = screen.getByTestId('video-element');
    fireEvent.error(videoEl);

    const retryBtn = screen.getByTestId('retry-stream-btn');
    fireEvent.click(retryBtn);

    expect(window.HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });
});
