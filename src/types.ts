/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PodcastEpisode {
  episodeId?: string;
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
  whyRecommend?: string;
  viewpoints?: string[];
  goldenQuotes?: {
    quote: string;
    source: string;
    source_note?: string;
  }[];
  goldenQuote?: string;
  triageTag: string; // e.g., '🎧值得细听', '🚶挂着听', '⏭️可跳过'
  topicTag?: string;
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

export interface BriefingHistoryEntry {
  episodeId: string;
  podcastName: string;
  episodeTitle: string;
  generatedAt: string;
  fingerprint?: string;
  triageTag?: string;
  whyRecommended?: string;
  goldenQuote?: string;
  coverImageUrl?: string;
  topicTag?: string;
  publishedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export type ExploreData = Topic[];

export type FavoriteItemType = 'briefing' | 'topic_episode';

export interface FavoriteRecord {
  id: string;
  type: FavoriteItemType;
  title: string;
  podcastName: string;
  coverUrl: string;
  topicTag: string;
  addedAt: number;
}

export interface RankingEpisode {
  podcastName: string;
  episodeTitle: string;
  uniqueId: string;
  publishedAt: string;
  domain: string;
}
