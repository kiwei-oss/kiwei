import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flame,
  Info,
  Import,
  MessageSquare,
  MoreVertical,
  Play,
  Plus,
  Power,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import { fallbackCatalog } from "./data/fallbackCatalog.js";

const historyKey = "neon-frame-history";
const historyClearedKey = "neon-frame-history-cleared-at";
const progressKey = "neon-frame-progress";
const followingKey = "neon-frame-following";
const playbackSourcesKey = "neon-frame-playback-sources";
const secretCode = "2077";

const pageKeys = ["home", "library", "sources", "hot", "random", "history", "search", "detail", "watch"];

const animeTypes = [
  "热血战斗",
  "校园日常",
  "恋爱言情",
  "异世界奇幻",
  "科幻机甲",
  "治愈温情",
  "悬疑推理",
  "搞笑喜剧",
  "运动竞技",
  "惊悚致郁",
  "古风历史",
  "美食种田",
  "偶像音乐",
];

const allFilter = "全部";
const animeYears = Array.from({ length: 27 }, (_, index) => String(2026 - index));

const animeSeasons = [
  { key: "jan", label: "一月新番", months: ["1", "01", "一月", "冬"] },
  { key: "apr", label: "4 月新番", months: ["4", "04", "四月", "春"] },
  { key: "jul", label: "7 月新番", months: ["7", "07", "七月", "夏"] },
  { key: "oct", label: "10 月新番", months: ["10", "十月", "秋"] },
];

const typeKeywordMap = [
  ["热血战斗", ["热血", "战斗", "动作", "冒险", "少年"]],
  ["校园日常", ["校园", "日常", "青春", "社团"]],
  ["恋爱言情", ["恋爱", "爱情", "言情", "告白"]],
  ["异世界奇幻", ["异世界", "奇幻", "魔法", "幻想"]],
  ["科幻机甲", ["科幻", "机甲", "赛博朋克", "赛博", "机器人", "未来", "义体"]],
  ["治愈温情", ["治愈", "温情", "家庭", "温柔"]],
  ["悬疑推理", ["悬疑", "推理", "侦探", "犯罪"]],
  ["搞笑喜剧", ["搞笑", "喜剧", "欢乐"]],
  ["运动竞技", ["运动", "竞技", "比赛"]],
  ["惊悚致郁", ["惊悚", "恐怖", "致郁", "黑暗"]],
  ["古风历史", ["古风", "历史", "武侠", "时代"]],
  ["美食种田", ["美食", "种田", "料理", "田园"]],
  ["偶像音乐", ["偶像", "音乐", "电台", "乐队", "演唱"]],
];

const radioStations = [
  {
    frequency: "无",
    name: "无电台",
    track: "静默频道",
    tone: 36,
  },
  {
    frequency: "69.0",
    name: "MYGO!!!!!",
    track: "玻璃雨夜",
    tone: 49,
  },
  {
    frequency: "88.9",
    name: "太平洋之梦",
    track: "筒卡尔决斗者 -《抵拒与无序》",
    tone: 55,
  },
  {
    frequency: "89.3",
    name: "广播交流电",
    track: "信号噪声",
    tone: 62,
  },
  {
    frequency: "89.7",
    name: "呐喊 FM",
    track: "霓虹失真",
    tone: 68,
  },
  {
    frequency: "91.9",
    name: "皇家蓝调电台",
    track: "赛博布鲁斯",
    tone: 73,
  },
  {
    frequency: "92.9",
    name: "夜氏 FM",
    track: "边缘夜航",
    tone: 82,
  },
  {
    frequency: "95.2",
    name: "地下电台",
    track: "地底回声",
    tone: 41,
  },
];

const defaultPlaybackSources = [
  { id: "heimuer", name: "黑木耳", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "feifan", name: "非凡影视", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "tianya", name: "天涯资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "three-sixty", name: "360资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "wolong", name: "卧龙资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "huayu", name: "华为吧资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "jisu", name: "极速资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "douban", name: "豆瓣资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "baofeng", name: "暴风资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "fenghuang", name: "凤凰资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "kunyu", name: "坤宇资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "subo", name: "速播资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "xigua", name: "西瓜资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "xingchen", name: "星辰资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "xinlang", name: "新浪资源", group: "normal", mode: "iframe", enabled: false, template: "" },
  { id: "yuncang", name: "云仓资源", group: "normal", mode: "iframe", enabled: false, template: "" },
];

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore private browsing or disabled storage.
  }
}

function mergePlaybackSources(storedSources = []) {
  const storedById = new Map(
    (Array.isArray(storedSources) ? storedSources : [])
      .filter((source) => source && source.id)
      .map((source) => [source.id, source])
  );
  const mergedDefaults = defaultPlaybackSources.map((source) => ({
    ...source,
    enabled: storedById.has(source.id) ? Boolean(storedById.get(source.id).enabled) : source.enabled,
    endpoint: storedById.get(source.id)?.endpoint || source.endpoint || "",
    mode: storedById.get(source.id)?.mode || source.mode,
    template: storedById.get(source.id)?.template || source.template,
  }));
  const customSources = (Array.isArray(storedSources) ? storedSources : [])
    .filter((source) => source?.custom && source.id && source.name)
    .map((source) => {
      const { endpoint, mode, template, ...rest } = source;
      return {
        group: "custom",
        enabled: true,
        ...rest,
        custom: true,
        mode: mode === "direct" ? "direct" : "iframe",
        template: template || endpoint || "",
      };
    });
  return [...mergedDefaults, ...customSources];
}

function readPlaybackSources() {
  return mergePlaybackSources(readStorage(playbackSourcesKey, []));
}

function buildPlaybackSourceUrl(source, item, episodeSource, fallbackUrl = "") {
  if (!source?.template) return "";
  const episodeNumber = episodeSource?.number || 1;
  const values = {
    encodedTitle: encodeURIComponent(item.title || ""),
    encodedUrl: encodeURIComponent(fallbackUrl || item.externalUrl || item.title || ""),
    episode: String(episodeNumber),
    id: item.id || "",
    title: item.title || "",
    url: fallbackUrl || item.externalUrl || "",
    year: item.year || "",
  };
  return source.template.replace(/\{(encodedTitle|encodedUrl|episode|id|title|url|year)\}/g, (_, key) => values[key]);
}

function getUsablePlaybackSources(sources, item, episodeSource, fallbackUrl = "") {
  return sources
    .filter((source) => source.enabled && source.template)
    .map((source) => ({
      ...source,
      url: buildPlaybackSourceUrl(source, item, episodeSource, fallbackUrl),
    }))
    .filter((source) => source.url);
}

function getCurrentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const route = decodeURIComponent(hash.split("?")[0]).trim();
  if (route === "hub") return "hot";
  if (route === "following") return "history";
  if (route === "featured" || route === "categories" || route === "netdisk") return "home";
  return pageKeys.includes(route) ? route : "home";
}

function getHashSearchQuery() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const queryString = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(queryString).get("q") || "";
}

function getHashParam(name) {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const queryString = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(queryString).get(name) || "";
}

function encodeLibraryFilter(value) {
  return encodeURIComponent(value || allFilter);
}

function toSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN");
}

function matchSearchItem(item, query) {
  const normalizedQuery = toSearchText(query);
  if (!normalizedQuery) return 1;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const title = toSearchText(item.title);
  const text = toSearchText(
    [
      item.title,
      item.subtitle,
      item.category,
      item.type,
      item.season,
      item.year,
      item.description,
      item.label,
      item.moegirlTitle,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ].join(" ")
  );

  if (!tokens.every((token) => text.includes(token))) return 0;

  let score = item.match;
  if (title === normalizedQuery) score += 120;
  if (title.includes(normalizedQuery)) score += 60;
  if (toSearchText(item.type).includes(normalizedQuery)) score += 34;
  if (toSearchText(item.year).includes(normalizedQuery)) score += 22;
  if (toSearchText(item.season).includes(normalizedQuery)) score += 18;
  return score;
}

function normalizeCategory(category) {
  if (category === "视频种类") return "视频分类";
  return category || "片库";
}

function formatHistoryTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) return "今天 --:--";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (sameDay) return `今天 ${hours}:${minutes}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
}

function formatPlayerTime(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatEpisodeCount(item) {
  const count = item.episodeSources?.length || item.episodes || 1;
  return `全${count}话`;
}

function getEpisodeCardMeta(item, index = 0) {
  const minutes = Number(String(item.duration || "").match(/\d+/)?.[0] || item.episodes || 12);
  const fallbackSeconds = Math.max(60, minutes * 60 + index * 37);
  const duration =
    item.cardDuration ||
    item.displayDuration ||
    `${String(Math.floor(fallbackSeconds / 60)).padStart(2, "0")}:${String(fallbackSeconds % 60).padStart(2, "0")}`;

  return {
    comments: item.comments || String((item.episodes || 10) * 128 + index * 371),
    date: item.updateDate || "6-26",
    duration,
    uploader: item.uploader || item.subtitle || "NEON FRAME",
    views: item.views || `${Math.max(12, Math.round(item.match * (index + 5) * 0.82) / 10)}万`,
  };
}

function extractYear(value, index) {
  const match = String(value || "").match(/20\d{2}/);
  const year = match ? match[0] : animeYears[index % animeYears.length];
  return animeYears.includes(year) ? year : animeYears[index % animeYears.length];
}

function inferAnimeType(item, index) {
  const explicit = item.type || item.animeType || item.genreType;
  if (animeTypes.includes(explicit)) return explicit;

  const explicitList = Array.isArray(item.types) ? item.types : [];
  const directMatch = explicitList.find((type) => animeTypes.includes(type));
  if (directMatch) return directMatch;

  const source = [
    item.title,
    item.subtitle,
    item.category,
    item.description,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.genres) ? item.genres : []),
  ]
    .filter(Boolean)
    .join(" ");

  const hit = typeKeywordMap.find(([, keywords]) => keywords.some((keyword) => source.includes(keyword)));
  return hit ? hit[0] : animeTypes[index % animeTypes.length];
}

function inferAnimeSeason(item, index) {
  const explicit = item.season || item.premiereSeason || item.releaseSeason;
  if (animeSeasons.some((season) => season.label === explicit)) return explicit;

  const month = String(item.month || item.premiereMonth || item.releaseMonth || "");
  const source = [explicit, month, item.releaseDate, item.premiereDate, item.title, item.subtitle]
    .filter(Boolean)
    .join(" ");
  const hit = animeSeasons.find((season) => season.months.some((keyword) => source.includes(keyword)));
  return hit ? hit.label : animeSeasons[index % animeSeasons.length].label;
}

function normalizeCatalog(items) {
  return items
    .filter((item) => item && item.title)
    .map((item, index) => {
      const category = normalizeCategory(item.category);
      const year = extractYear(item.year || item.releaseDate || item.premiereDate, index);

      return {
        id: item.id || `anime-${index + 1}`,
        title: item.title,
        subtitle: item.subtitle || category || "动画资源",
        category,
        type: inferAnimeType(item, index),
        season: inferAnimeSeason(item, index),
        status: item.status || "archive",
        year,
        libraryYear: year,
        rating: item.rating || "16+",
        duration: item.duration || "待整理",
        image: item.image || "/assets/hero-poster.png",
        video: item.video || "",
        externalUrl: item.externalUrl || "",
        match: Number(item.match ?? 88),
        label: item.label || "片库",
        progress: Number(item.progress ?? 0),
        description: item.description || "已导入 NEON FRAME 的动画资源。",
        tags: Array.isArray(item.tags) ? item.tags : [],
        sourceKind: item.sourceKind || "",
        sourcePath: item.sourcePath || "",
        sourceRoot: item.sourceRoot || "",
        playableMode: item.playableMode || "",
        doubanUrl: item.doubanUrl || item.externalUrl || "",
        doubanPoster: item.doubanPoster || "",
        doubanTitle: item.doubanTitle || "",
        moegirlUrl: item.moegirlUrl || "",
        moegirlTitle: item.moegirlTitle || "",
        moegirlImage: item.moegirlImage || "",
        episodes: Number(item.episodes ?? item.episodeCount ?? 10),
        episodeSources: Array.isArray(item.episodeSources) ? item.episodeSources : [],
      };
    });
}

function App() {
  const [route, setRoute] = useState(getCurrentRoute);
  const [searchQuery, setSearchQuery] = useState(getHashSearchQuery);
  const [routeParams, setRouteParams] = useState(() => ({
    episode: getHashParam("episode"),
    id: getHashParam("id"),
    season: getHashParam("season"),
    type: getHashParam("type"),
    year: getHashParam("year"),
  }));
  const [catalog, setCatalog] = useState(() => normalizeCatalog(fallbackCatalog));
  const [randomIndex, setRandomIndex] = useState(0);
  const [radioOpen, setRadioOpen] = useState(false);
  const [netdiskOpen, setNetdiskOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState(() => readStorage(historyKey, []));
  const [historyClearedAt, setHistoryClearedAt] = useState(() => readStorage(historyClearedKey, 0));
  const [progressMap, setProgressMap] = useState(() => readStorage(progressKey, {}));
  const [followingIds, setFollowingIds] = useState(() => readStorage(followingKey, []));
  const [playbackSources, setPlaybackSources] = useState(readPlaybackSources);
  const secretRef = useRef({ value: "", startedAt: 0 });

  useEffect(() => {
    function handleHashChange() {
      const nextRoute = getCurrentRoute();
      setRoute(nextRoute);
      setRouteParams({
        episode: getHashParam("episode"),
        id: getHashParam("id"),
        season: getHashParam("season"),
        type: getHashParam("type"),
        year: getHashParam("year"),
      });
      setSearchQuery(nextRoute === "search" ? getHashSearchQuery() : "");
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [route]);

  useEffect(() => {
    let ignore = false;

    fetch("/media/manifest.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (ignore || !manifest) return;
        const items = Array.isArray(manifest.items) ? normalizeCatalog(manifest.items) : [];
        if (items.length > 0) setCatalog(items);
      })
      .catch(() => {
        if (!ignore) setCatalog(normalizeCatalog(fallbackCatalog));
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function handleSecretInput(event) {
      const target = event.target;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if (!/^\d$/.test(event.key)) return;

      const now = Date.now();
      const secret = secretRef.current;
      if (!secret.startedAt || now - secret.startedAt > 5000) {
        secret.value = "";
        secret.startedAt = now;
      }

      secret.value = `${secret.value}${event.key}`.slice(-secretCode.length);

      if (secret.value === secretCode && now - secret.startedAt <= 5000) {
        setRadioOpen(true);
        secret.value = "";
        secret.startedAt = 0;
      }
    }

    window.addEventListener("keydown", handleSecretInput);
    return () => window.removeEventListener("keydown", handleSecretInput);
  }, []);

  const catalogWithProgress = useMemo(
    () =>
      catalog.map((item) => ({
        ...item,
        isFollowing: followingIds.includes(item.id),
        progress: Number(progressMap[item.id]?.progress ?? item.progress ?? 0),
      })),
    [catalog, followingIds, progressMap]
  );

  const historyCatalog = useMemo(() => {
    const byId = new Map(catalogWithProgress.map((item) => [item.id, item]));
    const fromHistory = historyItems
      .map((entry) => {
        const item = byId.get(entry.id);
        return item ? { ...item, playedAt: entry.playedAt } : null;
      })
      .filter(Boolean);

    if (fromHistory.length > 0 || historyClearedAt) {
      return [...new Map(fromHistory.map((item) => [item.id, item])).values()];
    }

    return catalogWithProgress
      .filter((item) => item.progress > 0)
      .map((item, index) => ({ ...item, playedAt: Date.now() - index * 7 * 60 * 1000 }));
  }, [catalogWithProgress, historyClearedAt, historyItems]);

  const hotItems = useMemo(
    () => [...catalogWithProgress].sort((a, b) => b.match - a.match).slice(0, 18),
    [catalogWithProgress]
  );

  const followedItems = useMemo(() => catalogWithProgress.filter((item) => item.isFollowing), [catalogWithProgress]);

  const randomItems = useMemo(() => {
    const base = [...catalogWithProgress].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    return base.length > 0 ? base.map((_, index) => base[(index + randomIndex) % base.length]) : [];
  }, [catalogWithProgress, randomIndex]);

  const optionTabs = useMemo(
    () => [
      {
        key: "hot",
        label: "推荐热门",
        icon: Flame,
        heading: "推荐热门",
        note: "按热度、完成度和赛博朋克浓度筛出当前主推内容。",
        items: hotItems,
      },
      {
        key: "random",
        label: "随机推荐",
        icon: Shuffle,
        heading: "随机推荐",
        note: "从资料库里随机抽一部，只保留本次推荐。",
        items: randomItems.length > 0 ? randomItems : hotItems,
      },
      {
        key: "history",
        label: "我的",
        icon: Clock3,
        heading: "我的",
        note: "历史记录、追番和个人观看状态都放在这里。",
        items: historyCatalog,
      },
    ],
    [historyCatalog, hotItems, randomItems]
  );

  const selectedChannel = optionTabs.find((tab) => tab.key === route);
  const heroItem = catalogWithProgress[0] ?? normalizeCatalog(fallbackCatalog)[0];
  const randomPick = (randomItems.length > 0 ? randomItems[0] : hotItems[0]) ?? heroItem;
  const featuredItems = hotItems.slice(0, 12);
  const focusedItem = catalogWithProgress.find((item) => item.id === routeParams.id) ?? heroItem;
  const relatedItems = catalogWithProgress
    .filter((item) => item.id !== focusedItem.id)
    .sort((a, b) => {
      const typeMatch = Number(b.type === focusedItem.type) - Number(a.type === focusedItem.type);
      if (typeMatch) return typeMatch;
      return b.match - a.match;
    })
    .slice(0, 12);

  function handleSearch(query) {
    const nextQuery = query.trim();
    setSearchQuery(nextQuery);
    window.location.hash = nextQuery ? `search?q=${encodeURIComponent(nextQuery)}` : "search";
  }

  function openDetail(item) {
    window.location.hash = `detail?id=${encodeURIComponent(item.id)}`;
  }

  function startWatching(item, episode = 1) {
    if (historyClearedAt) {
      setHistoryClearedAt(0);
      writeStorage(historyClearedKey, 0);
    }
    const nextHistory = [
      { id: item.id, playedAt: Date.now() },
      ...historyItems.filter((entry) => entry.id !== item.id),
    ].slice(0, 30);
    setHistoryItems(nextHistory);
    writeStorage(historyKey, nextHistory);
    window.location.hash = `watch?id=${encodeURIComponent(item.id)}&episode=${episode}`;
  }

  function handleProgress(itemId, progress, currentTime) {
    const nextProgress = {
      ...progressMap,
      [itemId]: {
        progress,
        currentTime,
        updatedAt: Date.now(),
      },
    };
    setProgressMap(nextProgress);
    writeStorage(progressKey, nextProgress);
  }

  function updatePlaybackSources(nextSources) {
    setPlaybackSources(nextSources);
    writeStorage(playbackSourcesKey, nextSources);
  }

  function toggleFollowing(item) {
    const nextIds = followingIds.includes(item.id)
      ? followingIds.filter((id) => id !== item.id)
      : [item.id, ...followingIds].slice(0, 80);
    setFollowingIds(nextIds);
    writeStorage(followingKey, nextIds);
  }

  function clearHistory() {
    const clearedAt = Date.now();
    setHistoryItems([]);
    setHistoryClearedAt(clearedAt);
    writeStorage(historyKey, []);
    writeStorage(historyClearedKey, clearedAt);
  }

  return (
    <main className={`site site-${route}`}>
      <TopNav route={route} searchQuery={searchQuery} onSearch={handleSearch} />

      {route === "watch" ? (
        <WatchPage
          episode={Number(routeParams.episode || 1)}
          item={focusedItem}
          onOpenDetail={openDetail}
          onProgress={handleProgress}
          onStartWatch={startWatching}
          onToggleFollowing={toggleFollowing}
          playbackSources={playbackSources}
          relatedItems={relatedItems}
        />
      ) : route === "detail" ? (
        <DetailPage
          item={focusedItem}
          onOpenDetail={openDetail}
          onStartWatch={startWatching}
          onToggleFollowing={toggleFollowing}
          playbackSources={playbackSources}
          relatedItems={relatedItems}
        />
      ) : route === "search" ? (
        <SearchPage catalog={catalogWithProgress} query={searchQuery} onPlay={openDetail} onSearch={handleSearch} />
      ) : route === "library" ? (
        <LibraryPage catalog={catalogWithProgress} filters={routeParams} onPlay={openDetail} />
      ) : route === "sources" ? (
        <SourcePage playbackSources={playbackSources} onUpdate={updatePlaybackSources} />
      ) : selectedChannel ? (
        <ChannelPage
          followedItems={followedItems}
          onClearHistory={clearHistory}
          randomPick={randomPick}
          tab={selectedChannel}
          onPlay={openDetail}
          onShuffle={() => setRandomIndex((index) => index + 1)}
        />
      ) : (
        <HomePage
          catalog={catalogWithProgress}
          featuredItems={featuredItems}
          heroItem={heroItem}
          optionTabs={optionTabs}
          onOpenDetail={openDetail}
          onStartWatch={startWatching}
        />
      )}

      {!["random", "detail", "watch", "sources"].includes(route) && (
        <NetdiskDock open={netdiskOpen} onToggle={() => setNetdiskOpen((value) => !value)} />
      )}

      {!["random", "detail", "watch", "sources"].includes(route) && (
        <button className="hiddenRadioTrigger" onClick={() => setRadioOpen(true)} type="button">
          播放器
        </button>
      )}

      {radioOpen && <CyberRadioPlayer onClose={() => setRadioOpen(false)} />}
    </main>
  );
}

function TopNav({ route, searchQuery, onSearch }) {
  const [draft, setDraft] = useState(searchQuery);
  const links = [
    { key: "home", label: "首页", href: "#home" },
    { key: "library", label: "视频分类", href: "#library" },
    { key: "sources", label: "播放源", href: "#sources" },
    { key: "hot", label: "推荐热门", href: "#hot" },
    { key: "random", label: "随机推荐", href: "#random" },
    { key: "history", label: "我的", href: "#history" },
  ];

  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

  function handleSubmit(event) {
    event.preventDefault();
    onSearch(draft);
  }

  return (
    <nav className="topNav" aria-label="主导航">
      <a className="brand" href="#home" aria-label="NEON FRAME 首页">
        <span>NF</span>
        NEON FRAME
      </a>
      <div className="navLinks">
        {links.map((link) => (
          <a className={route === link.key ? "active" : ""} href={link.href} key={link.key}>
            {link.label}
          </a>
        ))}
      </div>
      <div className="navTools">
        <form className="globalSearch" onSubmit={handleSubmit} role="search">
          <input
            aria-label="搜索视频"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="搜索你感兴趣的视频"
            value={draft}
          />
          <button aria-label="提交搜索" type="submit">
            <Search size={20} />
          </button>
        </form>
      </div>
    </nav>
  );
}

function SearchPage({ catalog, query, onPlay, onSearch }) {
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const results = useMemo(() => {
    const ranked = catalog
      .map((item) => ({ item, score: matchSearchItem(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
    return query.trim() ? ranked : [...catalog].sort((a, b) => b.match - a.match).slice(0, 12);
  }, [catalog, query]);

  function handleSubmit(event) {
    event.preventDefault();
    onSearch(draft);
  }

  return (
    <section className="searchPage">
      <header className="searchHero">
        <p className="eyebrow">SEARCH</p>
        <h1>搜索片库</h1>
        <form className="searchHeroForm" onSubmit={handleSubmit} role="search">
          <Search size={23} />
          <input
            aria-label="搜索片库"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入标题、类型、年份、季度或标签"
            value={draft}
          />
          <button type="submit">搜索</button>
        </form>
        <div className="searchSuggestionBar" aria-label="搜索建议">
          {["赛博朋克", "2026", "科幻机甲", "播放源", "一月新番"].map((keyword) => (
            <button key={keyword} onClick={() => onSearch(keyword)} type="button">
              {keyword}
            </button>
          ))}
        </div>
      </header>

      <div className="searchResultsHeader">
        <h2>{query.trim() ? `“${query}” 的搜索结果` : "热门搜索推荐"}</h2>
        <span>{results.length} 部</span>
      </div>

      {results.length > 0 ? (
        <div className="searchResultGrid">
          {results.map((item) => (
            <LibraryCard item={item} key={`search-${item.id}`} onPlay={onPlay} />
          ))}
        </div>
      ) : (
        <EmptyState title="没有找到匹配资源" text="换个标题、类型、年份或季度关键词再试一次。" />
      )}
    </section>
  );
}

function HomePage({ catalog, featuredItems, heroItem, optionTabs, onOpenDetail, onStartWatch }) {
  const heroItems = useMemo(() => {
    const candidates = featuredItems.length > 0 ? featuredItems : catalog;
    return candidates.length > 0 ? candidates.slice(0, 5) : [heroItem];
  }, [catalog, featuredItems, heroItem]);
  const [heroIndex, setHeroIndex] = useState(0);
  const activeHero = heroItems[heroIndex % heroItems.length] ?? heroItem;

  useEffect(() => {
    if (heroItems.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((index) => (index + 1) % heroItems.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [heroItems.length]);

  return (
    <>
      <section className="hero" id="home">
        <div className="heroMedia" aria-hidden="true">
          {heroItems.map((item, index) => (
            <img
              className={`heroImage ${index === heroIndex % heroItems.length ? "active" : ""}`}
              key={`hero-${item.id}`}
              src={item.image}
              alt=""
            />
          ))}
          <div className="heroShade" />
        </div>

        <div className="heroInner">
          <div className="seriesMark">
            <span>番剧</span>
            <strong>{activeHero.type}</strong>
          </div>
          <button className="heroTitleButton" onClick={() => onOpenDetail(activeHero)} type="button">
            <h1>{activeHero.title}</h1>
          </button>
          <div className="heroMeta">
            <span>{activeHero.year}</span>
            <span>{activeHero.season}</span>
            <span>{activeHero.rating}</span>
            <span>{activeHero.duration}</span>
          </div>
          <p className="heroLead">{activeHero.description}</p>
          <div className="heroActions">
            <button className="playButton" onClick={() => onStartWatch(activeHero, 1)} type="button">
              <Play size={21} fill="currentColor" />
              <span>立即播放</span>
            </button>
            <button className="infoButton" onClick={() => onOpenDetail(activeHero)} type="button">
              <Info size={21} />
              <span>查看详情</span>
            </button>
          </div>
          <div className="heroIndicators" aria-label="首页轮播资源">
            {heroItems.map((item, index) => (
              <button
                aria-label={`切换到 ${item.title}`}
                className={index === heroIndex % heroItems.length ? "active" : ""}
                key={`hero-dot-${item.id}`}
                onClick={() => setHeroIndex(index)}
                type="button"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="homeSwitchboard" aria-label="主页观看入口">
        <div className="sectionLead">
          <p className="eyebrow">WATCH MODE</p>
          <h2>选择今天进入哪一个页面。</h2>
        </div>
        <div className="channelCards">
          {optionTabs.map(({ key, label, icon: Icon, note, items }) => (
            <a className="channelCard" href={`#${key}`} key={key}>
              <Icon size={22} />
              <span>{label}</span>
              <strong>{items.length} 部</strong>
              <p>{note}</p>
            </a>
          ))}
        </div>
      </section>

      <CategoryGateway catalog={catalog} />

      <HistoryShortcut />

      <section className="contentRows" id="featured">
        <section className="railSection">
          <div className="railHeading">
            <h2>番剧推荐</h2>
            <a href="#hot">
              查看全部
              <ChevronRight size={18} />
            </a>
          </div>
          <div className="episodeGridList featuredEpisodeGrid">
            {featuredItems.map((item, index) => (
              <EpisodeCard item={item} index={index} key={`featured-${item.id}`} onPlay={onOpenDetail} />
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

function DetailPage({ item, onOpenDetail, onStartWatch, onToggleFollowing, playbackSources, relatedItems }) {
  const episodes =
    item.episodeSources.length > 0
      ? item.episodeSources
      : Array.from({ length: item.episodes || 10 }, (_, index) => ({ number: index + 1 }));
  const hasExternalOnly = item.externalUrl && !item.video;
  const usableSources = getUsablePlaybackSources(playbackSources, item, episodes[0], item.video || item.externalUrl);

  return (
    <section className="detailPage">
      <div className="detailBackdrop" aria-hidden="true">
        <img src={item.image} alt="" />
      </div>
      <div className="detailHero">
        <button className="detailPoster" onClick={() => onStartWatch(item, 1)} type="button">
          <img src={item.image} alt="" />
          <span>
            <Play size={22} fill="currentColor" />
          </span>
        </button>
        <div className="detailInfo">
          <h1>{item.title}</h1>
          <div className="detailBadges">
            <span>更新至{item.episodes || 10}</span>
            <span>{item.year}</span>
            <span>{item.type}</span>
          </div>
          <p>
            <strong>导演：</strong>
            NEON FRAME
          </p>
          <p>
            <strong>演员：</strong>
            {item.tags.length > 0 ? item.tags.join(" / ") : `${item.subtitle} / ${item.category}`}
          </p>
          <p>
            <strong>类型：</strong>
            {item.type} / {item.season} / {item.category}
          </p>
          <div className="detailActions">
            <button className="playButton" onClick={() => onStartWatch(item, 1)} type="button">
              <Play size={18} fill="currentColor" />
              <span>播放</span>
            </button>
            {hasExternalOnly && (
              <a className="sourceButton" href={item.externalUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={17} />
                <span>打开来源</span>
              </a>
            )}
            {item.moegirlUrl && (
              <a className="sourceButton" href={item.moegirlUrl} rel="noreferrer" target="_blank">
                <BookOpen size={17} />
                <span>萌娘百科</span>
              </a>
            )}
            <button
              className={`infoButton ${item.isFollowing ? "activeFollow" : ""}`}
              onClick={() => onToggleFollowing(item)}
              type="button"
            >
              {item.isFollowing ? "已追番" : "+ 追番"}
            </button>
          </div>
        </div>
      </div>

      <section className="detailSynopsis">
        <span>简介</span>
        <p>{item.description}</p>
        <button type="button">⌄ 展开</button>
      </section>

      <section className="episodeSection">
        <div className="detailSectionHeading">
          <h2>资源列表</h2>
          <button type="button">排序</button>
        </div>
        <div className="sourceTabs">
          {usableSources.length > 0 ? (
            usableSources.slice(0, 4).map((source, index) => (
              <button className={index === 0 ? "active" : ""} key={`detail-source-${source.id}`} type="button">
                {source.name}
                <span>{episodes.length}</span>
              </button>
            ))
          ) : (
            <a href="#sources">添加播放源</a>
          )}
        </div>
        <div className="episodeGrid">
          {episodes.map((episode) => (
            <button key={episode.number} onClick={() => onStartWatch(item, episode.number)} type="button">
              <span>第{String(episode.number).padStart(2, "0")}集</span>
              {episode.title && <em>{episode.title}</em>}
            </button>
          ))}
        </div>
      </section>

      <RelatedGrid items={relatedItems} onOpenDetail={onOpenDetail} title="相关影片" />
    </section>
  );
}

function WatchPage({
  episode,
  item,
  onOpenDetail,
  onProgress,
  onStartWatch,
  onToggleFollowing,
  playbackSources,
  relatedItems,
}) {
  const [needsGesture, setNeedsGesture] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceStatus, setSourceStatus] = useState("loading");
  const [playerTime, setPlayerTime] = useState({ currentTime: 0, duration: 0 });
  const [activeSourceId, setActiveSourceId] = useState("");
  const videoRef = useRef(null);
  const episodes =
    item.episodeSources.length > 0
      ? item.episodeSources
      : Array.from({ length: item.episodes || 10 }, (_, index) => ({ number: index + 1 }));
  const activeEpisode = episodes.find((source) => source.number === episode) || episodes[0];
  const activeVideo = activeEpisode?.video || item.video;
  const activeExternalUrl = activeEpisode?.externalUrl || item.externalUrl || activeVideo;
  const playbackOptions = useMemo(
    () => getUsablePlaybackSources(playbackSources, item, activeEpisode, activeExternalUrl),
    [activeEpisode, activeExternalUrl, item, playbackSources]
  );
  const sourceSignature = playbackOptions.map((source) => `${source.id}:${source.url}:${source.mode}`).join("|");
  const activeGeneratedSource =
    playbackOptions.find((source) => source.id === activeSourceId) || playbackOptions[0] || null;
  const directSource = activeVideo || (activeGeneratedSource?.mode === "direct" ? activeGeneratedSource.url : "");
  const iframeSource =
    !activeVideo && activeGeneratedSource?.mode !== "direct"
      ? activeGeneratedSource?.url || ""
      : "";

  useEffect(() => {
    setActiveSourceId(playbackOptions[0]?.id || "");
  }, [episode, item.id, sourceSignature]);

  useEffect(() => {
    setSourceError("");
    setSourceStatus(directSource ? "loading" : iframeSource ? "source" : "empty");
    setPlayerTime({ currentTime: 0, duration: 0 });
    setNeedsGesture(false);
    const video = videoRef.current;
    if (!video || !directSource) return undefined;

    function playVideo() {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          setNeedsGesture(true);
          setSourceStatus("gesture");
        });
      }
    }

    video.removeAttribute("src");
    video.load();
    video.src = directSource;
    playVideo();

    return () => {
      video.removeAttribute("src");
    };
  }, [directSource, iframeSource]);

  function handleManualPlay() {
    videoRef.current
      ?.play()
      .then(() => {
        setNeedsGesture(false);
        setSourceStatus("playing");
      })
      .catch(() => {
        setNeedsGesture(true);
        setSourceStatus("gesture");
      });
  }

  function handleTimeUpdate(event) {
    const video = event.currentTarget;
    setPlayerTime({
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    });
    if (!video.duration || Number.isNaN(video.duration)) return;
    const progress = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
    onProgress(item.id, progress, Math.round(video.currentTime));
  }

  function handleSourceError(event) {
    const code = event.currentTarget.error?.code;
    const message =
      code === 4
        ? "浏览器无法解码当前视频。"
        : code === 3
          ? "视频流中断，正在等待重新加载。"
          : code === 2
            ? "视频源网络不可达。"
            : "当前视频源暂时无法播放。";
    setSourceError(message);
    setSourceStatus("error");
  }

  const statusText =
    {
      buffering: "缓冲",
      empty: "等待资源",
      error: "源异常",
      gesture: "等待点击",
      loading: "加载中",
      paused: "暂停",
      playing: "播放中",
      ready: "可播放",
      source: "播放源",
    }[sourceStatus] || "加载中";

  return (
    <section className="watchPage">
      <div className="watchMain">
        <div className="watchNotice">
          <span>提示</span>
          <strong>正在播放第 {String(episode).padStart(2, "0")} 集</strong>
          <button onClick={() => onOpenDetail(item)} type="button">
            ×
          </button>
        </div>
        <div className="watchCanvas">
          {directSource ? (
            <video
              autoPlay
              className="watchVideo"
              controls
              key={directSource}
              muted
              playsInline
              poster={item.image}
              ref={videoRef}
              onCanPlay={() => setSourceStatus("ready")}
              onError={handleSourceError}
              onLoadedMetadata={handleTimeUpdate}
              onPause={() => setSourceStatus("paused")}
              onPlay={() => {
                setNeedsGesture(false);
                setSourceStatus("playing");
              }}
              onPlaying={() => setSourceStatus("playing")}
              onStalled={() => setSourceStatus("buffering")}
              onTimeUpdate={handleTimeUpdate}
              onWaiting={() => setSourceStatus("buffering")}
            />
          ) : iframeSource ? (
            <iframe
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="watchIframe"
              key={iframeSource}
              src={iframeSource}
              title={`${item.title} ${activeGeneratedSource?.name || "播放源"}`}
            />
          ) : (
            <div className="watchFallback">
              <img src={item.image} alt="" />
              <div>
                <span>等待可播放资源</span>
                {activeExternalUrl ? (
                  <a className="watchSourceLink" href={activeExternalUrl} rel="noreferrer" target="_blank">
                    <ExternalLink size={18} />
                    打开来源
                  </a>
                ) : (
                  <a className="watchSourceLink" href="#sources">
                    <Plus size={18} />
                    添加播放源
                  </a>
                )}
              </div>
            </div>
          )}
          {needsGesture && (
            <button className="watchGesture" onClick={handleManualPlay} type="button">
              <Play size={42} fill="currentColor" />
            </button>
          )}
          {sourceError && (
            <div className="watchError">
              <span>{sourceError}</span>
              {activeExternalUrl && (
                <a href={activeExternalUrl} rel="noreferrer" target="_blank">
                  打开原始源
                </a>
              )}
            </div>
          )}
        </div>
        <div className="watchControlDock">
          <span>
            {formatPlayerTime(playerTime.currentTime)} / {formatPlayerTime(playerTime.duration)}
          </span>
          <span className={`sourceStatus status-${sourceStatus}`}>{statusText}</span>
          <div className="danmakuInput">
            <span>A</span>
            <input placeholder="发个弹幕见证当下" />
            <button type="button">发送</button>
          </div>
          {activeExternalUrl && (
            <a className="watchDockLink" href={activeExternalUrl} rel="noreferrer" target="_blank">
              原始源
            </a>
          )}
          <button type="button">倍速</button>
          <button type="button">全屏</button>
        </div>
      </div>

      <aside className="watchSidebar">
        <div className="watchTabs">
          <span className="active">视频</span>
          <span>讨论 13</span>
        </div>
        <h1>{item.title}</h1>
        <p>
          <span className="match">{item.match}%</span> · {item.year} · {item.type} · {item.season}
        </p>
        <div className="watchToolRow">
          <button className={item.isFollowing ? "activeFollow" : ""} onClick={() => onToggleFollowing(item)} type="button">
            {item.isFollowing ? "已追番" : "+ 追番"}
          </button>
          {item.moegirlUrl && (
            <a href={item.moegirlUrl} rel="noreferrer" target="_blank">
              萌娘百科
            </a>
          )}
          <button type="button">分享</button>
          <button type="button">小技巧</button>
        </div>
        <section className="watchEpisodes">
          <div>
            <h2>资源列表</h2>
            <span>排序</span>
          </div>
          <div className="sourceTabs compact">
            {playbackOptions.length > 0 ? (
              playbackOptions.map((source) => (
                <button
                  className={source.id === activeGeneratedSource?.id ? "active" : ""}
                  key={`watch-source-${source.id}`}
                  onClick={() => setActiveSourceId(source.id)}
                  type="button"
                >
                  {source.name}
                  <span>{source.mode === "direct" ? "直链" : "API"}</span>
                </button>
              ))
            ) : (
              <a href="#sources">添加播放源</a>
            )}
          </div>
          <div className="watchEpisodeGrid">
            {episodes.map((source) => (
              <button
                className={source.number === episode ? "active" : ""}
                key={source.number}
                onClick={() => onStartWatch(item, source.number)}
                type="button"
              >
                <span>第{String(source.number).padStart(2, "0")}集</span>
                {source.title && <em>{source.title}</em>}
              </button>
            ))}
          </div>
        </section>
        <RelatedGrid compact items={relatedItems.slice(0, 6)} onOpenDetail={onOpenDetail} title="相关影视" />
      </aside>
    </section>
  );
}

function RelatedGrid({ compact = false, items, onOpenDetail, title }) {
  return (
    <section className={compact ? "relatedGrid compact" : "relatedGrid"}>
      <div className="detailSectionHeading">
        <h2>{title}</h2>
        <button type="button">更多</button>
      </div>
      <div className="relatedCards">
        {items.map((item) => (
          <button className="relatedCard" key={`related-${item.id}`} onClick={() => onOpenDetail(item)} type="button">
            <img src={item.image} alt="" />
            <span>{item.type}</span>
            <strong>{item.title}</strong>
            <em>{item.description}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function CategoryGateway({ catalog }) {
  const stats = [allFilter, ...animeTypes].map((type) => ({
    type,
    count: type === allFilter ? catalog.length : catalog.filter((item) => item.type === type).length,
  }));

  return (
    <section className="categoryGateway" id="categories">
      <div className="railHeading">
        <div>
          <p className="eyebrow">GENRE INDEX</p>
          <h2>视频分类</h2>
        </div>
        <a href="#library">
          查看全部
          <ChevronRight size={18} />
        </a>
      </div>
      <div className="typePreviewGrid" aria-label="视频分类列表">
        {stats.map((item, index) => (
          <a
            className="typePreviewCard"
            href={`#library?type=${encodeLibraryFilter(item.type)}`}
            key={item.type}
          >
            <span>{index === 0 ? "ALL" : String(index).padStart(2, "0")}</span>
            <strong>{item.type}</strong>
            <em>{item.count} 部资源</em>
          </a>
        ))}
      </div>
    </section>
  );
}

function HistoryShortcut() {
  return (
    <section className="historyShortcut">
      <a href="#history">
        <Clock3 size={22} />
        <span>我的</span>
        <strong>历史记录和追番都在这里</strong>
        <ChevronRight size={22} />
      </a>
    </section>
  );
}

function ChannelPage({ tab, followedItems, randomPick, onClearHistory, onPlay, onShuffle }) {
  if (tab.key === "random") {
    return (
      <section className="randomPage">
        <article className="randomSpotlight randomSolo">
          <img src={randomPick.image} alt="" />
          <div>
            <p className="eyebrow">RANDOM PICK</p>
            <h1>{randomPick.title}</h1>
            <span>
              {randomPick.type} · {randomPick.year} · {randomPick.season}
            </span>
            <p>{randomPick.description}</p>
            <div className="randomActions">
              <button className="miniPlay" onClick={() => onPlay(randomPick)} type="button">
                <Play size={16} fill="currentColor" />
                <span>播放推荐</span>
              </button>
              <button className="shuffleButton" onClick={onShuffle} type="button">
                <Shuffle size={18} />
                <span>换一部</span>
              </button>
            </div>
          </div>
        </article>
      </section>
    );
  }

  if (tab.key === "history") {
    return <HistoryPage followedItems={followedItems} items={tab.items} onClear={onClearHistory} onPlay={onPlay} />;
  }

  return (
    <section className="channelPage">
      <header className="channelHero">
        <p className="eyebrow">BROWSE PAGE</p>
        <h1>{tab.heading}</h1>
        <p>{tab.note}</p>
      </header>

      {tab.items.length > 0 ? (
        <div className="episodeGridList">
          {tab.items.map((item, index) => (
            <EpisodeCard item={item} index={index} key={`${tab.key}-${item.id}`} onPlay={onPlay} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="还没有内容"
          text="导入资源或调整筛选后，这里会显示匹配内容。"
        />
      )}
    </section>
  );
}

function HistoryPage({ followedItems, items, onClear, onPlay }) {
  const [activePanel, setActivePanel] = useState("history");
  const [historyQuery, setHistoryQuery] = useState("");
  const tabs = [
    { key: "history", label: "历史" },
    { key: "following", label: "追番" },
    { key: "offline", label: "离线缓存" },
    { key: "later", label: "稍后再看" },
  ];
  const filteredItems = useMemo(() => {
    const sourceItems = activePanel === "following" ? followedItems : items;
    if (!["history", "following"].includes(activePanel)) return [];
    return sourceItems.filter((item) => matchSearchItem(item, historyQuery) > 0);
  }, [activePanel, followedItems, historyQuery, items]);

  function handleHistorySearchSubmit(event) {
    event.preventDefault();
  }

  return (
    <section className="historyPage">
      <div className="historyTop">
        <div className="historyTabs" aria-label="我的分类">
          {tabs.map((tab) => (
            <button
              className={activePanel === tab.key ? "active" : ""}
              key={tab.key}
              onClick={() => setActivePanel(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form className="historySearch" onSubmit={handleHistorySearchSubmit} role="search">
          <input
            aria-label="搜索我的"
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="搜索我的"
            value={historyQuery}
          />
          <Search size={20} />
        </form>
      </div>

      <div className="historyActions">
        <span>{activePanel === "following" ? "我的追番" : "今天"}</span>
        {activePanel === "history" && (
          <button onClick={onClear} type="button">
            <Trash2 size={18} />
            清空历史
          </button>
        )}
      </div>

      {activePanel !== "history" ? (
        <EmptyState title={`${tabs.find((tab) => tab.key === activePanel)?.label} 暂无内容`} text="这个入口已经预留，后续可以接入真实缓存、收藏和稍后再看数据。" />
      ) : filteredItems.length > 0 ? (
        <div className="historyGrid">
          {filteredItems.map((item) => (
            <HistoryVideoCard item={item} key={`history-${item.id}`} onPlay={onPlay} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={activePanel === "following" ? "还没有追番" : "还没有历史"}
          text={activePanel === "following" ? "在番剧详情页点击追番后，这里会显示你的追番列表。" : "播放任意动画后，这里会自动记录你的观看历史。"}
        />
      )}
    </section>
  );
}

function HistoryVideoCard({ item, onPlay }) {
  return (
    <article className="historyVideoCard">
      <button className="historyThumb" onClick={() => onPlay(item)} type="button">
        <img src={item.image} alt="" />
        <span className="historyTime">
          <span>{formatHistoryTime(item.playedAt)}</span>
          <strong>
            {item.progress > 0 ? `${String(Math.max(0, Math.round(item.progress))).padStart(2, "0")}%` : "00:00"}
            /{item.duration}
          </strong>
        </span>
        <span className="historyProgress" style={{ width: `${Math.max(2, item.progress)}%` }} />
      </button>
      <div className="historyVideoMeta">
        <div>
          <h3>{item.title}</h3>
          <p>
            <span>UP</span>
            {item.subtitle}
          </p>
        </div>
        <button aria-label={`${item.title} 更多操作`} type="button">
          <MoreVertical size={19} />
        </button>
      </div>
    </article>
  );
}

function LibraryPage({ catalog, filters, onPlay }) {
  const typeOptions = [allFilter, ...animeTypes];
  const yearOptions = [allFilter, ...animeYears];
  const seasonOptions = [allFilter, ...animeSeasons.map((season) => season.label)];
  const getSafeType = (value) => (typeOptions.includes(value) ? value : allFilter);
  const getSafeYear = (value) => (yearOptions.includes(value) ? value : allFilter);
  const getSafeSeason = (value) => (seasonOptions.includes(value) ? value : allFilter);
  const [activeType, setActiveType] = useState(() => getSafeType(filters.type));
  const [activeYear, setActiveYear] = useState(() => getSafeYear(filters.year));
  const [activeSeason, setActiveSeason] = useState(() => getSafeSeason(filters.season));

  useEffect(() => {
    setActiveType(getSafeType(filters.type));
    setActiveYear(getSafeYear(filters.year));
    setActiveSeason(getSafeSeason(filters.season));
  }, [filters.season, filters.type, filters.year]);

  function updateFilters(nextType = activeType, nextYear = activeYear, nextSeason = activeSeason) {
    const params = new URLSearchParams();
    if (nextType && nextType !== allFilter) params.set("type", nextType);
    if (nextYear && nextYear !== allFilter) params.set("year", nextYear);
    if (nextSeason && nextSeason !== allFilter) params.set("season", nextSeason);
    const query = params.toString();
    window.location.hash = query ? `library?${query}` : "library";
  }

  const filteredItems = catalog
    .filter((item) => activeType === allFilter || item.type === activeType)
    .filter((item) => activeYear === allFilter || item.libraryYear === activeYear)
    .filter((item) => activeSeason === allFilter || item.season === activeSeason)
    .sort((a, b) => {
      const yearDiff = Number(b.libraryYear) - Number(a.libraryYear);
      if (yearDiff) return yearDiff;
      const seasonDiff =
        animeSeasons.findIndex((season) => season.label === a.season) -
        animeSeasons.findIndex((season) => season.label === b.season);
      if (seasonDiff) return seasonDiff;
      return b.match - a.match;
    });

  return (
    <section className="libraryPage">
      <header className="libraryHeader">
        <div>
          <p className="eyebrow">FULL LIBRARY</p>
          <h1>全部动画资源</h1>
          <p>按视频分类、年份和季度新番筛选，时间范围覆盖 2000 年到 2026 年。</p>
        </div>
        <a className="infoButton" href="#home">
          回到首页
        </a>
      </header>

      <nav className="typeNavigation" aria-label="视频分类导航栏">
        {typeOptions.map((type) => (
          <button
            className={activeType === type ? "active" : ""}
            key={type}
            onClick={() => updateFilters(type, activeYear, activeSeason)}
            type="button"
          >
            <span>{type}</span>
            <em>{type === allFilter ? catalog.length : catalog.filter((item) => item.type === type).length}</em>
          </button>
        ))}
      </nav>

      <nav className="yearNavigation" aria-label="年份导航栏">
        {yearOptions.map((year) => (
          <button
            className={activeYear === year ? "active" : ""}
            key={year}
            onClick={() => updateFilters(activeType, year, activeSeason)}
            type="button"
          >
            {year}
          </button>
        ))}
      </nav>

      <nav className="seasonNavigation" aria-label="季度新番导航栏">
        {seasonOptions.map((season) => (
          <button
            className={activeSeason === season ? "active" : ""}
            key={season}
            onClick={() => updateFilters(activeType, activeYear, season)}
            type="button"
          >
            {season}
          </button>
        ))}
      </nav>

      <div className="librarySummary">
        <strong>{activeType}</strong>
        <span>{activeYear === allFilter ? "全部年份" : `${activeYear} 年`}</span>
        <span>{activeSeason}</span>
        <span>{filteredItems.length} 部资源</span>
      </div>

      {filteredItems.length > 0 ? (
        <div className="episodeGridList libraryEpisodeGrid">
          {filteredItems.map((item, index) => (
            <EpisodeCard item={item} index={index} key={`library-${item.id}`} onPlay={onPlay} />
          ))}
        </div>
      ) : (
        <div className="emptySeason">
          <span>等待导入</span>
          <p>挂载网盘或导入媒体后，这个筛选组合会自动填入匹配资源。</p>
        </div>
      )}
    </section>
  );
}

function SourcePage({ playbackSources, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ mode: "iframe", name: "", template: "" });
  const normalSources = playbackSources.filter((source) => source.group === "normal");
  const customSources = playbackSources.filter((source) => source.group === "custom");
  const selectedCount = playbackSources.filter((source) => source.enabled).length;

  function patchSource(id, patch) {
    onUpdate(playbackSources.map((source) => (source.id === id ? { ...source, ...patch } : source)));
  }

  function selectAll() {
    onUpdate(playbackSources.map((source) => ({ ...source, enabled: true })));
  }

  function selectNone() {
    onUpdate(playbackSources.map((source) => ({ ...source, enabled: false })));
  }

  function selectNormal() {
    onUpdate(playbackSources.map((source) => ({ ...source, enabled: source.group === "normal" })));
  }

  function removeCustom(id) {
    onUpdate(playbackSources.filter((source) => source.id !== id));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const name = draft.name.trim();
    const template = draft.template.trim();
    if (!name || !template) return;

    onUpdate([
      ...playbackSources,
      {
        id: `custom-${Date.now()}`,
        custom: true,
        enabled: true,
        group: "custom",
        mode: draft.mode,
        name,
        template,
      },
    ]);
    setDraft({ mode: "iframe", name: "", template: "" });
    setAdding(false);
  }

  return (
    <section className="sourcePage">
      <header className="sourceHeader">
        <p className="eyebrow">SOURCE CENTER</p>
        <h1>播放源</h1>
      </header>

      <div className="sourceLayout">
        <section className="sourcePanel">
          <h2>数据源设置</h2>
          <div className="sourceActions">
            <button onClick={selectAll} type="button">全选</button>
            <button onClick={selectNone} type="button">全不选</button>
            <button onClick={selectNormal} type="button">全选普通资源</button>
          </div>
          <div className="sourceScroll">
            <h3>普通资源</h3>
            <div className="sourceCheckGrid">
              {normalSources.map((source) => (
                <label className="sourceCheck" key={source.id}>
                  <input
                    checked={source.enabled}
                    onChange={(event) => patchSource(source.id, { enabled: event.target.checked })}
                    type="checkbox"
                  />
                  <span>{source.name}</span>
                </label>
              ))}
            </div>
          </div>
          <p className="sourceCount">已选API数量：{selectedCount}</p>
        </section>

        <section className="sourcePanel customSourcePanel">
          <div className="customSourceHead">
            <h2>自定义API</h2>
            <button aria-label="添加自定义API" onClick={() => setAdding((value) => !value)} type="button">
              {adding ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>

          {customSources.length > 0 ? (
            <div className="customSourceList">
              {customSources.map((source) => (
                <article className="customSourceItem" key={source.id}>
                  <label>
                    <input
                      checked={source.enabled}
                      onChange={(event) => patchSource(source.id, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                    <span>{source.name}</span>
                  </label>
                  <em>{source.mode === "direct" ? "直链" : "API"}</em>
                  <button aria-label={`删除 ${source.name}`} onClick={() => removeCustom(source.id)} type="button">
                    <X size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="emptyCustomSource">未添加自定义API</div>
          )}

          {adding && (
            <form className="customSourceForm" onSubmit={handleSubmit}>
              <input
                aria-label="播放源名称"
                onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
                placeholder="播放源名称"
                value={draft.name}
              />
              <input
                aria-label="API地址模板"
                onChange={(event) => setDraft((value) => ({ ...value, template: event.target.value }))}
                placeholder="https://example.com/player?title={encodedTitle}&ep={episode}"
                value={draft.template}
              />
              <select
                aria-label="播放源类型"
                onChange={(event) => setDraft((value) => ({ ...value, mode: event.target.value }))}
                value={draft.mode}
              >
                <option value="iframe">API 页面</option>
                <option value="direct">直链视频</option>
              </select>
              <button type="submit">保存</button>
            </form>
          )}
        </section>
      </div>
    </section>
  );
}

function NetdiskDock({ open, onToggle }) {
  return (
    <section className={`netdiskDock ${open ? "open" : ""}`}>
      <button className="netdiskToggle" onClick={onToggle} type="button">
        <Import size={17} />
        <span>网盘挂载</span>
      </button>

      {open && (
        <div className="netdiskImport" id="netdisk">
          <div className="netdiskHeader">
            <p className="eyebrow">NETDISK IMPORT</p>
            <h2>挂载网盘，自动整理动画资料。</h2>
            <p>
              将夸克网盘同步到本地目录后可自动扫描视频，并按文件夹整理成番剧与剧集。
            </p>
          </div>

          <div className="importConsole">
            <div className="importTerminal">
              <span>本地挂载</span>
              <code>npm run import:local-openlist -- --source "/Users/kiwei/Downloads/OpenList/动漫"</code>
              <small>默认只写入播放清单，不复制大视频；所有本地视频由本地播放服务按需输出。</small>
            </div>
            <div className="importSteps" aria-label="网盘导入流程">
              <article>
                <Import size={20} />
                <strong>挂载目录</strong>
                <span>支持夸克同步目录、外接盘、NAS 或任意本地网盘挂载路径。</span>
              </article>
              <article>
                <Search size={20} />
                <strong>文件识别</strong>
                <span>根据文件夹、文件名、年份和季度信息整理标题、类型和剧集。</span>
              </article>
              <article>
                <Sparkles size={20} />
                <strong>生成封面</strong>
                <span>优先使用同名图片，没有封面时自动从视频抽帧。</span>
              </article>
              <article>
                <Play size={20} fill="currentColor" />
                <strong>站内播放</strong>
                <span>视频文件保留在 OpenList 目录，网站通过本地接口读取并播放。</span>
              </article>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="emptyState">
      <Sparkles size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function EpisodeCard({ item, onPlay, index }) {
  const meta = getEpisodeCardMeta(item, index);

  return (
    <article className="episodeCard">
      <button className="episodeThumb" onClick={() => onPlay(item)} type="button">
        <img src={item.image} alt="" />
        <span className="episodeOverlay">
          <span>
            <Play size={15} fill="currentColor" />
            {meta.views}
          </span>
          <span>
            <MessageSquare size={15} />
            {meta.comments}
          </span>
          <strong>{meta.duration}</strong>
        </span>
      </button>
      <button className="episodeTitleButton" onClick={() => onPlay(item)} type="button">
        {item.title}
      </button>
      <p className="episodeByline">
        <span>UP</span>
        {meta.uploader} · {meta.date}
      </p>
    </article>
  );
}

function PosterCard({ item, onPlay }) {
  return (
    <article className="posterCard">
      <button className="cardHitArea" onClick={() => onPlay(item)} type="button">
        <img src={item.image} alt="" />
        <span className="posterBadge">{item.label || item.type}</span>
        <span className="episodeCount">{formatEpisodeCount(item)}</span>
      </button>
      <div className="posterMeta">
        <div>
          <strong>{item.title}</strong>
          <span>{item.subtitle || item.description}</span>
        </div>
      </div>
    </article>
  );
}

function WideCard({ item, onPlay }) {
  return (
    <article className="wideCard">
      <button className="cardHitArea" onClick={() => onPlay(item)} type="button">
        <img src={item.image} alt="" />
      </button>
      <div className="wideOverlay">
        <span className="cardLabel">{item.label}</span>
        <div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="cardFacts">
            <span>{item.match}% 匹配</span>
            <span>
              {item.type} · {item.year} · {item.season}
            </span>
          </div>
          <div className="progressTrack" aria-label={`${item.title} 观看进度 ${item.progress}%`}>
            <span style={{ width: `${item.progress}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}

function LibraryCard({ item, onPlay }) {
  return (
    <article className="libraryCard">
      <button className="libraryPoster" onClick={() => onPlay(item)} type="button">
        <img src={item.image} alt="" />
        <span>
          <Play size={18} fill="currentColor" />
        </span>
      </button>
      <div className="libraryCardBody">
        <span className="cardLabel">{item.type}</span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="cardFacts">
          <span>{item.match}% 匹配</span>
          <span>{item.year}</span>
          <span>{item.season}</span>
        </div>
      </div>
    </article>
  );
}

function PlayerModal({ item, onClose, onProgress }) {
  const [sourceError, setSourceError] = useState("");
  const [needsGesture, setNeedsGesture] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    setSourceError("");
    setNeedsGesture(false);
    const video = videoRef.current;
    if (!video || !item.video) return;

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        setNeedsGesture(true);
      });
    }
  }, [item]);

  function handleTimeUpdate(event) {
    const video = event.currentTarget;
    if (!video.duration || Number.isNaN(video.duration)) return;
    const progress = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
    onProgress(item.id, progress, Math.round(video.currentTime));
  }

  function handleManualPlay() {
    const video = videoRef.current;
    if (!video) return;
    video
      .play()
      .then(() => setNeedsGesture(false))
      .catch(() => setNeedsGesture(true));
  }

  return (
    <div className="playerOverlay" role="dialog" aria-modal="true" aria-label={`${item.title} 播放器`}>
      <div className="playerShell">
        <div className="playerTopbar">
          <div>
            <span>{item.type}</span>
            <strong>{item.title}</strong>
          </div>
          <button aria-label="关闭播放器" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        {item.video ? (
          <div className="videoFrame">
            <video
              className="mainPlayer"
              autoPlay
              controls
              muted
              playsInline
              poster={item.image}
              preload="auto"
              ref={videoRef}
              src={item.video}
              onError={() => setSourceError("当前视频地址无法直接播放。")}
              onPlay={() => setNeedsGesture(false)}
              onTimeUpdate={handleTimeUpdate}
            />
            {needsGesture && (
              <button className="gesturePlay" onClick={handleManualPlay} type="button">
                <Play size={28} fill="currentColor" />
                <span>点击播放</span>
              </button>
            )}
          </div>
        ) : (
          <div className="playerFallback">
            <h3>这个资源还没有可播放地址</h3>
            <p>把本地视频导入 manifest，或提供浏览器可直接访问的视频地址后即可播放。</p>
          </div>
        )}

        {sourceError && (
          <div className="playerError">
            <strong>{sourceError}</strong>
            <span>请换成 mp4 / webm / m3u8 直链，或先同步到本地媒体目录。</span>
          </div>
        )}

        <div className="playerDetails">
          <p>
            <span className="match">{item.match}% 匹配</span>
            <span>{item.year}</span>
            <span>{item.rating}</span>
            <span>{item.duration}</span>
            <span>{item.season}</span>
          </p>
          <p>{item.description}</p>
          {(item.sourceKind || item.playableMode || item.doubanUrl || item.externalUrl) && (
            <div className="sourceMeta">
              {item.sourceKind && <span>{item.sourceKind === "netdisk" ? "网盘导入" : item.sourceKind}</span>}
              {item.playableMode && <span>{item.playableMode}</span>}
              {(item.doubanUrl || item.externalUrl) && (
                <a href={item.doubanUrl || item.externalUrl} rel="noreferrer" target="_blank">
                  打开来源
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CyberRadioPlayer({ onClose }) {
  const [activeStation, setActiveStation] = useState(2);
  const [volume, setVolume] = useState(80);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const station = radioStations[activeStation];

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key.toLowerCase() === "c" || event.key === "Escape") onClose();
      if (event.key.toLowerCase() === "a") setVolume((value) => Math.max(0, value - 5));
      if (event.key.toLowerCase() === "d") setVolume((value) => Math.min(100, value + 5));
      if (event.key.toLowerCase() === "f") toggleRadio();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, playing, activeStation, volume]);

  useEffect(() => {
    if (audioRef.current?.master) {
      audioRef.current.master.gain.value = (volume / 100) * 0.16;
    }
  }, [volume]);

  useEffect(() => {
    if (playing) {
      stopRadio();
      startRadio();
    }

    return undefined;
  }, [activeStation]);

  useEffect(
    () => () => {
      stopRadio();
    },
    []
  );

  function startRadio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || station.frequency === "无") return;

    const context = new AudioContext();
    const master = context.createGain();
    const bass = context.createOscillator();
    const lead = context.createOscillator();
    const filter = context.createBiquadFilter();
    const tremolo = context.createOscillator();
    const tremoloGain = context.createGain();
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noise = context.createBufferSource();
    const noiseGain = context.createGain();

    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.18;
    }

    bass.type = "sawtooth";
    lead.type = "triangle";
    tremolo.type = "sine";
    bass.frequency.value = station.tone;
    lead.frequency.value = station.tone * 2.01;
    tremolo.frequency.value = 7.7;
    tremoloGain.gain.value = 0.045;
    filter.type = "lowpass";
    filter.frequency.value = 960;
    filter.Q.value = 6;
    noise.buffer = noiseBuffer;
    noise.loop = true;
    noiseGain.gain.value = 0.018;
    master.gain.value = (volume / 100) * 0.16;

    tremolo.connect(tremoloGain);
    tremoloGain.connect(master.gain);
    bass.connect(filter);
    lead.connect(filter);
    filter.connect(master);
    noise.connect(noiseGain);
    noiseGain.connect(master);
    master.connect(context.destination);

    bass.start();
    lead.start();
    tremolo.start();
    noise.start();

    audioRef.current = {
      context,
      master,
      nodes: [bass, lead, tremolo, noise],
    };
    setPlaying(true);
  }

  function stopRadio() {
    const audio = audioRef.current;
    if (!audio) {
      setPlaying(false);
      return;
    }

    audio.nodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    });
    audio.context.close();
    audioRef.current = null;
    setPlaying(false);
  }

  function toggleRadio() {
    if (playing) {
      stopRadio();
    } else {
      startRadio();
    }
  }

  return (
    <div className="cyberRadioOverlay" role="dialog" aria-modal="true" aria-label="电台端口">
      <div className="cyberRadioBloom" />
      <section className="cyberRadioPanel">
        <div className="radioHeader">
          <span>TRI_CLASS #0009</span>
          <strong>电台端口</strong>
        </div>

        <div className="radioGrid">
          <div className="radioCover" aria-hidden="true">
            <span>Pacific</span>
            <strong>Dreams</strong>
            <em>88.9</em>
          </div>

          <div className="radioInfo">
            <p>正在播放</p>
            <h2>{station.track}</h2>
            <div className="radioVolume">
              <span>音量</span>
              <button onClick={() => setVolume((value) => Math.max(0, value - 5))} type="button">
                A
              </button>
              <strong>{volume}%</strong>
              <button onClick={() => setVolume((value) => Math.min(100, value + 5))} type="button">
                D
              </button>
            </div>
            <div className="radioSignal">
              <span style={{ width: `${volume}%` }} />
            </div>
          </div>
        </div>

        <div className="stationList" aria-label="电台列表">
          {radioStations.map((item, index) => (
            <button
              className={index === activeStation ? "selected" : ""}
              key={`${item.frequency}-${item.name}`}
              onClick={() => setActiveStation(index)}
              type="button"
            >
              <span className="stationGlyph" />
              <strong>{item.frequency}</strong>
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        <div className="radioFooter">
          <button onClick={toggleRadio} type="button">
            <kbd>F</kbd>
            <span>{playing ? "暂停" : "播放"}</span>
            <Power size={16} />
          </button>
          <button onClick={onClose} type="button">
            <kbd>C</kbd>
            <span>关闭</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
