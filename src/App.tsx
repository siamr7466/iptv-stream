import React, { useEffect, useState, useRef } from "react";
import { VideoPlayer } from "./components/VideoPlayer";
import { Channel, CountryGroup, TabType, PlaybackMode } from "./types";
import { 
  Search, 
  Heart, 
  RefreshCw, 
  Star, 
  Info, 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Globe, 
  ShieldCheck, 
  Tv, 
  Activity, 
  SearchX,
  AlertTriangle,
  FlameKindling
} from "lucide-react";
import gsap from "gsap";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("bangladesh");
  const [newsData, setNewsData] = useState<CountryGroup[]>([]);
  const [sportsData, setSportsData] = useState<Channel[]>([]);
  const [bdData, setBdData] = useState<Channel[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("direct");
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({ "BD": true });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStreamErrCount, setActiveStreamErrCount] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Load favorites from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("iptv_favorites");
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error reading favorites:", e);
    }
  }, []);

  // Fetch lists in parallel
  const fetchIPTVData = async (isManualRef = false) => {
    if (isManualRef) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [bdRes, newsRes, sportsRes] = await Promise.all([
        fetch("/api/iptv/bangladesh"),
        fetch("/api/iptv/news"),
        fetch("/api/iptv/sports")
      ]);

      if (bdRes.ok && newsRes.ok && sportsRes.ok) {
        const bdJson = await bdRes.json();
        const newsJson = await newsRes.json();
        const sportsJson = await sportsRes.json();

        setBdData(bdJson.data || []);
        setNewsData(newsJson.data || []);
        setSportsData(sportsJson.data || []);

        // Set default channel on first load (e.g., first channel of Bangladesh)
        if (!selectedChannel && bdJson.data && bdJson.data.length > 0) {
          setSelectedChannel(bdJson.data[0]);
        }
      }
    } catch (error) {
      console.error("Error loading IPTV lists:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIPTVData();
  }, []);

  // GSAP animation for grid element transitions when changing tabs
  useEffect(() => {
    if (gridRef.current) {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 12, scale: 0.98 },
        { 
          opacity: 1, 
          y: 0, 
          scale: 1, 
          duration: 0.4, 
          stagger: 0.04, 
          ease: "power2.out" 
        }
      );
    }
  }, [activeTab, searchQuery]);

  // Handle accordion toggle
  const toggleCountry = (countryCode: string) => {
    setExpandedCountries(prev => ({
      ...prev,
      [countryCode]: !prev[countryCode]
    }));
  };

  // Toggle favorite channel helper
  const toggleFavorite = (channel: Channel, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated;
    const isFav = favorites.some(f => f.url === channel.url);
    if (isFav) {
      updated = favorites.filter(f => f.url !== channel.url);
    } else {
      updated = [...favorites, channel];
    }
    setFavorites(updated);
    localStorage.setItem("iptv_favorites", JSON.stringify(updated));
  };

  const isFavorite = (channel: Channel) => {
    return favorites.some(f => f.url === channel.url);
  };

  // Trigger manual API parsing refresh
  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/iptv/refresh", { method: "POST" });
      await fetchIPTVData(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTogglePlaybackMode = () => {
    setPlaybackMode(prev => (prev === "direct" ? "proxy" : "direct"));
  };

  // Calculate filtered channels based on search
  const getFilteredBangladesh = () => {
    if (!searchQuery) return bdData;
    return bdData.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const getFilteredSports = () => {
    if (!searchQuery) return sportsData;
    return sportsData.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const getFilteredFavorites = () => {
    if (!searchQuery) return favorites;
    return favorites.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-slate-950 flex flex-col selection:bg-indigo-500 selection:text-slate-900 overflow-x-hidden"
    >
      {/* Top Status and Branding Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md sticky top-0 z-45 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/10 shrink-0">
              <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-sm sm:text-lg text-white leading-tight flex items-center gap-1.5">
                Glance IPTV <span className="text-indigo-400 text-glow text-[10px] sm:text-xs uppercase px-1.5 py-0.5 bg-indigo-500/10 rounded">LIVE</span>
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 tracking-wider">
                BYPASS BLOCKS • SMOOTH PLAYBACK
              </span>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-800/80 border border-slate-700/60 rounded text-[10px] sm:text-xs font-semibold text-slate-300">
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
              <span>Channels: {bdData.length + sportsData.length} online</span>
            </div>

            <button
              onClick={handleForceRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[10px] sm:text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''} shrink-0`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 flex flex-col lg:flex-row gap-5 lg:gap-6">
        
        {/* LEFT COLUMN: Sticky Video Player & Diagnostics Block (60%) */}
        <div id="column-left" className="flex flex-col gap-4 sm:gap-5 lg:w-[62%] lg:max-w-[62%] lg:sticky lg:top-[76px] lg:h-fit">
          <div className="relative bg-slate-950 pt-0 pb-2 sm:py-0 shadow-lg shadow-black/80 lg:shadow-none">
            <VideoPlayer 
              channel={selectedChannel}
              playbackMode={playbackMode}
              onTogglePlaybackMode={handleTogglePlaybackMode}
            />
          </div>

          {/* Channel metadata & toggle configuration card */}
          {selectedChannel && (
            <div id="active-channel-details-card" className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex items-start gap-4">
                {selectedChannel.logo ? (
                  <img 
                    src={selectedChannel.logo} 
                    alt={selectedChannel.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-contain bg-white/5 border border-slate-700/50 p-1"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center font-display font-bold text-lg text-slate-400">
                    {selectedChannel.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-white leading-tight">
                      {selectedChannel.name}
                    </h3>
                    <button
                      onClick={(e) => toggleFavorite(selectedChannel, e)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-all"
                      title={isFavorite(selectedChannel) ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Star className={`w-5 h-5 ${isFavorite(selectedChannel) ? "text-rose-500 fill-current" : ""}`} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      {selectedChannel.countryName || selectedChannel.countryCode}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{selectedChannel.group || "General"} Category</span>
                  </p>
                </div>
              </div>

              {/* Geo-Bypass & block details action widget */}
              <div id="playback-settings-controls" className="flex flex-col gap-1 text-right">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider">
                  Network Diagnostics
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-300 font-medium font-mono">Geo-Bypass Mode:</span>
                  <div className="relative inline-flex items-center">
                    <button
                      onClick={handleTogglePlaybackMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        playbackMode === "proxy" ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          playbackMode === "proxy" ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Guide Card */}
          <div id="iptv-guide-box" className="p-5 bg-gradient-to-tr from-slate-900/65 to-slate-950 rounded-lg border border-slate-800/80 flex gap-4">
            <div className="p-3 bg-indigo-500/10 rounded text-indigo-400 h-fit">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white uppercase tracking-tight">Geo-Bypass Protocol and CORS Safety</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Browsers often prevent media playbacks inside sandboxed iframes due to CORS security rules. 
                Our <strong>Geo-Bypass Proxy</strong> solves this! It reroutes streams through our Node.JS backend, 
                rewrites nested playlists, masks Referers, and bypasses local geolocation locks automatically. 
                If any channel shows a load error, simply toggle the <strong>Geo-Bypass Active</strong> switch inside controls!
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Grid Browser (38%) */}
        <div className="flex-1 lg:max-w-[38%] flex flex-col gap-5">
          
          {/* Channel Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search live streams, news channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 hover:bg-slate-900/100 text-white pl-10 pr-4 py-2.5 rounded border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
            />
          </div>

          {/* Category Tabs */}
          <div className="grid grid-cols-4 bg-slate-900/80 border border-slate-800 p-1 rounded">
            {(
              [
                { id: "bangladesh", label: "Bangladesh", icon: "🇧🇩" },
                { id: "news", label: "News", icon: "📰" },
                { id: "sports", label: "Sports", icon: "⚽" },
                { id: "favorites", label: "Favs", icon: "⭐" }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 text-[11px] sm:text-xs font-semibold rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Directory Listings with scrollbars on desktop only */}
          <div 
            id="channels-browser-scroll-area"
            className="flex-1 lg:max-h-[660px] lg:overflow-y-auto pr-1 flex flex-col gap-3"
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <span>Synchronizing IPTV M3U databases...</span>
              </div>
            ) : (
              <div ref={gridRef} className="flex flex-col gap-3">
                {/* TAB 1: BANGLADESH LIVE TV */}
                {activeTab === "bangladesh" && (
                  <>
                    {getFilteredBangladesh().length === 0 ? (
                      <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl">
                        <SearchX className="w-8 h-8 text-slate-500 mx-auto" />
                        <h4 className="text-slate-300 font-bold text-sm mt-3">No BD streams found</h4>
                        <p className="text-xs text-slate-500 mt-1">Try relaxing your search filter query.</p>
                      </div>
                    ) : (
                      getFilteredBangladesh().map((channel) => (
                        <ChannelCard 
                          key={channel.url}
                          channel={channel}
                          isSelected={selectedChannel?.url === channel.url}
                          isFav={isFavorite(channel)}
                          onSelect={() => setSelectedChannel(channel)}
                          onToggleFav={(e) => toggleFavorite(channel, e)}
                        />
                      ))
                    )}
                  </>
                )}

                {/* TAB 2: GLOBAL NEWS ACCORDIONS (Bangladesh top pinned & pre-expanded by default) */}
                {activeTab === "news" && (
                  <>
                    {newsData.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                        <h4 className="text-slate-300 font-bold text-sm mt-3">M3U List Unavailable</h4>
                        <p className="text-xs text-slate-500 mt-1">Check internet connectivity or click Refresh.</p>
                      </div>
                    ) : (
                      newsData.map((group) => {
                        // Apply filters to channels in the group
                        const filteredCountryChannels = searchQuery
                          ? group.channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          : group.channels;

                        if (filteredCountryChannels.length === 0) return null;

                        const isExpanded = !!expandedCountries[group.countryCode];

                        return (
                          <div 
                            key={group.countryCode} 
                            id={`news-group-${group.countryCode}`}
                            className="bg-slate-900/30 rounded overflow-hidden border border-slate-800/80 transition-colors"
                          >
                            <button
                              onClick={() => toggleCountry(group.countryCode)}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/20 text-left transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs">
                                  {group.countryCode === "BD" ? "🇧🇩" : "🌐"}
                                </span>
                                <span className={`font-display font-bold text-sm ${group.countryCode === "BD" ? 'text-indigo-450 font-extrabold' : 'text-slate-200'}`}>
                                  {group.countryName} {group.countryCode === "BD" ? "• Pinned" : ""}
                                </span>
                                <span className="text-[10px] font-semibold bg-slate-800/90 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                  {filteredCountryChannels.length} news
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="border-t border-slate-800/60 p-2 flex flex-col gap-1.5 bg-slate-950/40">
                                {filteredCountryChannels.map((channel) => (
                                  <ChannelCard 
                                    key={channel.url}
                                    channel={channel}
                                    isSelected={selectedChannel?.url === channel.url}
                                    isFav={isFavorite(channel)}
                                    onSelect={() => setSelectedChannel(channel)}
                                    onToggleFav={(e) => toggleFavorite(channel, e)}
                                    size="small"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {/* TAB 3: LIVE SPORTS LIST */}
                {activeTab === "sports" && (
                  <>
                    {getFilteredSports().length === 0 ? (
                      <div className="text-center py-12 bg-slate-900/20 rounded-xl border border-slate-800 border-dashed">
                        <FlameKindling className="w-8 h-8 text-slate-500 mx-auto" />
                        <h4 className="text-slate-300 font-bold text-sm mt-3">No Sports Channels Listed</h4>
                        <p className="text-xs text-slate-500 mt-1">Refine active searching keys.</p>
                      </div>
                    ) : (
                      getFilteredSports().map((channel) => (
                        <ChannelCard 
                          key={channel.url}
                          channel={channel}
                          isSelected={selectedChannel?.url === channel.url}
                          isFav={isFavorite(channel)}
                          onSelect={() => setSelectedChannel(channel)}
                          onToggleFav={(e) => toggleFavorite(channel, e)}
                        />
                      ))
                    )}
                  </>
                )}

                {/* TAB 4: MY FAVORITES CHANNELS LIST */}
                {activeTab === "favorites" && (
                  <>
                    {getFilteredFavorites().length === 0 ? (
                      <div className="text-center py-16 flex flex-col items-center justify-center">
                        <Star className="w-10 h-10 text-rose-500/25 mb-3" />
                        <h4 className="text-slate-300 font-bold text-sm">No Pinned Stream Favorites</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed text-center">
                          Bookmark live channels and radio with the star icon inside channels lists to access them instantly here.
                        </p>
                      </div>
                    ) : (
                      getFilteredFavorites().map((channel) => (
                        <ChannelCard 
                          key={channel.url}
                          channel={channel}
                          isSelected={selectedChannel?.url === channel.url}
                          isFav={isFavorite(channel)}
                          onSelect={() => setSelectedChannel(channel)}
                          onToggleFav={(e) => toggleFavorite(channel, e)}
                        />
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

// Compact Channel Row Card
interface CardProps {
  channel: Channel;
  isSelected: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
  size?: "default" | "small";
}

const ChannelCard: React.FC<CardProps> = ({ channel, isSelected, isFav, onSelect, onToggleFav, size = "default" }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseEnter = () => {
    gsap.to(cardRef.current, { scale: 1.015, duration: 0.2, ease: "power2.out" });
  };

  const handleMouseLeave = () => {
    gsap.to(cardRef.current, { scale: 1, duration: 0.2, ease: "power2.out" });
  };

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`w-full text-left rounded flex items-center justify-between transition-all outline-none cursor-pointer border ${
        size === "small" ? "p-2.5 text-xs" : "p-3.5"
      } ${
        isSelected
          ? "bg-slate-800 text-white border-indigo-500/60 shadow-md shadow-indigo-500/5 font-semibold"
          : "bg-slate-900 hover:bg-slate-800 border-slate-800/80 hover:border-slate-700/60 text-slate-300"
      }`}
    >
      <div className="flex items-center gap-3.5 max-w-[80%]">
        {/* Channel Emblem Icon / Logo */}
        {channel.logo ? (
          <img 
            src={channel.logo} 
            alt={channel.name}
            referrerPolicy="no-referrer"
            className={`rounded object-contain bg-slate-950 p-0.5 shadow ${
              size === "small" ? "w-7 h-7" : "w-10 h-10"
            }`}
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <div className={`rounded bg-slate-900 border border-slate-800 flex items-center justify-center font-display font-medium text-slate-400 shrink-0 ${
            size === "small" ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm"
          }`}>
            {channel.name.charAt(0)}
          </div>
        )}

        <div className="truncate">
          <p className="font-display font-medium leading-tight truncate text-white text-sm">
            {channel.name}
          </p>
          {size !== "small" && (
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono tracking-wider">
              {channel.countryName || channel.countryCode}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Play Action Badge */}
        {isSelected ? (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
          </span>
        ) : (
          <Play className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}

        {/* Favorite Star Button */}
        <button
          onClick={onToggleFav}
          className={`p-1 rounded hover:bg-slate-800/80 transition-colors ${
            isFav ? "text-rose-500" : "text-slate-500 hover:text-rose-500"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
        </button>
      </div>
    </div>
  );
}
