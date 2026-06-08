export interface Channel {
  name: string;
  url: string;
  logo: string;
  tvgId: string;
  countryCode: string;
  countryName: string;
  group: string;
}

export interface CountryGroup {
  countryCode: string;
  countryName: string;
  channels: Channel[];
}

export type TabType = "bangladesh" | "news" | "sports" | "favorites";

export type PlaybackMode = "direct" | "proxy";
