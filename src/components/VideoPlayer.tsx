import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize2, Share2, Shield, ShieldAlert, Wifi, Tv } from "lucide-react";
import gsap from "gsap";
import { Channel, PlaybackMode } from "../types";

interface VideoPlayerProps {
  channel: Channel | null;
  playbackMode: PlaybackMode;
  onTogglePlaybackMode: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  playbackMode,
  onTogglePlaybackMode
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const activityTimeoutRef = useRef<number | null>(null);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (activityTimeoutRef.current) {
      window.clearTimeout(activityTimeoutRef.current);
    }
    // Only auto-hide if playing and channel is loaded
    if (isPlaying && channel) {
      activityTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 5000); // Hide controls after 5000ms (5 seconds)
    }
  };

  // Reset timer whenever isPlaying, channel, or playbackMode changes
  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (activityTimeoutRef.current) {
        window.clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [isPlaying, channel, playbackMode]);

  // Active stream URI with playback mode check
  const getStreamUrl = (): string => {
    if (!channel) return "";
    if (playbackMode === "proxy") {
      return `/api/stream-proxy?url=${encodeURIComponent(channel.url)}`;
    }
    return channel.url;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    let hls: Hls | null = null;
    setIsLoading(true);
    setErrorMsg(null);
    setIsPlaying(false);

    const streamUrl = getStreamUrl();

    // Reset video source
    video.src = "";

    if (Hls.isSupported()) {
      hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Auto-play was prevented by browser autoplay policy
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("fatal network error encountered, try to recover");
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("fatal media error encountered, try to recover");
              hls?.recoverMediaError();
              break;
            default:
              setIsLoading(false);
              setErrorMsg(
                playbackMode === "direct"
                  ? "Stream offline or blocked by CORS. Try enabling Geo-Bypass Proxy."
                  : "Unable to load stream. This channel may be currently offline."
              );
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari support
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      });

      video.addEventListener("error", () => {
        setIsLoading(false);
        setErrorMsg(
          playbackMode === "direct"
            ? "Stream offline or blocked. Try toggling Geo-Bypass Proxy mode."
            : "Stream is completely offline."
        );
      });
    } else {
      setIsLoading(false);
      setErrorMsg("HLS streaming is not supported in this browser.");
    }

    // GSAP clean entrance for video container
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, scale: 0.98 },
      { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }
    );

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [channel, playbackMode]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error(err));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const val = parseFloat(e.target.value);
    setVolume(val);
    video.volume = val;
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const nextMute = !isMuted;
    setIsMuted(nextMute);
    video.muted = nextMute;
  };

  const handleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error("Error enabling fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Quick action to copy channel link
  const copyStreamLink = () => {
    if (!channel) return;
    navigator.clipboard.writeText(channel.url);
    alert("Live stream link copied to clipboard!");
  };

  return (
    <div
      ref={containerRef}
      id="custom-video-player-container"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      className="relative flex flex-col w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group"
    >
      {/* Dynamic Screen Overlay for states */}
      {!channel && (
        <div id="player-welcome-overlay" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
            <Tv className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white uppercase">No Channel Selected</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-sm font-sans">
            Select an IPTV channel from the listings or search to begin streaming high-quality TV directly.
          </p>
        </div>
      )}

      {channel && errorMsg && (
        <div id="player-error-overlay" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold text-white uppercase">Playback Error</h2>
          <p className="text-xs text-slate-400 mt-2 max-w-md">{errorMsg}</p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onTogglePlaybackMode}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-lg flex items-center gap-1.5 transition-all"
            >
              <Shield className="w-4 h-4" />
              Switch to {playbackMode === "direct" ? "Geo-Bypass Proxy" : "Direct Link"}
            </button>
            <button
              onClick={() => {
                setErrorMsg(null);
                const prev = channel;
                // Force state update to re-fetch
                videoRef.current!.src = "";
                const streamUrl = getStreamUrl();
                if (Hls.isSupported() && videoRef.current) {
                  const hls = new Hls();
                  hls.loadSource(streamUrl);
                  hls.attachMedia(videoRef.current);
                }
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-all"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {channel && isLoading && (
        <div id="player-loading-overlay" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80">
          <div className="relative flex items-center justify-center">
            <div className="w-14 h-14 border-4 border-indigo-400/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-indigo-400 font-mono text-[9px] font-semibold">
              HD
            </div>
          </div>
          <p className="text-xs text-indigo-400 font-medium tracking-wide uppercase mt-4">
            Connecting Stream...
          </p>
        </div>
      )}

      {/* Target Video element */}
      <video
        ref={videoRef}
        onClick={togglePlay}
        onDoubleClick={handleFullscreen}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Embedded controls bar */}
      {channel && !errorMsg && (
        <div
          ref={controlsRef}
          id="player-live-controls"
          className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 flex flex-col gap-3 transition-opacity duration-300 z-10 ${
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Progress (Live Indicator only for IPTV) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300">LIVE broadcast</span>
            </div>

            {/* Connection Mode Indicator */}
            <button
              onClick={onTogglePlaybackMode}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                playbackMode === "proxy"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
              }`}
              title="Click to toggle proxy/geo-bypass mode"
            >
              <Wifi className="w-3 h-3" />
              <span>{playbackMode === "proxy" ? "Geo-Bypass Active" : "Direct Stream (Default)"}</span>
            </button>
          </div>

          <div id="player-inner-control-actions" className="flex items-center justify-between">
            {/* Play/Pause & Volume */}
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="text-slate-200 hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-slate-200 hover:text-indigo-400 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-24 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Title display */}
            <div className="hidden sm:block text-center max-w-[40%] truncate">
              <span className="font-display font-medium text-xs text-white">
                {channel.name}
              </span>
            </div>

            {/* Share, Expand & Fullscreen */}
            <div className="flex items-center gap-3">
              <button
                onClick={copyStreamLink}
                className="text-slate-200 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-slate-800"
                title="Copy stream link"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleFullscreen}
                className="text-slate-200 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-slate-800"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
