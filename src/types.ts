/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PodcastEpisode {
  podcastName: string;
  episodeTitle: string;
  description?: string;
  publishedAt?: string;
  rssUrl?: string;
  coverImageUrl?: string;
  coverText: string;
  coverBg: string; // Tailwind color e.g., 'bg-[#802D24]' or 'bg-zinc-900'
  coverTextColor: string; // e.g., 'text-amber-50'
  guestName?: string;
  guestBackground?: string;
  whyRecommended?: string;
  viewpoints?: string[];
  goldenQuotes?: {
    quote: string;
    source: string;
    source_note?: string;
  }[];
  triageTag: string; // e.g., '🎧值得细听', '🚶挂着听', '⏭️可跳过'
  scenario?: string; // Scenario for backup card
  href: string;
}

export interface PodcastSynthesis {
  type: 'consensus' | 'divergence';
  title: string;
  body: string;
  sources: string[];
}

export interface ConsensusDivergence {
  consensus: string[];
  divergence: string[];
}

export interface BriefingCardData {
  dateStr: string;
  chinaDateStr: string;
  title: string;
  issueNo: string;
  mainEpisode: PodcastEpisode;
  backupEpisodes: PodcastEpisode[];
  synthesis: PodcastSynthesis | ConsensusDivergence | null;
}

export interface TopicPoint {
  podcast: string;
  point: string;
  episodeId: string;
}

export interface Topic {
  title: string;
  domainTag: string;
  consensus: TopicPoint[];
  divergence: TopicPoint[];
}

export type ExploreData = Topic[];
