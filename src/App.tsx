/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Compass,
  ExternalLink,
  Heart,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import exploreDataRaw from './explore.json';
import favoritesDataRaw from './favorites.json';
import { initialData } from './generatedData';
import { ExploreData, PodcastEpisode, PodcastSynthesis, TopicPoint } from './types';

type AppTab = 'curated' | 'favorites' | 'my';

const exploreData = exploreDataRaw as ExploreData;
const favoritesSeed = favoritesDataRaw as PodcastEpisode[];
const FAVORITES_STORAGE_KEY = 'pickast_favorites';

function getEpisodeKey(episode: PodcastEpisode) {
  return `${episode.podcastName}::${episode.episodeTitle}`;
}

function toSynthesis(value: unknown): PodcastSynthesis | null {
  if (!value || typeof value !== 'object' || !('body' in value)) {
    return null;
  }
  return value as PodcastSynthesis;
}

function getEpisodeIdFromHref(href: string) {
  const match = href.match(/episode\/([^?]+)/);
  return match?.[1] ?? null;
}

function buildEpisodeHref(episodeId: string) {
  return `cosmos://page.cos/episode/${episodeId}?utm_source=rss`;
}

function getTopicPodcastCount(topic: ExploreData[number]) {
  return new Set([...topic.consensus, ...topic.divergence].map((item) => item.podcast)).size;
}

function getShortWeekday(chinaDateStr: string) {
  const chineseWeekday = chinaDateStr.split('/')[0]?.trim() ?? '';
  return chineseWeekday.replace('星期', '周');
}

function getCalendarDayDiff(fromDate: string, toDate: Date) {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function getEpisodeId(episode: PodcastEpisode) {
  return getEpisodeIdFromHref(episode.href);
}

function getSeedFavoriteEpisodeIds(seed: PodcastEpisode[]) {
  return seed.map(getEpisodeId).filter((id): id is string => Boolean(id));
}

function parseFavoriteEpisodeIds(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string' && Boolean(value));
  } catch {
    return [];
  }
}

type EpisodeDeckProps = {
  episodes: PodcastEpisode[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  favorites: PodcastEpisode[];
  onToggleFavorite: (episode: PodcastEpisode, event?: React.MouseEvent) => void;
};

function EpisodeDeck({
  episodes,
  activeIndex,
  onActiveIndexChange,
  favorites,
  onToggleFavorite,
}: EpisodeDeckProps) {
  const episodeCount = episodes.length;

  const isFavorited = (episode: PodcastEpisode) =>
    favorites.some((item) => getEpisodeKey(item) === getEpisodeKey(episode));

  const handleNext = () => {
    onActiveIndexChange((activeIndex + 1) % episodeCount);
  };

  const handlePrev = () => {
    onActiveIndexChange((activeIndex - 1 + episodeCount) % episodeCount);
  };

  if (episodeCount === 0) {
    return null;
  }

  const getOffsetX = (diff: number) => {
    if (diff === 0) return '0%';
    if (diff === 1) return '100%';
    if (diff === -1) return '-100%';
    return '200%';
  };

  return (
    <>
      <div className="relative flex w-full items-center justify-center overflow-visible py-1">
        <div
          className="relative w-full max-w-[344px] overflow-visible"
          style={{ aspectRatio: '29 / 50' }}
        >
          {episodes.map((episode, index) => {
            let diff = 0;
            const nextIndex = (activeIndex + 1) % episodeCount;
            const prevIndex = (activeIndex - 1 + episodeCount) % episodeCount;

            if (index === activeIndex) diff = 0;
            else if (episodeCount > 1 && index === nextIndex) diff = 1;
            else if (episodeCount > 2 && index === prevIndex) diff = -1;
            else diff = 2;

            return (
              <motion.div
                key={getEpisodeKey(episode)}
                animate={{
                  x: getOffsetX(diff),
                  scale: 1,
                  opacity: diff === 0 ? 1 : diff === 2 ? 0 : 0.35,
                  filter: diff === 0 ? 'blur(0px)' : 'blur(1.5px)',
                  zIndex: diff === 0 ? 30 : diff === 2 ? 0 : 10,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 280,
                  damping: 24,
                  mass: 0.85,
                }}
                drag={diff === 0 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.65}
                onDragEnd={(_, info) => {
                  const swipeThreshold = 50;
                  if (info.offset.x < -swipeThreshold) {
                    handleNext();
                  } else if (info.offset.x > swipeThreshold) {
                    handlePrev();
                  }
                }}
                onClick={() => {
                  if (diff === -1) handlePrev();
                  if (diff === 1) handleNext();
                }}
                className="relative overflow-hidden rounded-[20px] border border-black/10 bg-white px-5 pt-5 pb-6 flex flex-col paper-texture cursor-grab active:cursor-grabbing select-none"
                style={{
                  position: 'absolute',
                  left: '24px',
                  right: '24px',
                  top: 0,
                  bottom: 0,
                  filter: diff === 0
                    ? 'drop-shadow(0 12px 40px rgba(0, 0, 0, 0.06))'
                    : 'drop-shadow(0 12px 40px rgba(0, 0, 0, 0.04))',
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[5.5px] z-20"
                  style={{ backgroundColor: '#D14A28' }}
                />

                <div className="relative z-10 flex justify-between items-start gap-2 pb-3 border-b border-black/5 mt-1">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0 pr-1">
                    <span className="font-serif font-black text-[12px] leading-tight border border-zinc-300 px-2.5 py-1 rounded text-zinc-900 bg-[#FAF9F5] select-none break-words max-w-[185px]">
                      {episode.podcastName}
                    </span>

                    <span
                      className="text-[8px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{
                        color: 'rgba(82, 82, 91, 0.9)',
                        backgroundColor: 'rgba(244, 244, 245, 0.9)',
                        border: '1px solid rgba(161, 161, 170, 0.35)',
                      }}
                    >
                      {episode.triageTag}
                    </span>
                  </div>

                  <button
                    onClick={(event) => onToggleFavorite(episode, event)}
                    className="p-1 px-1.5 rounded-full hover:bg-neutral-50 active:scale-110 transition-transform focus:outline-none"
                    title="收藏单集"
                    aria-label={`收藏 ${episode.episodeTitle}`}
                  >
                    <Heart
                      className="w-5.5 h-5.5 transition-transform"
                      color={isFavorited(episode) ? '#D14A28' : '#1A1A1A'}
                      fill={isFavorited(episode) ? '#D14A28' : 'none'}
                      strokeWidth={1.8}
                    />
                  </button>
                </div>

                <div className="card-body-layout relative z-10 flex min-h-0 flex-1 flex-col pt-3.5">
                  <div className="card-copy-block pr-0.5 text-justify">
                    <h2 className="card-title-text font-serif font-black text-[14px] text-[#1A1A1A] hover:text-[#D14A28] transition-colors">
                      {episode.episodeTitle}
                    </h2>

                    {episode.guestBackground ? (
                      <div className="text-[10px] text-zinc-600 font-sans tracking-wide leading-relaxed uppercase">
                        <span className="font-serif font-black text-[#1A1A1A]">嘉宾｜</span>
                        {episode.guestBackground}
                      </div>
                    ) : null}

                    {episode.whyRecommended ? (
                      <p className="card-reason-text text-[12px] text-zinc-600">
                        <span className="font-serif font-bold text-[#1A1A1A]">【推荐语】</span>
                        {episode.whyRecommended}
                      </p>
                    ) : null}
                  </div>

                  <div className="card-cover-frame relative z-10 -mx-5 overflow-hidden bg-white">
                    {episode.coverImageUrl ? (
                      <img
                        src={episode.coverImageUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                        className="w-full h-full object-cover scale-110 opacity-[0.65] blur-[1.4px] saturate-[0.9]"
                      />
                    ) : null}
                    <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  </div>

                  {episode.goldenQuotes && episode.goldenQuotes.length > 0 ? (
                    <div className="card-quote-block">
                      <div className="space-y-2">
                        <p className="card-quote-text font-serif text-[18px] text-zinc-800 font-medium">
                          {episode.goldenQuotes[0].quote}
                        </p>
                        <p className="card-quote-source text-[12px] text-[#888888] font-medium text-right">
                          —— {episode.goldenQuotes[0].source}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="card-footer-bar relative z-10 mt-auto border-t border-black/5 pt-3 pb-1 flex justify-between items-center text-[10px] font-medium text-zinc-500">
                  <a
                    href={episode.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 hover:underline font-bold text-zinc-700"
                  >
                    <span>去小宇宙听</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>

                  <span className="font-mono text-[8px] text-zinc-400">
                    第 {index + 1} 集 / 共 {episodeCount} 集
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center items-center gap-2 my-1">
        {episodes.map((episode, index) => (
          <button
            key={getEpisodeKey(episode)}
            onClick={() => onActiveIndexChange(index)}
            style={{
              backgroundColor: activeIndex === index ? '#D14A28' : 'rgba(26, 26, 26, 0.15)',
              width: activeIndex === index ? '20px' : '7px',
            }}
            className="h-1.5 rounded-full transition-all duration-300 active:scale-125 focus:outline-none cursor-pointer"
            title={`精选卡 ${index + 1}`}
            aria-label={`切换到第 ${index + 1} 张卡片`}
          />
        ))}
      </div>
    </>
  );
}

function SynthesisCard({ synthesis }: { synthesis: PodcastSynthesis | null }) {
  if (!synthesis) {
    return null;
  }

  return (
    <div className="w-full px-1 pt-0.5 pb-1 flex justify-center">
      <div className="bg-white border border-black/10 rounded-2xl p-2.5 w-[290px] select-text">
        <div className="flex justify-between items-center mb-1 pb-1 border-b border-black/5">
          <span className="font-serif font-black text-[10px] text-zinc-800">{synthesis.title}</span>
          <span className="text-[8px] text-zinc-400 font-mono">OBSERVATION</span>
        </div>
        <div className="space-y-1 text-[9px] leading-relaxed">
          <p className="text-zinc-500 leading-normal">{synthesis.body}</p>
          {synthesis.sources.length ? (
            <p className="text-[8px] text-zinc-400 leading-normal">{synthesis.sources.join(' / ')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TopicSection({
  title,
  points,
  resolveEpisodeHref,
}: {
  title: string;
  points: TopicPoint[];
  resolveEpisodeHref: (episodeId: string) => string;
}) {
  if (!points.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-serif font-black text-[15px] text-[#1A1A1A]">{title}</h2>
                <div className="space-y-2.5">
        {points.map((point, index) => (
          <div key={`${point.episodeId}-${index}`} className="rounded-xl bg-[#F1EEE8] px-3 py-3">
            <p className="text-[14px] font-semibold text-[#666666]">{point.podcast}</p>
            <p className="mt-1 text-[15px] leading-[1.6] text-[#1A1A1A]">{point.point}</p>
            <div className="mt-2 flex justify-end">
              <a
                href={resolveEpisodeHref(point.episodeId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[9px] font-bold text-[#666666] hover:text-[#D14A28]"
              >
                <span>去小宇宙听</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('curated');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showExplore, setShowExplore] = useState(false);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number | null>(null);
  const [daysSinceFirstVisit, setDaysSinceFirstVisit] = useState(0);
  const [favoriteEpisodeIds, setFavoriteEpisodeIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return getSeedFavoriteEpisodeIds(favoritesSeed);
    }

    const storedIds = parseFavoriteEpisodeIds(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
    if (storedIds.length > 0) {
      return storedIds;
    }

    const seedIds = getSeedFavoriteEpisodeIds(favoritesSeed);
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(seedIds));
    return seedIds;
  });

  const curatedEpisodes = useMemo(
    () => [initialData.mainEpisode, ...initialData.backupEpisodes],
    []
  );
  const curatedSynthesis = toSynthesis(initialData.synthesis);
  const exploreTopics = useMemo(() => (Array.isArray(exploreData) ? exploreData : []), []);
  const selectedTopic = selectedTopicIndex !== null ? exploreTopics[selectedTopicIndex] ?? null : null;
  const episodeLookup = useMemo(() => {
    const map = new Map<string, PodcastEpisode>();
    [...curatedEpisodes, ...favoritesSeed].forEach((episode) => {
      const episodeId = getEpisodeId(episode);
      if (episodeId && !map.has(episodeId)) {
        map.set(episodeId, episode);
      }
    });
    return map;
  }, [curatedEpisodes]);
  const favoriteEpisodes = useMemo(
    () =>
      favoriteEpisodeIds
        .map((episodeId) => episodeLookup.get(episodeId))
        .filter((episode): episode is PodcastEpisode => Boolean(episode)),
    [favoriteEpisodeIds, episodeLookup]
  );
  const curatedEpisodeHrefMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const episode of curatedEpisodes) {
      const episodeId = getEpisodeIdFromHref(episode.href);
      if (episodeId) {
        map.set(episodeId, episode.href);
      }
    }
    return map;
  }, [curatedEpisodes]);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteEpisodeIds));
  }, [favoriteEpisodeIds]);

  const isFavorited = (episode: PodcastEpisode) => {
    const episodeId = getEpisodeId(episode);
    return episodeId ? favoriteEpisodeIds.includes(episodeId) : false;
  };

  const toggleFavorite = (episode: PodcastEpisode, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const episodeId = getEpisodeId(episode);
    if (!episodeId) {
      return;
    }

    setFavoriteEpisodeIds((prev) =>
      prev.includes(episodeId) ? prev.filter((item) => item !== episodeId) : [...prev, episodeId]
    );
  };

  const switchTab = (tab: AppTab) => {
    setActiveTab(tab);
    setShowExplore(false);
    setSelectedTopicIndex(null);
  };

  const openExplore = () => {
    setShowExplore(true);
    setSelectedTopicIndex(null);
  };

  const closeExplore = () => {
    setShowExplore(false);
    setSelectedTopicIndex(null);
  };

  const resolveTopicEpisodeHref = (episodeId: string) =>
    curatedEpisodeHrefMap.get(episodeId) ?? buildEpisodeHref(episodeId);
  const importedFavoritesCount = favoriteEpisodes.length;
  const shortWeekday = getShortWeekday(initialData.chinaDateStr);

  useEffect(() => {
    const storageKey = 'pickast-first-visit-date';
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    const stored = window.localStorage.getItem(storageKey) ?? todayStr;

    if (!window.localStorage.getItem(storageKey)) {
      window.localStorage.setItem(storageKey, todayStr);
    }

    setDaysSinceFirstVisit(getCalendarDayDiff(stored, today));
  }, []);

  return (
    <div
      id="briefing-app"
      className="h-[100dvh] min-h-screen w-full bg-[#EFECE6] font-sans antialiased text-[#1A1A1A] overflow-x-hidden"
    >
      <div
        className="relative mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-[#F7F4EC] select-none"
        style={{ contentVisibility: 'auto' }}
      >
        <style>{`
          * {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
            outline: none !important;
          }
          .select-text, .select-text * {
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          *:focus {
            outline: none !important;
            box-shadow: none !important;
          }
          a, button {
            -webkit-tap-highlight-color: transparent !important;
            outline: none !important;
          }
        `}</style>

        <div
          className="relative flex h-full flex-grow flex-col overflow-hidden"
          style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
        >
          {activeTab === 'curated' ? (
            <div className="flex h-full flex-1 flex-col justify-between overflow-hidden px-4 pb-2 pt-4 md:px-5">
              <div className="flex justify-between items-center border-b border-black/10 pb-2 select-none">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif font-black text-xl tracking-tight text-[#1A1A1A]">听荐</span>
                  <span
                    translate="no"
                    className="notranslate font-mono text-[9px] text-[#888888] font-bold tracking-wider uppercase"
                  >
                    Pickast
                  </span>
                </div>

                <div className="text-[9.5px] font-serif font-bold text-[#666666]/90 text-right leading-tight">
                  {initialData.dateStr} {shortWeekday}
                </div>
              </div>

              <EpisodeDeck
                episodes={curatedEpisodes}
                activeIndex={activeIndex}
                onActiveIndexChange={setActiveIndex}
                favorites={favoriteEpisodes}
                onToggleFavorite={toggleFavorite}
              />

              <div className="mt-2 flex w-full shrink-0">
                {exploreTopics.length > 0 ? (
                  <button
                    onClick={openExplore}
                    className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-full border border-[#D14A28]/20 bg-[#FFF7F2] px-5 py-2.5 text-[14px] font-semibold text-[#B8502F] hover:bg-[#FFF1E8]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>议题广场</span>
                  </button>
                ) : null}
              </div>

              <SynthesisCard synthesis={curatedSynthesis} />
            </div>
          ) : null}

          {activeTab === 'favorites' ? (
            <div className="flex h-full flex-1 flex-col justify-start overflow-hidden px-4 pb-2 pt-4 md:px-5">
              <div className="mb-4">
                <h1 className="font-serif font-black text-xl tracking-tight text-[#1A1A1A] flex items-center gap-1.5">
                  <span>我的播客收藏</span>
                  <span className="text-[10px] bg-[#1A1A1A] text-[#FAF9F5] px-1.5 py-0.5 rounded font-mono font-bold">
                    {favoriteEpisodes.length}
                  </span>
                </h1>
                <p className="text-[11px] text-[#888888] mt-0.5 font-medium">收藏你想反复听的单集。</p>
                <p className="mt-2 text-center text-[8.5px] text-[#888888] leading-none">
                  已收藏的节目不再进入今日精选
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin scrollbar-thumb-zinc-300 min-h-0">
                {favoriteEpisodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 bg-[#FAF9F5] border border-[#1A1A1A]/20 rounded-2xl p-6 paper-texture shadow-sm">
                    <Bookmark className="w-8 h-8 stroke-1 text-[#888888] mb-3" />
                    <h3 className="font-serif font-bold text-xs text-[#1A1A1A] mb-1">还没有收藏，去今日精选看看</h3>
                    <p className="text-[10px] text-[#666666] leading-relaxed">在卡片上点爱心即可收藏</p>
                  </div>
                ) : (
                  favoriteEpisodes.map((episode) => (
                    <div
                      key={getEpisodeKey(episode)}
                      className="bg-[#FAF9F5] border border-[#1A1A1A] rounded-xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between paper-texture"
                    >
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-serif font-black text-[9.5px] border border-current px-1.5 py-0.5 rounded leading-none">
                            {episode.podcastName}
                          </span>
                          <span className="text-[9px] text-[#666666] bg-black/5 px-1 py-0.5 rounded font-medium">
                            {episode.triageTag}
                          </span>
                        </div>

                        <button
                          onClick={(event) => toggleFavorite(episode, event)}
                          className="hover:scale-105 transition-transform"
                          title="移出收藏"
                        >
                          <Check className="w-4 h-4 text-emerald-700 bg-emerald-50 rounded-full border border-emerald-600 p-0.5" />
                        </button>
                      </div>

                      <h3 className="font-serif font-bold text-[11.5px] text-[#1A1A1A] leading-relaxed mb-2.5">
                        {episode.episodeTitle}
                      </h3>

                      <div className="flex justify-between items-center text-[9px] border-t border-black/5 pt-2 mt-0.5">
                        <a
                          href={episode.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 hover:underline font-bold"
                        >
                          <span>播放该单集</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>

                        <button
                          onClick={(event) => toggleFavorite(episode, event)}
                          className="text-[9.5px] text-[#666666] hover:text-[#D14A28] font-bold"
                        >
                          移出归档
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'my' ? (
            <div className="flex h-full flex-1 flex-col justify-start overflow-hidden px-4 pb-2 pt-4 md:px-5">
              <div>
                <h1 className="font-serif font-black text-xl tracking-tight text-[#1A1A1A]">我的听荐</h1>
              </div>

              <div className="mt-5 space-y-3">
                <div className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 pb-5 pt-5 paper-texture">
                  <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                  <p className="text-[28px] font-serif font-black leading-none text-[#1A1A1A]">
                    {daysSinceFirstVisit}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#888888]">陪伴你 {daysSinceFirstVisit} 天</p>
                </div>

                <div className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 pb-5 pt-5 paper-texture">
                  <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                  <p className="text-[28px] font-serif font-black leading-none text-[#1A1A1A]">
                    {importedFavoritesCount}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#888888]">
                    收藏了 {importedFavoritesCount} 期
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 pb-5 pt-5 paper-texture">
                  <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                  <p className="text-[28px] font-serif font-black leading-none text-[#1A1A1A]">38</p>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#888888]">订阅了 38 档播客</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 z-[90] flex items-center justify-between border-t-2 border-[#1A1A1A] bg-[#FAF9F5] px-4 pt-2 md:px-5 paper-texture"
          style={{
            minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <button
            onClick={() => switchTab('curated')}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 relative focus:outline-none cursor-pointer"
          >
            <Compass className="w-4 h-4 transition-transform" color={activeTab === 'curated' ? '#1A1A1A' : '#666666'} />
            <span className={`text-[10px] font-serif font-black ${activeTab === 'curated' ? 'text-[#1A1A1A]' : 'text-[#666666]'}`}>
              今日精选
            </span>
            {activeTab === 'curated' ? <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" /> : null}
          </button>

          <button
            onClick={() => switchTab('favorites')}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 relative focus:outline-none cursor-pointer"
          >
            <Bookmark className="w-4 h-4 transition-transform" color={activeTab === 'favorites' ? '#1A1A1A' : '#666666'} />
            <span className={`text-[10px] font-serif font-black ${activeTab === 'favorites' ? 'text-[#1A1A1A]' : 'text-[#666666]'}`}>
              收藏夹
            </span>
            {activeTab === 'favorites' ? <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" /> : null}
          </button>

          <button
            onClick={() => switchTab('my')}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 relative focus:outline-none cursor-pointer"
          >
            <User className="w-4 h-4 transition-transform" color={activeTab === 'my' ? '#1A1A1A' : '#666666'} />
            <span className={`text-[10px] font-serif font-black ${activeTab === 'my' ? 'text-[#1A1A1A]' : 'text-[#666666]'}`}>
              我的
            </span>
            {activeTab === 'my' ? <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" /> : null}
          </button>
        </div>

        {showExplore ? (
          <div className="absolute inset-0 z-[95] bg-[#F7F4EC]/95 backdrop-blur-[2px]">
            <div
              className="flex h-full flex-col px-4 pt-5 md:px-5"
              style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <div className="flex items-center gap-2">
                  {selectedTopic ? (
                    <button
                      onClick={() => setSelectedTopicIndex(null)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white"
                      aria-label="返回议题列表"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  ) : null}
                  <div>
                    {selectedTopic ? (
                      <>
                        <p className="font-serif font-black text-[18px] leading-snug text-[#1A1A1A]">
                          {selectedTopic.title}
                        </p>
                        <div className="mt-2 inline-flex rounded-full bg-[#EFECE6] px-2.5 py-1 text-[9px] font-medium text-[#666666]">
                          {selectedTopic.domainTag}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-serif font-black text-lg text-[#1A1A1A]">议题广场</p>
                        <p className="text-[10px] leading-relaxed text-[#7B7468]">
                          这是AI替你做的"播客圆桌"  它读完最近14天所有节目,把多档同时关心的话题摆到一起。诚实不编,凑不齐就不出。
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {!selectedTopic ? (
                  <button
                    onClick={closeExplore}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white"
                    aria-label="关闭探索"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {!selectedTopic ? (
                <div className="flex-1 overflow-y-auto pt-5">
                  {exploreTopics.length === 0 ? (
                    <div className="flex min-h-full items-center justify-center px-6 text-center">
                      <p className="text-[11px] leading-relaxed text-[#888888]">
                        最近两周,你关注的几档播客还没聊到一起的话题。明天再来看看吧~
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exploreTopics.map((topic, index) => (
                        <button
                          key={`${topic.title}-${index}`}
                          onClick={() => setSelectedTopicIndex(index)}
                          className="relative w-full overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 pb-4 pt-5 text-left paper-texture"
                        >
                          <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                          <h2
                            className="font-serif font-black text-[15px] leading-snug text-[#1A1A1A]"
                            style={{
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {topic.title}
                          </h2>
                          <div className="mt-3 inline-flex rounded-full bg-[#EFECE6] px-2.5 py-1 text-[9px] font-medium text-[#666666]">
                            {topic.domainTag}
                          </div>
                          <p className="mt-3 text-[10px] leading-none text-[#888888]">
                            {getTopicPodcastCount(topic)}档播客聊到这件事
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pt-4">
                  <div className="space-y-5 pb-4">
                    <TopicSection
                      title="🤝 播客观点共识"
                      points={selectedTopic.consensus}
                      resolveEpisodeHref={resolveTopicEpisodeHref}
                    />
                    <TopicSection
                      title="⚡ 播客观点分歧"
                      points={selectedTopic.divergence}
                      resolveEpisodeHref={resolveTopicEpisodeHref}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
