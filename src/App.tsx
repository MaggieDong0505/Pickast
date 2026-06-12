/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import exploreDataRaw from './explore.json';
import favoritesDataRaw from './favorites.json';
import rankingDataRaw from './ranking.json';
import { initialData } from './generatedData';
import { FavoriteHeartButton } from './components/FavoriteHeartButton';
import { useFavorites } from './hooks/useFavorites';
import {
  ExploreData,
  FavoriteRecord,
  PodcastEpisode,
  PodcastSynthesis,
  RankingEpisode,
  Topic,
  TopicPoint,
} from './types';

type AppTab = 'curated' | 'favorites' | 'my';

const exploreData = exploreDataRaw as ExploreData;
const favoritesSeed = favoritesDataRaw as PodcastEpisode[];
const rankingData = rankingDataRaw as RankingEpisode[];
const FIRST_VISIT_DATE_STORAGE_KEY = 'firstVisitDate';
const LEGACY_FIRST_VISIT_DATE_STORAGE_KEY = 'pickast-first-visit-date';
const ABOUT_PICKAST_TEXT = `听荐是一款 AI 驱动的播客筛选工具,帮你从信息洪流里捞出真正值得听的内容。

① 今日精选
AI 每天替你听完上百集播客,挑出 3 期最值得听的,附推荐理由和节目金句,让你 10 秒就能判断"要不要听这期"。

② 议题广场
当多档播客同时讨论同一件事,AI 会自动聚合它们的共识与分歧,一眼看清"大家怎么看"。

③ 收藏夹
想反复听的单集、击中你的播客观点,一键收藏。已收藏的不再重复推荐,避免推荐疲劳。

把筛选交给 AI,把聆听留给你。`;

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

function buildEpisodeWebHref(episodeId: string) {
  return `https://www.xiaoyuzhoufm.com/episode/${episodeId}`;
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

function getEpisodeIdValue(episode: PodcastEpisode) {
  return episode.episodeId ?? getEpisodeId(episode);
}

const RECOMMENDATION_REASON_MAX_LENGTH = 50;
const QUOTE_FONT_SIZE_MAX = 15;
const QUOTE_FONT_SIZE_MIN = 12;

function getSafeRecommendationReason(reason?: string) {
  const normalizedReason = reason?.trim() ?? '';
  if (!normalizedReason || normalizedReason.length <= RECOMMENDATION_REASON_MAX_LENGTH) {
    return normalizedReason;
  }

  console.warn('[Pickast] Briefing recommendation reason is too long, trimming at sentence boundary:', normalizedReason);

  const lastPeriodBeforeLimit = normalizedReason.lastIndexOf('。', RECOMMENDATION_REASON_MAX_LENGTH);
  if (lastPeriodBeforeLimit >= 0) {
    return normalizedReason.slice(0, lastPeriodBeforeLimit + 1);
  }

  const lastPeriod = normalizedReason.lastIndexOf('。');
  return lastPeriod >= 0 ? normalizedReason.slice(0, lastPeriod + 1) : normalizedReason;
}

function toBriefingFavoriteRecord(episode: PodcastEpisode): FavoriteRecord | null {
  const episodeId = getEpisodeIdValue(episode);
  if (!episodeId) {
    return null;
  }

  return {
    id: episodeId,
    type: 'briefing',
    title: episode.episodeTitle,
    podcastName: episode.podcastName,
    coverUrl: episode.coverImageUrl ?? '',
    topicTag: episode.topicTag ?? episode.triageTag,
    addedAt: Date.now(),
  };
}

type SubscriptionMockItem = {
  podcastName: string;
  coverUrl: string;
  podcastId: string | null;
};

type PodcastSourceWithOptionalId = {
  podcastName: string;
  coverImageUrl?: string | null;
  podcastId?: string | null;
  podcast_id?: string | null;
};

function getPodcastId(source: PodcastSourceWithOptionalId) {
  return source.podcastId ?? source.podcast_id ?? null;
}

function buildPodcastWebHref(podcastName: string, podcastId: string | null) {
  if (podcastId) {
    return `https://www.xiaoyuzhoufm.com/podcast/${podcastId}`;
  }

  return `https://www.xiaoyuzhoufm.com/search?q=${encodeURIComponent(podcastName)}`;
}

function buildPodcastDeepLink(podcastId: string | null) {
  return podcastId ? `cosmos://page.cos/podcast/${podcastId}` : null;
}

function openAdaptiveXiaoyuzhouLink({
  webUrl,
  deepLinkUrl,
  isCompactViewport,
}: {
  webUrl: string;
  deepLinkUrl: string | null;
  isCompactViewport: boolean;
}) {
  if (isCompactViewport && deepLinkUrl) {
    const fallbackTimer = window.setTimeout(() => {
      window.location.href = webUrl;
    }, 1500);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.clearTimeout(fallbackTimer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.location.href = deepLinkUrl;
    return;
  }

  window.open(webUrl, '_blank', 'noopener');
}

type EpisodeDeckProps = {
  episodes: PodcastEpisode[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  isFavorited: (episode: PodcastEpisode) => boolean;
  onToggleFavorite: (episode: PodcastEpisode, event?: React.MouseEvent) => void;
  isCompactViewport: boolean;
};

function AdaptiveQuoteText({ quote }: { quote: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [fontSize, setFontSize] = useState(QUOTE_FONT_SIZE_MAX);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) {
      return undefined;
    }

    const fitQuote = () => {
      let low = QUOTE_FONT_SIZE_MIN;
      let high = QUOTE_FONT_SIZE_MAX;
      let best = QUOTE_FONT_SIZE_MIN;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        text.style.fontSize = `${mid}px`;

        const fits =
          text.scrollHeight <= container.clientHeight &&
          text.scrollWidth <= container.clientWidth;

        if (fits) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      text.style.fontSize = `${best}px`;
      setFontSize(best);
    };

    fitQuote();

    const resizeObserver = new ResizeObserver(fitQuote);
    resizeObserver.observe(container);
    window.addEventListener('resize', fitQuote);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', fitQuote);
    };
  }, [quote]);

  return (
    <div ref={containerRef} className="card-quote-text-box">
      <p
        ref={textRef}
        className="card-quote-text font-serif font-medium text-[#555555]"
        style={{ fontSize }}
      >
        {quote}
      </p>
    </div>
  );
}

function EpisodeDeck({
  episodes,
  activeIndex,
  onActiveIndexChange,
  isFavorited,
  onToggleFavorite,
  isCompactViewport,
}: EpisodeDeckProps) {
  const episodeCount = episodes.length;

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
      <div className="relative mt-16 flex w-full flex-none flex-col items-center justify-start overflow-visible">
        <div className="relative h-fit w-full max-w-[344px] overflow-visible min-h-0">
          {episodes.map((episode, index) => {
            let diff = 0;
            const nextIndex = (activeIndex + 1) % episodeCount;
            const prevIndex = (activeIndex - 1 + episodeCount) % episodeCount;

            if (index === activeIndex) diff = 0;
            else if (episodeCount > 1 && index === nextIndex) diff = 1;
            else if (episodeCount > 2 && index === prevIndex) diff = -1;
            else diff = 2;

            const recommendationReason = getSafeRecommendationReason(episode.whyRecommended);
            const goldenQuote = episode.goldenQuotes?.[0]?.quote?.trim() ?? '';

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
                className="episode-card relative overflow-hidden rounded-[20px] border border-black/10 bg-white paper-texture cursor-grab active:cursor-grabbing select-none"
                style={{
                  position: diff === 0 ? 'relative' : 'absolute',
                  left: diff === 0 ? '0' : '24px',
                  right: diff === 0 ? '0' : '24px',
                  top: diff === 0 ? 'auto' : 0,
                  bottom: 'auto',
                  width: 'auto',
                  filter: diff === 0
                    ? 'drop-shadow(0 12px 40px rgba(0, 0, 0, 0.06))'
                    : 'drop-shadow(0 12px 40px rgba(0, 0, 0, 0.04))',
                }}
              >
                <div className="card-accent-strip" />

                <div className="card-top-row">
                  <div className="min-w-0 pr-1">
                    <span className="font-serif font-black text-[12px] leading-tight border border-zinc-300 px-2.5 py-1 rounded text-zinc-900 bg-[#FAF9F5] select-none break-words max-w-[185px]">
                      {episode.podcastName}
                    </span>
                  </div>

                  <FavoriteHeartButton
                    isFavorited={isFavorited(episode)}
                    onClick={(event) => onToggleFavorite(episode, event)}
                    ariaLabel={`收藏 ${episode.episodeTitle}`}
                  />
                </div>

                <div className="card-tag-row">
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

                <h2 className="card-title-text font-serif font-black text-[14px] text-[#1A1A1A] hover:text-[#D14A28] transition-colors">
                  {episode.episodeTitle}
                </h2>

                <div className="card-reason-slot text-justify">
                  {recommendationReason ? (
                    <p className="card-reason-text text-[12px] text-zinc-600">
                      <span className="font-serif font-bold text-[#1A1A1A]">【推荐语】</span>
                      {recommendationReason}
                    </p>
                  ) : null}
                </div>

                <div className="card-cover-frame overflow-hidden bg-white">
                  {episode.coverImageUrl ? (
                    <img
                      src={episode.coverImageUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                      className="h-full w-full object-cover opacity-[0.72] saturate-[0.92]"
                    />
                  ) : null}
                </div>

                <div className="card-quote-block">
                  {goldenQuote ? (
                    <>
                      <span aria-hidden="true" className="card-quote-mark">
                        "
                      </span>
                      <AdaptiveQuoteText quote={goldenQuote} />
                    </>
                  ) : null}
                </div>

                <div className="card-footer-bar flex items-center justify-between gap-3">
                  <XiaoyuzhouListenLink
                    episodeId={getEpisodeIdValue(episode)}
                    isCompactViewport={isCompactViewport}
                  />
                  <span className="font-mono text-[8px] text-zinc-400">
                    第 {index + 1} 集 / 共 {episodeCount} 集
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
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

type XiaoyuzhouListenLinkProps = {
  episodeId: string | null;
  isCompactViewport: boolean;
  className?: string;
};

function XiaoyuzhouListenLink({
  episodeId,
  isCompactViewport,
  className = '',
}: XiaoyuzhouListenLinkProps) {
  if (!episodeId) {
    return null;
  }

  const handleClick = () => {
    const webUrl = buildEpisodeWebHref(episodeId);
    const deepLink = buildEpisodeHref(episodeId);
    openAdaptiveXiaoyuzhouLink({
      webUrl,
      deepLinkUrl: deepLink,
      isCompactViewport,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center text-[12px] font-medium leading-none text-[#FF7A1A] hover:opacity-80 active:opacity-60 transition ${className}`.trim()}
    >
      去小宇宙听 →
    </button>
  );
}

function TopicSection({
  topic,
  title,
  points,
  isFavorited,
  onToggleFavorite,
  isCompactViewport,
}: {
  topic: Topic;
  title: string;
  points: TopicPoint[];
  isFavorited: (episodeId: string) => boolean;
  onToggleFavorite: (point: TopicPoint, topic: Topic, event?: React.MouseEvent) => void;
  isCompactViewport: boolean;
}) {
  if (!points.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-serif font-black text-[15px] text-[#1A1A1A]">{title}</h2>
      <div className="space-y-2.5">
        {points.map((point, index) => (
          <div
            key={`${point.episodeId}-${index}`}
            className="relative rounded-xl bg-[#F1EEE8] px-3 py-3 pb-10"
          >
            <FavoriteHeartButton
              isFavorited={isFavorited(point.episodeId)}
              onClick={(event) => onToggleFavorite(point, topic, event)}
              ariaLabel={`收藏 ${point.podcast} 的单集`}
              className="absolute right-2.5 top-2.5 z-10"
            />
            <p className="text-[14px] font-semibold text-[#666666]">{point.podcast}</p>
            <p className="mt-1 text-[15px] leading-[1.6] text-[#1A1A1A]">{point.point}</p>
            <XiaoyuzhouListenLink
              episodeId={point.episodeId}
              isCompactViewport={isCompactViewport}
              className="absolute bottom-3 left-4"
            />
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
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.innerWidth <= 768;
  });
  const curatedEpisodes = useMemo(
    () => [initialData.mainEpisode, ...initialData.backupEpisodes],
    []
  );
  const briefingSeedEpisodes = useMemo(
    () => [...curatedEpisodes, ...favoritesSeed],
    [curatedEpisodes]
  );
  const curatedSynthesis = toSynthesis(initialData.synthesis);
  const exploreTopics = useMemo(() => (Array.isArray(exploreData) ? exploreData : []), []);
  const selectedTopic = selectedTopicIndex !== null ? exploreTopics[selectedTopicIndex] ?? null : null;
  const podcastCoverLookup = useMemo(() => {
    const map = new Map<string, string>();

    briefingSeedEpisodes.forEach((episode) => {
      if (episode.coverImageUrl && !map.has(episode.podcastName)) {
        map.set(episode.podcastName, episode.coverImageUrl);
      }
    });

    return map;
  }, [briefingSeedEpisodes]);
  const episodeLookup = useMemo(() => {
    const map = new Map<string, PodcastEpisode>();
    briefingSeedEpisodes.forEach((episode) => {
      const episodeId = getEpisodeIdValue(episode);
      if (episodeId && !map.has(episodeId)) {
        map.set(episodeId, episode);
      }
    });
    return map;
  }, [briefingSeedEpisodes]);
  const briefingFavoriteSeed = useMemo(
    () =>
      favoritesSeed
        .map(toBriefingFavoriteRecord)
        .filter((favorite): favorite is FavoriteRecord => Boolean(favorite)),
    []
  );
  const legacyBriefingFavoriteLookup = useMemo(() => {
    const map = new Map<string, FavoriteRecord>();

    briefingSeedEpisodes.forEach((episode) => {
      const favorite = toBriefingFavoriteRecord(episode);
      if (favorite && !map.has(favorite.id)) {
        map.set(favorite.id, favorite);
      }
    });

    return map;
  }, [briefingSeedEpisodes]);
  const { favorites, isFavorited, toggleFavorite } = useFavorites({
    legacyLookup: legacyBriefingFavoriteLookup,
    seedFavorites: briefingFavoriteSeed,
  });
  const topicEpisodeMetaLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        title: string;
        podcastName: string;
        coverUrl: string;
      }
    >();

    rankingData.forEach((episode) => {
      map.set(episode.uniqueId, {
        title: episode.episodeTitle,
        podcastName: episode.podcastName,
        coverUrl: podcastCoverLookup.get(episode.podcastName) ?? '',
      });
    });

    briefingSeedEpisodes.forEach((episode) => {
      const episodeId = getEpisodeIdValue(episode);
      if (!episodeId) {
        return;
      }

      map.set(episodeId, {
        title: episode.episodeTitle,
        podcastName: episode.podcastName,
        coverUrl: episode.coverImageUrl ?? podcastCoverLookup.get(episode.podcastName) ?? '',
      });
    });

    return map;
  }, [briefingSeedEpisodes, podcastCoverLookup]);
  const topicEpisodeDetailLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        point: string;
        topicTitle: string;
        podcastName: string;
      }
    >();

    exploreTopics.forEach((topic) => {
      [...topic.consensus, ...topic.divergence].forEach((point) => {
        if (!map.has(point.episodeId)) {
          map.set(point.episodeId, {
            point: point.point,
            topicTitle: topic.title,
            podcastName: point.podcast,
          });
        }
      });
    });

    return map;
  }, [exploreTopics]);
  const subscriptionItems = useMemo<SubscriptionMockItem[]>(() => {
    const map = new Map<string, SubscriptionMockItem>();

    const registerSource = (source: PodcastSourceWithOptionalId) => {
      if (!map.has(source.podcastName)) {
        map.set(source.podcastName, {
          podcastName: source.podcastName,
          coverUrl: source.coverImageUrl ?? '',
          podcastId: getPodcastId(source),
        });
        return;
      }

      const existing = map.get(source.podcastName);
      if (!existing) {
        return;
      }

      if (!existing.coverUrl && source.coverImageUrl) {
        existing.coverUrl = source.coverImageUrl;
      }

      if (!existing.podcastId) {
        existing.podcastId = getPodcastId(source);
      }
    };

    curatedEpisodes.forEach((episode) => registerSource(episode as PodcastSourceWithOptionalId));
    exploreTopics.forEach((topic) => {
      [...topic.consensus, ...topic.divergence].forEach((point) => {
        registerSource({ podcastName: point.podcast });
      });
    });
    rankingData.forEach((episode) => registerSource(episode as PodcastSourceWithOptionalId));

    return [...map.values()];
  }, [curatedEpisodes, exploreTopics]);
  const favoriteItems = useMemo(
    () => [...favorites].sort((a, b) => b.addedAt - a.addedAt),
    [favorites]
  );

  useEffect(() => {
    const updateViewport = () => {
      setIsCompactViewport(window.innerWidth <= 768);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const toggleBriefingFavorite = (episode: PodcastEpisode, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const favorite = toBriefingFavoriteRecord(episode);
    if (!favorite) {
      return;
    }

    toggleFavorite(favorite);
  };

  const toggleTopicEpisodeFavorite = (
    point: TopicPoint,
    topic: Topic,
    event?: React.MouseEvent
  ) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const meta = topicEpisodeMetaLookup.get(point.episodeId);
    toggleFavorite({
      id: point.episodeId,
      type: 'topic_episode',
      title: meta?.title ?? point.point,
      podcastName: meta?.podcastName ?? point.podcast,
      coverUrl: meta?.coverUrl ?? '',
      topicTag: topic.title,
      addedAt: Date.now(),
    });
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

  const shortWeekday = getShortWeekday(initialData.chinaDateStr);

  useEffect(() => {
    if (activeTab !== 'my') {
      return;
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    const currentFirstVisit = window.localStorage.getItem(FIRST_VISIT_DATE_STORAGE_KEY);
    const legacyFirstVisit = window.localStorage.getItem(LEGACY_FIRST_VISIT_DATE_STORAGE_KEY);
    const firstVisitDate = currentFirstVisit ?? legacyFirstVisit ?? todayStr;

    if (!currentFirstVisit) {
      window.localStorage.setItem(FIRST_VISIT_DATE_STORAGE_KEY, firstVisitDate);
    }

    setDaysSinceFirstVisit(getCalendarDayDiff(firstVisitDate, today) + 1);
  }, [activeTab]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div
      id="briefing-app"
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#EFECE6] pt-[env(safe-area-inset-top)] font-sans antialiased text-[#1A1A1A]"
    >
      <div
        className="relative mx-auto flex h-full w-full max-w-[480px] flex-1 flex-col overflow-hidden bg-[#F7F4EC] select-none"
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

        <div className="relative flex flex-1 flex-col overflow-hidden pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
          {activeTab === 'curated' ? (
            <div className="flex h-full flex-1 flex-col justify-center overflow-hidden px-4 pb-2 pt-0 md:px-5">
              <div className="mt-4 flex items-center justify-between border-b border-black/10 pb-2 select-none">
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

              <div className="flex flex-1 min-h-0 flex-col justify-center">
                <EpisodeDeck
                  episodes={curatedEpisodes}
                  activeIndex={activeIndex}
                  onActiveIndexChange={setActiveIndex}
                  isFavorited={(episode) => {
                    const episodeId = getEpisodeIdValue(episode);
                    return episodeId ? isFavorited(episodeId, 'briefing') : false;
                  }}
                  onToggleFavorite={toggleBriefingFavorite}
                  isCompactViewport={isCompactViewport}
                />

                <div className="mt-3 flex w-full shrink-0">
                  {exploreTopics.length > 0 ? (
                    <button
                      onClick={openExplore}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[22px] border border-[#D14A28]/20 bg-[#FFF7F2] px-5 text-[14px] font-semibold text-[#B8502F] hover:bg-[#FFF1E8]"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#D14A28]/10">
                        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      <span>议题广场</span>
                    </button>
                  ) : null}
                </div>

                <div className="pt-0.5">
                  <SynthesisCard synthesis={curatedSynthesis} />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'favorites' ? (
            <div className="flex h-full flex-1 flex-col justify-start overflow-hidden px-4 pb-2 pt-4 md:px-5">
              <div className="mb-4">
                <h1 className="font-serif font-black text-xl tracking-tight text-[#1A1A1A] flex items-center gap-1.5">
                  <span>我的播客收藏</span>
                  <span className="text-[10px] bg-[#1A1A1A] text-[#FAF9F5] px-1.5 py-0.5 rounded font-mono font-bold">
                    {favoriteItems.length}
                  </span>
                </h1>
                <p className="text-[11px] text-[#888888] mt-0.5 font-medium">收藏你想反复听的单集。</p>
                <p className="mt-2 text-center text-[8.5px] text-[#888888] leading-none">
                  已收藏的节目不再进入今日精选
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 scrollbar-thin scrollbar-thumb-zinc-300 min-h-0">
                {favoriteItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 bg-[#FAF9F5] border border-[#1A1A1A]/20 rounded-2xl p-6 paper-texture shadow-sm">
                    <Bookmark className="w-8 h-8 stroke-1 text-[#888888] mb-3" />
                    <h3 className="font-serif font-bold text-xs text-[#1A1A1A] mb-1">还没有收藏，去今日精选看看</h3>
                    <p className="text-[10px] text-[#666666] leading-relaxed">在卡片上点爱心即可收藏</p>
                  </div>
                ) : (
                  favoriteItems.map((favorite) => {
                    const briefingEpisode = episodeLookup.get(favorite.id);
                    const topicEpisodeDetail = topicEpisodeDetailLookup.get(favorite.id);

                    if (favorite.type === 'topic_episode') {
                      return (
                        <div
                          key={`${favorite.type}-${favorite.id}`}
                          className="bg-[#FAF9F5] border border-[#1A1A1A]/15 rounded-xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between paper-texture"
                        >
                          <div className="absolute inset-x-0 top-0 h-[5px]" style={{ backgroundColor: '#D14A28' }} />

                          <div className="flex justify-between items-start gap-4 mb-2 pt-1">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0 pr-1">
                              <span className="font-serif font-black text-[9.5px] border border-current px-1.5 py-0.5 rounded leading-none">
                                {favorite.podcastName}
                              </span>
                              <span className="text-[9px] text-[#666666] bg-black/5 px-1 py-0.5 rounded font-medium">
                                {favorite.topicTag}
                              </span>
                            </div>

                            <FavoriteHeartButton
                              isFavorited
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleFavorite(favorite);
                              }}
                              title="取消收藏"
                              ariaLabel={`取消收藏 ${favorite.title}`}
                              className="shrink-0"
                            />
                          </div>

                          <h3 className="font-serif font-bold text-[11.5px] text-[#1A1A1A] leading-relaxed mb-1.5">
                            {topicEpisodeDetail?.point ?? favorite.title}
                          </h3>

                          <p className="text-[9px] text-[#666666] leading-relaxed mb-2.5">
                            所属议题：{topicEpisodeDetail?.topicTitle ?? favorite.topicTag}
                          </p>

                          <div className="flex justify-between items-center text-[9px] border-t border-black/5 pt-2 mt-0.5">
                            <XiaoyuzhouListenLink
                              episodeId={favorite.id}
                              isCompactViewport={isCompactViewport}
                              className="font-bold text-[#D14A28]"
                            />
                          </div>
                        </div>
                      );
                    }

                    if (!briefingEpisode) {
                      return null;
                    }

                    return (
                      <div
                        key={`${favorite.type}-${favorite.id}`}
                        className="bg-[#FAF9F5] border border-[#1A1A1A] rounded-xl p-3.5 shadow-sm relative overflow-hidden flex flex-col justify-between paper-texture"
                      >
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-serif font-black text-[9.5px] border border-current px-1.5 py-0.5 rounded leading-none">
                              {briefingEpisode.podcastName}
                            </span>
                            <span className="text-[9px] text-[#666666] bg-black/5 px-1 py-0.5 rounded font-medium">
                              {briefingEpisode.triageTag}
                            </span>
                          </div>

                          <button
                            onClick={(event) => toggleBriefingFavorite(briefingEpisode, event)}
                            className="hover:scale-105 transition-transform"
                            title="移出收藏"
                          >
                            <Check className="w-4 h-4 text-emerald-700 bg-emerald-50 rounded-full border border-emerald-600 p-0.5" />
                          </button>
                        </div>

                        <h3 className="font-serif font-bold text-[11.5px] text-[#1A1A1A] leading-relaxed mb-2.5">
                          {briefingEpisode.episodeTitle}
                        </h3>

                        <div className="flex justify-between items-center text-[9px] border-t border-black/5 pt-2 mt-0.5">
                          <XiaoyuzhouListenLink
                            episodeId={favorite.id}
                            isCompactViewport={isCompactViewport}
                            className="font-bold"
                          />

                          <button
                            onClick={(event) => toggleBriefingFavorite(briefingEpisode, event)}
                            className="text-[9.5px] text-[#666666] hover:text-[#D14A28] font-bold"
                          >
                            移出归档
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'my' ? (
            <div className="flex h-full flex-1 flex-col justify-start overflow-y-auto px-4 pb-1 pt-3 md:px-5">
              <div>
                <h1 className="font-serif font-black text-xl tracking-tight text-[#1A1A1A]">我的听荐</h1>
              </div>

              <div className="mt-2 pb-1">
                <div className="space-y-2">
                  <section className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 pb-3.5 pt-3.5 paper-texture shadow-sm">
                    <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                    <div className="flex items-start justify-between gap-4">
                      <div className="max-w-[230px]">
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#888888]">
                          陪伴统计
                        </p>
                        <p className="mt-2 font-serif text-[20px] font-black leading-[1.35] text-[#1A1A1A]">
                          认识听荐的第{' '}
                          <span className="rounded bg-[#FFF1E8] px-1.5 py-0.5 text-[#D14A28]">
                            {daysSinceFirstVisit || 1}
                          </span>
                          天
                        </p>
                        <p className="mt-2 text-[12px] leading-relaxed text-[#666666]">
                          把筛选交给 AI,把聆听留给你
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="relative flex h-[280px] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 pb-3 pt-3.5 paper-texture shadow-sm">
                    <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-serif font-black text-[17px] text-[#1A1A1A]">我的订阅源</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setToastMessage('V2 将支持真实 RSS 导入,敬请期待')}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-[#D14A28]/20 bg-[#FFF7F2] px-3.5 text-[11px] font-semibold text-[#B8502F] transition hover:bg-[#FFF1E8] active:scale-[0.98]"
                      >
                        + 导入 OPML 文件
                      </button>
                    </div>

                    <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-zinc-300">
                      {subscriptionItems.map((item) => (
                        <button
                          key={item.podcastName}
                          type="button"
                          onClick={() => {
                            const webUrl = buildPodcastWebHref(item.podcastName, item.podcastId);
                            const deepLinkUrl = buildPodcastDeepLink(item.podcastId);
                            openAdaptiveXiaoyuzhouLink({
                              webUrl,
                              deepLinkUrl,
                              isCompactViewport,
                            });
                          }}
                          className="flex w-full items-center gap-3 rounded-[18px] border border-black/5 bg-[#FAF9F5] px-2.5 py-2.5 text-left transition hover:bg-[#FFF7F2] active:scale-[0.99] cursor-pointer"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-black/10 bg-[#EFECE6]">
                            {item.coverUrl ? (
                              <img
                                src={item.coverUrl}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="px-1 text-center font-serif text-[11px] font-black leading-tight text-[#1A1A1A]">
                                {item.podcastName.slice(0, 2)}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif font-black text-[12px] text-[#1A1A1A]">
                              {item.podcastName}
                            </p>
                            <p className="mt-0.5 text-[9px] text-[#888888]">
                              {item.podcastId ? '已绑定播客主页' : '将通过搜索打开主页'}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full border border-[#D14A28]/20 bg-[#FFF7F2] px-2.5 py-1 text-[9px] font-bold text-[#B8502F]">
                            已订阅
                          </span>
                        </button>
                      ))}
                    </div>

                    <p className="mt-3 text-[10px] leading-relaxed text-[#888888]">
                      V2 将支持真实 RSS 导入
                    </p>
                  </section>

                  <section className="min-h-0 space-y-2">
                    <div className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white px-4 py-3 paper-texture shadow-sm">
                      <div className="absolute inset-x-0 top-0 h-[5.5px]" style={{ backgroundColor: '#D14A28' }} />
                      <button
                        type="button"
                        onClick={() => setAboutExpanded((value) => !value)}
                        className="flex w-full items-center justify-between gap-4 text-left"
                      >
                        <span className="font-serif font-black text-[15px] text-[#1A1A1A]">关于听荐</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 ${
                            aboutExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {aboutExpanded ? (
                        <div className="mt-2 max-h-[200px] overflow-y-auto pr-0.5 whitespace-pre-line text-[12px] leading-relaxed text-[#666666] scrollbar-thin scrollbar-thumb-zinc-300">
                          {ABOUT_PICKAST_TEXT}
                        </div>
                      ) : null}
                    </div>

                  </section>
                  <p className="pb-0.5 text-center text-[10px] leading-none text-[#A1A1AA]">v0.1</p>
                </div>
              </div>
            </div>
          ) : null}

          {toastMessage ? (
            <motion.div
              key={toastMessage}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="pointer-events-none fixed left-1/2 top-4 z-[120] -translate-x-1/2 px-4"
            >
              <div className="rounded-full border border-black/10 bg-[#1A1A1A] px-4 py-2 text-[12px] font-medium text-[#FAF9F5] shadow-lg shadow-black/10">
                {toastMessage}
              </div>
            </motion.div>
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
                      topic={selectedTopic}
                      title="🤝 播客观点共识"
                      points={selectedTopic.consensus}
                      isFavorited={(episodeId) => isFavorited(episodeId, 'topic_episode')}
                      onToggleFavorite={toggleTopicEpisodeFavorite}
                      isCompactViewport={isCompactViewport}
                    />
                    <TopicSection
                      topic={selectedTopic}
                      title="⚡ 播客观点分歧"
                      points={selectedTopic.divergence}
                      isFavorited={(episodeId) => isFavorited(episodeId, 'topic_episode')}
                      onToggleFavorite={toggleTopicEpisodeFavorite}
                      isCompactViewport={isCompactViewport}
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
