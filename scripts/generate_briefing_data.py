#!/usr/bin/env python3
"""Generate Pickast briefing data from OPML podcast subscriptions."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OPML = ROOT / "data" / "subscriptions.opml"
DEFAULT_OUTPUT = ROOT / "src" / "generatedData.ts"
DEFAULT_RANKING = ROOT / "src" / "ranking.json"
DEFAULT_FAVORITES = ROOT / "src" / "favorites.json"
DEFAULT_EXPLORE = ROOT / "src" / "explore.json"

WEEKDAYS_CN = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
WEEKDAYS_EN = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
TRIAGE_LABELS = ["📖值得精听", "🚶边走边听", "☕有空再听"]
RECENCY_WEIGHT = 0.45
VALUE_WEIGHT = 0.55
DEFAULT_DOMAIN = "生活"
DOMAIN_KEYWORDS = {
    "AI": [
        "ai",
        "人工智能",
        "大模型",
        "llm",
        "agent",
        "智能体",
        "chatgpt",
        "claude",
        "openai",
        "anthropic",
        "deepseek",
        "agi",
    ],
    "科技": [
        "科技",
        "芯片",
        "互联网",
        "软件",
        "编程",
        "程序员",
        "开发者",
        "产品经理",
        "代码",
        "计算机",
        "算力",
        "自动化",
        "平台",
        "应用",
    ],
    "商业": [
        "商业",
        "创业",
        "公司",
        "品牌",
        "组织",
        "增长",
        "管理",
        "出海",
        "企业",
        "市场",
        "消费",
        "战略",
        "财阀",
        "案例",
    ],
    "财经": [
        "投资",
        "股市",
        "宏观",
        "理财",
        "金融",
        "etf",
        "债务",
        "估值",
        "基金",
        "资产",
        "财富",
        "通胀",
        "利率",
        "货币",
    ],
    "职场": [
        "职场",
        "上班",
        "打工",
        "汇报",
        "升职",
        "加薪",
        "面试",
        "简历",
        "沟通",
        "老板",
        "同事",
        "办公室",
        "求职",
        "团队协作",
    ],
    "情感": [
        "情感",
        "爱情",
        "婚姻",
        "亲密关系",
        "分手",
        "伴侣",
        "恋爱",
        "暧昧",
        "约会",
        "家庭关系",
        "关系修复",
        "情绪价值",
    ],
    "文化": [
        "文化",
        "历史",
        "文学",
        "电影",
        "音乐",
        "小说",
        "艺术",
        "作家",
        "创作",
        "书店",
        "阅读",
        "写作",
        "戏剧",
        "展览",
    ],
    "健康": [
        "健康",
        "医美",
        "心理",
        "抗衰",
        "护肤",
        "生育",
        "更年期",
        "疾病",
        "营养",
        "运动",
        "疗愈",
        "睡眠",
    ],
    "生活": [
        "生活",
        "城市",
        "旅行",
        "家庭",
        "育儿",
        "女性成长",
        "自我成长",
        "方式",
        "日常",
        "消费习惯",
        "居家",
        "兴趣",
    ],
}
SYSTEM_PROMPT = """你是"播客质检员",站在听众一侧。目标是帮一个时间有限的人判断:"这档播客的这一集值不值得我点开,以及该用什么方式听"。

【强制规则】
- 不写软文,不堆砌形容词。
- 只基于 shownote 写,没说的就不要编。
- shownote 里的"广告/赞助商鸣谢/品牌口播/扫码加微信/加群引导/优惠码/推广折扣/打赏赞助",一律视为噪音,不要写进任何字段,不要从中提炼"内容亮点"。
- 所有内容只基于 shownote,绝不编造。宁可信息少,也不写没有依据的信息。
- 所有输出必须是合法 JSON,字段名严格按 schema,字段名一个字母都不能改,禁止增删字段。"""
TOPIC_SYSTEM_PROMPT = """你是播客议题分析师。给你最近两周多档播客的单集（标题/简介/shownote）。
找出"多档不同播客真的在讨论同一个具体议题"的情况，归纳成议题。
议题必须是具体有争议的问句钩子（✅"AI会让大多数人失业吗"；❌"AI的未来""科技趋势"）。
铁律：
①同领域≠同议题，必须真在回答同一个具体问题。
②同一播客只能算一种立场，不能同时出现在 consensus 和 divergence。
③分歧必须是真对立回答，一个说会/一个说不会、一个看多/一个看空；只是角度不同、补充说明不算分歧。
④诚实不硬编，共识/分歧有几条写几条，没表态别编，禁止凑对仗。
⑤宁可少给，凑不出真议题就返回[]，不要为了数量反复榨同样两档播客。
每个议题至少来自2档不同播客。consensus 至少2档不同播客才成立；divergence 也至少2档不同播客且必须互相对立才成立。输出JSON数组，每项：
{title(问句≤20字), domainTag(领域标签), consensus[{podcast,point≤30字,episodeId}], divergence[同结构]}。
consensus和divergence至少一个非空，否则丢弃该议题。只输出JSON，不要解释。
"""


@dataclass
class FeedEpisode:
    podcast_name: str
    episode_title: str
    description: str
    href: str
    guid: str
    unique_id: str
    published_at: datetime | None
    rss_url: str
    cover_image_url: str


@dataclass
class ScoredEpisode:
    episode: FeedEpisode
    recency_score: float
    value_score: float
    total_score: float
    domain: str = DEFAULT_DOMAIN
    selected: bool = False
    reason: str = ""


def local_now() -> datetime:
    return datetime.now().astimezone()


def load_env(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def apply_runtime_env(env: dict[str, str]) -> dict[str, str]:
    runtime_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if runtime_key:
        env["DEEPSEEK_API_KEY"] = runtime_key
        print("DeepSeek API key source: env", flush=True)
    elif env.get("DEEPSEEK_API_KEY"):
        print("DeepSeek API key source: .env", flush=True)
    else:
        print("DeepSeek API key source: missing", flush=True)
    return env


def format_date_str(dt: datetime) -> str:
    return dt.strftime("%Y.%m.%d")


def format_china_date_str(dt: datetime) -> str:
    weekday = dt.weekday()
    return f"{WEEKDAYS_CN[weekday]} / {WEEKDAYS_EN[weekday]}"


def parse_opml(opml_path: Path) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    def add_url(xml_url: str) -> None:
        xml_url = html.unescape(xml_url.strip())
        if not xml_url or xml_url in seen:
            return
        seen.add(xml_url)
        urls.append(xml_url)

    try:
        tree = ET.parse(opml_path)
    except ET.ParseError:
        raw_opml = opml_path.read_text(encoding="utf-8")
        for match in re.finditer(r'\bxmlUrl\s*=\s*["\']([^"\']+)["\']', raw_opml):
            add_url(match.group(1))
        return urls

    for outline in tree.iter():
        if outline.tag.split("}")[-1] == "outline":
            add_url(outline.attrib.get("xmlUrl") or outline.attrib.get("xmlurl") or "")

    return urls


def fetch_xml(url: str, timeout: int) -> ET.Element:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Pickast/0.2 (+https://local.pickast)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return ET.fromstring(response.read())


def child_text(element: ET.Element, names: Iterable[str]) -> str:
    wanted = set(names)
    for child in list(element):
        tag = child.tag.split("}")[-1]
        if tag in wanted and child.text:
            return child.text.strip()
    return ""


def child_attr(element: ET.Element, child_name: str, attr_name: str, attr_value: str | None = None) -> str:
    for child in list(element):
        tag = child.tag.split("}")[-1]
        if tag != child_name:
            continue
        if attr_value is not None and child.attrib.get(attr_name) != attr_value:
            continue
        href = child.attrib.get("href")
        if href:
            return href.strip()
    return ""


def is_image_candidate(url: str) -> bool:
    cleaned_url = url.split("?", 1)[0].lower()
    return cleaned_url.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"))


def image_url(element: ET.Element) -> str:
    for child in list(element):
        tag = child.tag.split("}")[-1]

        if tag == "content":
            media_type = (child.attrib.get("type") or "").lower()
            medium = (child.attrib.get("medium") or "").lower()
            href = child.attrib.get("href") or child.attrib.get("url") or ""

            if media_type and not media_type.startswith("image/"):
                continue
            if medium and medium != "image":
                continue
            if href and (media_type.startswith("image/") or medium == "image" or is_image_candidate(href)):
                return href.strip()

        if tag in {"image", "thumbnail"}:
            href = child.attrib.get("href") or child.attrib.get("url")
            if href:
                return href.strip()
            nested_url = child_text(child, ["url"])
            if nested_url:
                return nested_url

    return ""


def parse_datetime(value: str) -> datetime | None:
    value = value.strip()
    if not value:
        return None

    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError, OverflowError):
        parsed = None

    if parsed is None:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone()


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"</p\s*>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def compact_text(value: str, limit: int = 6000) -> str:
    value = re.sub(r"\n{3,}", "\n\n", value or "").strip()
    if len(value) <= limit:
        return value
    return value[:limit].rstrip() + "\n……"


def xiaoyuzhou_deep_link(url: str) -> str:
    match = re.search(r"xiaoyuzhoufm\.com/(episode|podcast)/([0-9a-z]+)", url, re.I)
    if not match:
        return ""
    kind, item_id = match.groups()
    return f"cosmos://page.cos/{kind.lower()}/{item_id}?utm_source=rss"


def episode_id_from_href(url: str) -> str:
    match = re.search(r"episode/([^?]+)", url or "", re.I)
    return match.group(1) if match else ""


def preferred_episode_href(episode: FeedEpisode) -> str:
    candidates = [episode.href, episode.guid, episode.rss_url]
    for candidate in candidates:
        if not candidate:
            continue
        deep_link = xiaoyuzhou_deep_link(candidate)
        if deep_link:
            return deep_link
    return episode.href or episode.rss_url


def make_unique_id(rss_url: str, guid: str, href: str, title: str) -> str:
    raw = guid or href or f"{rss_url}|{title}"
    if raw:
        return raw.strip()
    return hashlib.sha256(f"{rss_url}|{title}".encode("utf-8")).hexdigest()


def rss_items(root: ET.Element, rss_url: str) -> list[FeedEpisode]:
    channel = root.find("channel")
    if channel is None:
        return []

    podcast_name = child_text(channel, ["title"]) or rss_url
    podcast_cover_url = image_url(channel)
    episodes: list[FeedEpisode] = []

    for item in channel.findall("item"):
        title = child_text(item, ["title"])
        if not title:
            continue

        link = child_text(item, ["link"])
        guid = child_text(item, ["guid"])
        description = child_text(item, ["description", "summary", "encoded"])
        published_text = child_text(item, ["pubDate", "published", "updated", "date"])
        cover_image_url = image_url(item) or podcast_cover_url

        episodes.append(
            FeedEpisode(
                podcast_name=podcast_name,
                episode_title=title,
                description=clean_text(description),
                href=link or guid or rss_url,
                guid=guid,
                unique_id=make_unique_id(rss_url, guid, link, title),
                published_at=parse_datetime(published_text),
                rss_url=rss_url,
                cover_image_url=cover_image_url,
            )
        )

    return episodes


def atom_entries(root: ET.Element, rss_url: str) -> list[FeedEpisode]:
    podcast_name = child_text(root, ["title"]) or rss_url
    podcast_cover_url = image_url(root)
    episodes: list[FeedEpisode] = []

    for entry in list(root):
        if entry.tag.split("}")[-1] != "entry":
            continue

        title = child_text(entry, ["title"])
        if not title:
            continue

        link = child_attr(entry, "link", "rel", "alternate") or child_attr(entry, "link", "rel") or rss_url
        guid = child_text(entry, ["id"])
        description = child_text(entry, ["summary", "content"])
        published_text = child_text(entry, ["published", "updated"])
        cover_image_url = image_url(entry) or podcast_cover_url

        episodes.append(
            FeedEpisode(
                podcast_name=podcast_name,
                episode_title=title,
                description=clean_text(description),
                href=link,
                guid=guid,
                unique_id=make_unique_id(rss_url, guid, link, title),
                published_at=parse_datetime(published_text),
                rss_url=rss_url,
                cover_image_url=cover_image_url,
            )
        )

    return episodes


def episodes_from_feed(url: str, timeout: int) -> list[FeedEpisode]:
    root = fetch_xml(url, timeout)
    root_tag = root.tag.split("}")[-1].lower()

    if root_tag == "rss" or root.find("channel") is not None:
        return rss_items(root, url)
    if root_tag == "feed":
        return atom_entries(root, url)
    return []


def load_favorites(path: Path) -> set[str]:
    if not path.exists():
        path.write_text("[]\n", encoding="utf-8")
        return set()

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()

    if not isinstance(data, list):
        return set()
    return {str(item).strip() for item in data if str(item).strip()}


def cover_text(podcast_name: str) -> str:
    compact = re.sub(r"\s+", "", podcast_name)
    return compact[:2] or "播客"


def recency_score(episode: FeedEpisode, now: datetime) -> float:
    if not episode.published_at:
        return 1.0

    age_days = max((now - episode.published_at).total_seconds() / 86400, 0)
    if age_days <= 2:
        return 10.0

    return max(1.0, 10.0 * math.exp(-(age_days - 2) / 20))


def value_score(description: str) -> float:
    text = description or ""
    if not text:
        return 0.0

    length_component = min(len(text), 5000) / 5000 * 4.0
    timestamp_component = min(len(re.findall(r"\b\d{1,2}[:：]\d{2}", text)), 12) / 12 * 1.5
    structure_component = min(len(re.findall(r"[【】\[\]🎧🎤📚⏱️🌟💡📌]", text)), 16) / 16 * 1.0
    viewpoint_component = min(
        len(re.findall(r"为什么|如何|认为|问题|风险|趋势|变化|逻辑|路径|原因|判断|观点|启示|机会|挑战", text)),
        18,
    ) / 18 * 2.0
    domain_component = min(
        len(re.findall(r"AI|商业|科技|出海|风险|趋势|市场|监管|投资|模型|基础设施|抗衰|职场|文明|教育|文化|能源", text, re.I)),
        16,
    ) / 16 * 1.5
    return round(min(10.0, length_component + timestamp_component + structure_component + viewpoint_component + domain_component), 2)


def total_score(recency: float, value: float) -> float:
    return round(recency * RECENCY_WEIGHT + value * VALUE_WEIGHT, 2)


def keyword_hits(text: str, keywords: list[str]) -> int:
    lowered = text.lower()
    return sum(lowered.count(keyword.lower()) for keyword in keywords)


def classify_domain(episode: FeedEpisode) -> str:
    podcast_text = episode.podcast_name.lower()
    title_text = episode.episode_title.lower()
    desc_text = episode.description[:4000].lower()

    best_domain = DEFAULT_DOMAIN
    best_score = -1

    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = keyword_hits(title_text, keywords) * 4
        score += keyword_hits(podcast_text, keywords) * 3
        score += keyword_hits(desc_text, keywords)
        if score > best_score:
            best_score = score
            best_domain = domain

    if best_score <= 0:
        return DEFAULT_DOMAIN
    return best_domain


def score_candidates(episodes: list[FeedEpisode], now: datetime) -> list[ScoredEpisode]:
    scored: list[ScoredEpisode] = []
    for episode in episodes:
        r_score = round(recency_score(episode, now), 2)
        v_score = value_score(episode.description)
        scored.append(
            ScoredEpisode(
                episode=episode,
                recency_score=r_score,
                value_score=v_score,
                total_score=total_score(r_score, v_score),
                domain=classify_domain(episode),
            )
        )
    return sorted(scored, key=lambda item: item.total_score, reverse=True)


def is_recent(episode: FeedEpisode, now: datetime) -> bool:
    if not episode.published_at:
        return False
    return max((now - episode.published_at).total_seconds() / 86400, 0) <= 2


def is_recent_within_days(episode: FeedEpisode, now: datetime, days: int) -> bool:
    if not episode.published_at:
        return False
    return max((now - episode.published_at).total_seconds() / 86400, 0) <= days


def select_candidates(scored: list[ScoredEpisode], now: datetime, limit: int = 3) -> list[ScoredEpisode]:
    selected: list[ScoredEpisode] = []
    used_podcasts: set[str] = set()
    used_domains: set[str] = set()

    recent = [item for item in scored if is_recent(item.episode, now)]
    stock = [item for item in scored if not is_recent(item.episode, now)]

    def add_from(pool: list[ScoredEpisode], *, relaxed: bool = False) -> bool:
        for item in pool:
            if item in selected:
                continue
            domain = item.domain
            if not relaxed and item.episode.podcast_name in used_podcasts:
                continue
            if not relaxed and len(selected) < limit - 1 and domain in used_domains:
                continue
            item.selected = True
            item.reason = "近2天更新且信息密度高" if is_recent(item.episode, now) else "高价值存货补位"
            selected.append(item)
            used_podcasts.add(item.episode.podcast_name)
            used_domains.add(domain)
            return True
        return False

    for _ in range(min(2, len(recent))):
        add_from(recent)
    while len(selected) < min(2, len(recent)):
        if not add_from(recent, relaxed=True):
            break

    add_from(stock)
    while len(selected) < limit:
        if not add_from(scored, relaxed=True):
            break

    for item in scored:
        if not item.reason:
            if is_recent(item.episode, now):
                item.reason = "近2天更新，按总分排序"
            else:
                item.reason = "存货池保留，按价值与时效排序"

    return selected[:limit]


def base_triage_label(item: ScoredEpisode) -> str:
    dense = item.value_score >= 7.5 or len(item.episode.description) > 4500
    light = item.value_score < 5.0 or len(item.episode.description) < 1000

    if dense:
        return "📖值得精听"
    if light:
        return "☕有空再听"
    return "🚶边走边听"


def triage_hint(item: ScoredEpisode, index: int, selected: list[ScoredEpisode]) -> str:
    label = base_triage_label(item)
    existing = {other.reason for other in selected[:index]}
    if index == len(selected) - 1 and len(existing) <= 1:
        label = "🚶边走边听" if label == "📖值得精听" else "📖值得精听"
    return label


def episode_to_card(episode: FeedEpisode, scenario_index: int | None = None) -> dict:
    card = {
        "episodeId": episode.unique_id,
        "podcastName": episode.podcast_name,
        "episodeTitle": episode.episode_title,
        "description": episode.description,
        "publishedAt": episode.published_at.isoformat() if episode.published_at else "",
        "rssUrl": episode.rss_url,
        "coverImageUrl": episode.cover_image_url,
        "coverText": cover_text(episode.podcast_name),
        "coverBg": "bg-[#18181B]",
        "coverTextColor": "text-amber-50",
        "whyRecommended": "",
        "viewpoints": [],
        "goldenQuotes": [],
        "triageTag": "",
        "href": preferred_episode_href(episode),
    }
    if scenario_index is not None:
        card["scenario"] = ""
    return card


def card_cache_key(episode: FeedEpisode) -> str:
    return episode.unique_id or make_unique_id(episode.rss_url, episode.guid, episode.href, episode.episode_title)


def parse_json_payload(raw_text: str) -> object | None:
    text = raw_text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        object_start = text.find("{")
        object_end = text.rfind("}")
        array_start = text.find("[")
        array_end = text.rfind("]")

        candidates = []
        if object_start >= 0 and object_end > object_start:
            candidates.append(text[object_start : object_end + 1])
        if array_start >= 0 and array_end > array_start:
            candidates.append(text[array_start : array_end + 1])

        if not candidates:
            return None

        parsed = None
        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
                break
            except json.JSONDecodeError:
                continue
        if parsed is None:
            return None

    return parsed if isinstance(parsed, (dict, list)) else None


def deepseek_json(
    messages: list[dict],
    env: dict[str, str],
    timeout: int,
    response_format: str | None = "json_object",
) -> object | None:
    api_key = env.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        return None

    base_url = env.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = env.get("DEEPSEEK_MODEL", "deepseek-chat")
    request_body = {
        "model": model,
        "messages": messages,
        "temperature": 0,
    }
    if response_format:
        request_body["response_format"] = {"type": response_format}

    payload = json.dumps(request_body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"DeepSeek request failed: {error}", file=sys.stderr)
        return None

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return parse_json_payload(content)


def episode_ai_prompt(item: ScoredEpisode, suggested_triage: str) -> str:
    episode = item.episode
    return (
        "请只返回 JSON,不要 Markdown,不要解释。\n\n"
        "JSON schema:\n"
        "{\n"
        '  "whyRecommended": "1句中文,30~55字,具体说明这一集的独特价值/适合谁听,必须一句话说完",\n'
        '  "key_points": ["固定3条,每条15~25字,必须来自 shownote", "...", "..."],\n'
        '  "golden_quotes": [{"quote": "逐字摘自 shownote 原文,不许改写,优先选择 ≤40字 的完整句子"}],\n'
        '  "triage": {"label": "<三选一>", "reason": "<≤14字内容钩子>"}\n'
        "}\n\n"
        "【triage 字段硬约束】\n"
        "1. label 必须严格三选一,从以下三个值中精确选一个,emoji 不能丢:\n"
        '   - "📖值得精听"\n'
        '   - "🚶边走边听"\n'
        '   - "☕有空再听"\n'
        "   禁止自由发挥、禁止改字、禁止 emoji 缺失、禁止写其它值。\n\n"
        '2. reason 是"内容钩子",≤14 字。请实际控制在 10~12 字,保留 1~2 字余量,绝不要写到 13、14 字。\n'
        "   必须以完整词语结尾,绝不允许中途截断半个词。坏例子对照:\n"
        '   - 输入"Thiel 论 AI 与文明风险"被错误截成"Thiel 论 AI 与文明风"(把"风险"切成"风",错误)\n'
        '   - 输入"韩国股市暴涨与 K 型社会分化"被错误截成"韩国股市暴涨与 K 型社会分"(把"分化"切成"分",错误)\n'
        "   - 正确做法:宁可整句缩短,也不留半截词\n"
        "   必须包含至少一个【具体内容元素】,从下面四类里至少出现一个:\n"
        "   (a) 具体话题/议题(例:AI失业、K型社会、加薪谈判)\n"
        "   (b) 嘉宾名 + 嘉宾干了什么(只写人名不算,必须搭配动作或观点)\n"
        "   (c) 具体案例/故事(例:跨部门沟通实战案例)\n"
        "   (d) 具体结论/观点(例:AI热潮不是泡沫、韩国股市存在结构性问题)\n\n"
        "   绝对禁止只描述抽象听感/场景/听法,以下任何短语单独成 reason 都是违规:\n"
        '   - "轻量浏览"、"信息密度高"、"干货满满"、"值得反复听"、"适合放松"、"轻松吸收"、"边走边听"、"通勤听"、"睡前听"、"碎片时间"\n'
        '   - 单纯一个嘉宾名(如只写"Peter Thiel"),必须搭配 TA 的观点或行动\n\n'
        "   好/坏对照:\n"
        '   - ❌ "Peter Thiel" → ✅ "Thiel 论 AI 与文明风险"\n'
        '   - ❌ "轻量浏览" → ✅ "职场沟通实战故事"\n'
        '   - ❌ "干货满满" → ✅ "AI Agent 替代工程师之争"\n\n'
        "3. reason 好坏对照:\n"
        '   - ❌ 坏:"案例多,方法具体,可边听"(末尾"可边听"复刻 label)\n'
        '   - ❌ 坏:"适合通勤路上听"(描述场景不是描述内容)\n'
        '   - ✅ 好:"职场沟通实战,故事+方法"(讲了什么)\n'
        '   - ✅ 好:"Peter Thiel 对 AI 的反共识判断"(讲了什么)\n\n'
        "输入:\n"
        f"- 单集标题: {episode.episode_title}\n"
        f"- 单集发布时间: {episode.published_at.isoformat() if episode.published_at else ''}\n"
        f"- shownote: {compact_text(episode.description)}"
    )


def fallback_card_without_ai(card: dict) -> dict:
    card["whyRecommended"] = ""
    card["viewpoints"] = []
    card["goldenQuotes"] = []
    card["triageTag"] = ""
    return card


def first_informative_lines(description: str, limit: int = 3) -> list[str]:
    lines: list[str] = []
    for raw_line in description.splitlines():
        line = re.sub(r"^[•·\-—*#]+", "", raw_line).strip()
        line = re.sub(r"^\d{1,2}[:：]\d{2}\s*", "", line)
        if len(line) < 10:
            continue
        if re.fullmatch(r"[【\[]?.{1,8}[】\]]?", line):
            continue
        if line in lines:
            continue
        lines.append(line)
        if len(lines) >= limit:
            break
    return lines


def local_why_recommended(item: ScoredEpisode) -> str:
    domain = item.domain
    lead = first_informative_lines(item.episode.description, limit=1)
    if lead:
        snippet = lead[0][:28].rstrip("，。,；：")
        return f"适合想快速判断{domain}议题值不值得听的人，重点会落在{snippet}。"
    return f"适合想快速了解{domain}方向近况的听众。"


def complete_sentence_within_limit(value: str, limit: int = 55) -> str:
    value = re.sub(r"\s+", "", value).strip()
    if len(value) <= limit:
        return value

    clipped = value[: max(limit - 1, 1)]
    punctuation_positions = [clipped.rfind(mark) for mark in "。！？；"]
    best_position = max(punctuation_positions)
    if best_position >= 20:
        return clipped[: best_position + 1]

    return clipped.rstrip("，,、；;：:") + "。"


def clamp_reason(value: str, limit: int = 14) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= limit:
        return value

    clipped = value[:limit]
    punctuation_positions = [clipped.rfind(mark) for mark in ",。、!?"]
    best_position = max(punctuation_positions)
    if best_position >= 2:
        return clipped[:best_position].strip()

    boundary_positions = [clipped.rfind(mark) for mark in " -_+/｜·"]
    best_boundary = max(boundary_positions)
    if best_boundary >= 2:
        return clipped[:best_boundary].strip()

    return clipped.rstrip("风分社观议案故方题险化会点题例事法")


def local_golden_quotes(description: str) -> list[dict]:
    quotes = re.findall(r"[“\"]([^”\"\n]{10,40})[”\"]", description)
    normalized = []
    for quote in quotes[:2]:
        if quote in description:
            normalized.append(
                {
                    "quote": quote,
                    "source": "来自本期 shownote",
                    "source_note": "来自本期 shownote",
                }
            )
    return normalized


def local_triage_tag(item: ScoredEpisode) -> str:
    label = base_triage_label(item)
    if label == "📖值得精听":
        reason = "信息密度高"
    elif label == "☕有空再听":
        reason = "更适合轻松补课"
    else:
        reason = "主线清楚好进入"
    return f"{label}｜{reason}"


def build_local_card(item: ScoredEpisode, scenario_index: int | None = None) -> dict:
    card = episode_to_card(item.episode, scenario_index=scenario_index)
    card["whyRecommended"] = local_why_recommended(item)
    card["viewpoints"] = first_informative_lines(item.episode.description, limit=3)
    card["goldenQuotes"] = local_golden_quotes(item.episode.description)
    card["triageTag"] = local_triage_tag(item)
    return card


def normalize_episode_ai(card: dict, episode: FeedEpisode, ai_data: dict | None, suggested_triage: str) -> dict:
    if not ai_data:
        return fallback_card_without_ai(card)

    why = str(ai_data.get("whyRecommended") or ai_data.get("why") or "").strip()
    key_points = ai_data.get("key_points")
    golden_quotes = ai_data.get("golden_quotes")
    triage = ai_data.get("triage")

    if not why or not isinstance(key_points, list) or len(key_points) != 3:
        return fallback_card_without_ai(card)
    why = complete_sentence_within_limit(why, limit=55)

    normalized_points = [str(point).strip() for point in key_points if str(point).strip()]
    if len(normalized_points) != 3:
        return fallback_card_without_ai(card)

    normalized_quotes = []
    if isinstance(golden_quotes, list):
        for item in golden_quotes:
            if not isinstance(item, dict):
                continue
            quote = str(item.get("quote") or "").strip()
            if quote and len(quote) <= 40 and quote in episode.description:
                normalized_quotes.append(
                    {
                        "quote": quote,
                        "source": "来自本期 shownote",
                        "source_note": "来自本期 shownote",
                    }
                )

    triage_label = ""
    triage_reason = ""
    if isinstance(triage, dict):
        triage_label = str(triage.get("label") or "").strip()
        triage_reason = clamp_reason(str(triage.get("reason") or ""))
    elif isinstance(triage, str):
        triage_label = triage.strip()

    if triage_label not in TRIAGE_LABELS:
        triage_label = suggested_triage

    card["whyRecommended"] = why
    card["viewpoints"] = normalized_points
    card["goldenQuotes"] = normalized_quotes
    card["triageTag"] = f"{triage_label}｜{triage_reason}" if triage_reason else triage_label
    return card


def build_card_for_item(item: ScoredEpisode, env: dict[str, str], timeout: int, scenario_index: int | None = None) -> dict:
    card = episode_to_card(item.episode, scenario_index=scenario_index)
    suggested_triage = base_triage_label(item)

    if not env.get("DEEPSEEK_API_KEY"):
        fallback_card_without_ai(card)
        return card

    print(f"[AI] Curating {item.episode.podcast_name} - {item.episode.episode_title}", flush=True)
    ai_data = deepseek_json(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": episode_ai_prompt(item, suggested_triage)},
        ],
        env,
        timeout,
    )
    return normalize_episode_ai(card, item.episode, ai_data, suggested_triage)


def build_card_cache(items: list[ScoredEpisode], env: dict[str, str], timeout: int) -> dict[str, dict]:
    cache: dict[str, dict] = {}
    if not items:
        return cache

    if not env.get("DEEPSEEK_API_KEY"):
        print("DeepSeek API key missing; generated cards will use fallback fields.", file=sys.stderr)

    for item in items:
        key = card_cache_key(item.episode)
        if key in cache:
            continue
        cache[key] = build_card_for_item(item, env, timeout)

    return cache


def enforce_triage_diversity(cards: list[dict], selected: list[ScoredEpisode]) -> None:
    labels = [str(card.get("triageTag", "")).split("｜", 1)[0] for card in cards]
    if len(set(label for label in labels if label)) > 1 or len(cards) < 2:
        return

    weakest_index = min(range(len(selected)), key=lambda idx: selected[idx].value_score)
    card = cards[weakest_index]
    _, separator, reason = str(card.get("triageTag", "")).partition("｜")
    label = "☕有空再听" if weakest_index != 0 else "🚶边走边听"
    card["triageTag"] = f"{label}{separator}{reason}" if reason else label


def select_topic_source_episodes(scored: list[ScoredEpisode], now: datetime, days: int = 14) -> list[ScoredEpisode]:
    return [item for item in scored if is_recent_within_days(item.episode, now, days)]


def topics_user_prompt(items: list[ScoredEpisode]) -> str:
    payload = [
        {
            "episodeId": item.episode.unique_id,
            "podcast_name": item.episode.podcast_name,
            "episode_title": item.episode.episode_title,
            "description": compact_text(item.episode.description, limit=2200),
        }
        for item in items
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)


def clean_topic_point(value: object, episode_map: dict[str, ScoredEpisode]) -> dict | None:
    if not isinstance(value, dict):
        return None

    episode_id = str(value.get("episodeId") or "").strip()
    podcast = str(value.get("podcast") or "").strip()
    point = re.sub(r"\s+", " ", str(value.get("point") or "").strip())
    if not episode_id or not podcast or not point:
        return None
    if episode_id not in episode_map:
        return None

    source_item = episode_map[episode_id]
    if podcast != source_item.episode.podcast_name:
        return None

    point = point[:30].strip()
    if not point:
        return None

    return {
        "podcast": podcast,
        "point": point,
        "episodeId": episode_id,
    }


def normalize_topics(ai_data: object, episode_map: dict[str, ScoredEpisode]) -> list[dict]:
    if not isinstance(ai_data, list):
        return []

    topics: list[dict] = []
    seen_titles: set[str] = set()

    for item in ai_data:
        if not isinstance(item, dict):
            continue

        title = re.sub(r"\s+", "", str(item.get("title") or "").strip())
        domain_tag = str(item.get("domainTag") or "").strip() or DEFAULT_DOMAIN
        if not title:
            continue
        title = title[:20]
        if title in seen_titles:
            continue

        consensus_raw = item.get("consensus") if isinstance(item.get("consensus"), list) else []
        divergence_raw = item.get("divergence") if isinstance(item.get("divergence"), list) else []

        consensus = []
        divergence = []
        seen_points: set[tuple[str, str, str]] = set()

        for row in consensus_raw:
            normalized = clean_topic_point(row, episode_map)
            if not normalized:
                continue
            signature = ("consensus", normalized["episodeId"], normalized["point"])
            if signature in seen_points:
                continue
            seen_points.add(signature)
            consensus.append(normalized)

        for row in divergence_raw:
            normalized = clean_topic_point(row, episode_map)
            if not normalized:
                continue
            signature = ("divergence", normalized["episodeId"], normalized["point"])
            if signature in seen_points:
                continue
            seen_points.add(signature)
            divergence.append(normalized)

        consensus_podcasts = {row["podcast"] for row in consensus}
        divergence_podcasts = {row["podcast"] for row in divergence}
        if consensus_podcasts & divergence_podcasts:
            divergence = [row for row in divergence if row["podcast"] not in consensus_podcasts]
            divergence_podcasts = {row["podcast"] for row in divergence}

        if not consensus and not divergence:
            continue

        if len(consensus_podcasts) < 2 and len(divergence_podcasts) < 2:
            continue

        if consensus and len(consensus_podcasts) < 2:
            consensus = []
        if divergence and len(divergence_podcasts) < 2:
            divergence = []

        podcasts = {row["podcast"] for row in consensus + divergence}
        if len(podcasts) < 2:
            continue

        topics.append(
            {
                "title": title,
                "domainTag": domain_tag,
                "consensus": consensus,
                "divergence": divergence,
            }
        )
        seen_titles.add(title)

    return topics


def build_topics(scored: list[ScoredEpisode], now: datetime, env: dict[str, str], timeout: int) -> list[dict]:
    topic_items = select_topic_source_episodes(scored, now, days=14)
    if len(topic_items) < 2 or not env.get("DEEPSEEK_API_KEY"):
        return []

    episode_map = {item.episode.unique_id: item for item in topic_items}
    print(f"[Explore] Building topics from {len(topic_items)} episodes in the last 14 days", flush=True)
    ai_data = deepseek_json(
        [
            {"role": "system", "content": TOPIC_SYSTEM_PROMPT},
            {"role": "user", "content": topics_user_prompt(topic_items)},
        ],
        env,
        timeout,
        response_format=None,
    )
    return normalize_topics(ai_data, episode_map)


def clone_card(card: dict, scenario_index: int | None = None) -> dict:
    cloned = json.loads(json.dumps(card, ensure_ascii=False))
    if scenario_index is not None:
        cloned["scenario"] = cloned.get("scenario", "")
    else:
        cloned.pop("scenario", None)
    return cloned


def build_briefing(selected: list[ScoredEpisode], now: datetime, card_cache: dict[str, dict], env: dict[str, str], timeout: int) -> dict:
    if not selected:
        fallback_episode = FeedEpisode(
            podcast_name="订阅数据",
            episode_title="没有抓取到可用单集",
            description="没有抓取到可用单集。请检查 OPML 里的 RSS 地址是否还能访问。",
            href="#",
            guid="",
            unique_id="",
            published_at=None,
            rss_url="",
            cover_image_url="",
        )
        selected = [
            ScoredEpisode(
                episode=fallback_episode,
                recency_score=0,
                value_score=0,
                total_score=0,
                selected=True,
                reason="无可用候选",
            )
        ]

    cards: list[dict] = []
    for index, item in enumerate(selected):
        base_card = card_cache.get(card_cache_key(item.episode)) or build_local_card(item)
        cards.append(clone_card(base_card, scenario_index=index if index > 0 else None))

    enforce_triage_diversity(cards, selected)

    return {
        "dateStr": format_date_str(now),
        "chinaDateStr": format_china_date_str(now),
        "title": "今天最值得听 • TODAY'S VOICE",
        "issueNo": f"精选 {len(cards)} 条",
        "mainEpisode": cards[0],
        "backupEpisodes": cards[1:],
        "synthesis": None,
    }


def to_frontend_card(card: dict) -> dict:
    normalized = dict(card)
    quotes = normalized.get("goldenQuotes") if isinstance(normalized.get("goldenQuotes"), list) else []
    first_quote = quotes[0] if quotes else {}
    quote_text = ""
    if isinstance(first_quote, dict):
        quote_text = str(first_quote.get("quote") or "").strip()
    elif first_quote:
        quote_text = str(first_quote).strip()

    normalized["whyRecommend"] = str(normalized.get("whyRecommended") or "").strip()
    normalized["goldenQuote"] = quote_text or str(normalized.get("whyRecommend") or "").strip()
    normalized["topicTag"] = str(normalized.get("triageTag") or "").strip()
    normalized["episodeId"] = str(normalized.get("episodeId") or episode_id_from_href(normalized.get("href", "")) or "").strip()
    return normalized


def to_frontend_briefing(data: dict) -> dict:
    normalized = dict(data)
    normalized["mainEpisode"] = to_frontend_card(data.get("mainEpisode", {}))
    normalized["backupEpisodes"] = [
        to_frontend_card(card) for card in data.get("backupEpisodes", []) if isinstance(card, dict)
    ]
    return normalized


def build_ranking_rows(scored: list[ScoredEpisode]) -> list[dict]:
    return [
        {
            "podcastName": item.episode.podcast_name,
            "episodeTitle": item.episode.episode_title,
            "uniqueId": item.episode.unique_id,
            "publishedAt": item.episode.published_at.isoformat() if item.episode.published_at else "",
            "recencyScore": item.recency_score,
            "valueScore": item.value_score,
            "totalScore": item.total_score,
            "domain": item.domain,
            "selected": item.selected,
            "reason": item.reason,
        }
        for item in scored
    ]


def abort_schema_invalid() -> None:
    print("[ABORT] schema invalid, keep previous data")
    raise SystemExit(0)


def is_non_empty(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return True


def validate_briefing(data: dict) -> bool:
    cards = [data.get("mainEpisode"), *data.get("backupEpisodes", [])]
    required_fields = ["whyRecommend", "goldenQuote", "topicTag", "episodeId", "episodeTitle"]
    return all(
        isinstance(card, dict) and all(is_non_empty(card.get(field)) for field in required_fields)
        for card in cards
    )


def validate_explore(explore_data: list[dict]) -> bool:
    if not explore_data:
        return False
    return all(is_non_empty(item.get("title")) and is_non_empty(item.get("divergence")) for item in explore_data)


def validate_ranking(ranking_rows: list[dict]) -> bool:
    if not ranking_rows:
        return False
    return all(
        is_non_empty(item.get("uniqueId"))
        and is_non_empty(item.get("episodeTitle"))
        and is_non_empty(item.get("podcastName"))
        for item in ranking_rows
    )


def write_generated_ts(data: dict, output_path: Path) -> None:
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    output_path.write_text(
        "/**\n"
        " * @license\n"
        " * SPDX-License-Identifier: Apache-2.0\n"
        " *\n"
        " * This file is generated by scripts/generate_briefing_data.py.\n"
        " */\n\n"
        "import { BriefingCardData } from './types';\n\n"
        f"export const initialData: BriefingCardData = {payload};\n",
        encoding="utf-8",
    )


def write_ranking(ranking_rows: list[dict], output_path: Path) -> None:
    output_path.write_text(json.dumps(ranking_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_explore(explore_data: list[dict], output_path: Path) -> None:
    output_path.write_text(json.dumps(explore_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Pickast data from an OPML file.")
    parser.add_argument("--opml", type=Path, default=DEFAULT_OPML, help="Path to the OPML file.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Path to generatedData.ts.")
    parser.add_argument("--ranking", type=Path, default=DEFAULT_RANKING, help="Path to ranking.json.")
    parser.add_argument("--explore", type=Path, default=DEFAULT_EXPLORE, help="Path to explore.json.")
    parser.add_argument("--favorites", type=Path, default=DEFAULT_FAVORITES, help="Path to favorites.json.")
    parser.add_argument("--timeout", type=int, default=20, help="RSS request timeout in seconds.")
    parser.add_argument("--ai-timeout", type=int, default=90, help="DeepSeek request timeout in seconds.")
    args = parser.parse_args()

    if not args.opml.exists():
        print(f"OPML file not found: {args.opml}", file=sys.stderr)
        return 1

    rss_urls = parse_opml(args.opml)
    if not rss_urls:
        print(f"No RSS xmlUrl entries found in: {args.opml}", file=sys.stderr)
        return 1

    favorites = load_favorites(args.favorites)
    episodes: list[FeedEpisode] = []
    failures: list[str] = []
    seen_ids: set[str] = set()

    for index, url in enumerate(rss_urls, start=1):
        print(f"[{index}/{len(rss_urls)}] Fetching {url}", flush=True)
        try:
            feed_episodes = episodes_from_feed(url, args.timeout)
        except (ET.ParseError, urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            failures.append(f"{url} ({error})")
            continue

        for episode in feed_episodes:
            if episode.unique_id in favorites or episode.unique_id in seen_ids:
                continue
            seen_ids.add(episode.unique_id)
            episodes.append(episode)

    now = local_now()
    scored = score_candidates(episodes, now)
    selected = select_candidates(scored, now, limit=3)
    env = apply_runtime_env(load_env(ROOT / ".env"))
    card_cache = build_card_cache(selected, env, args.ai_timeout)
    data = to_frontend_briefing(build_briefing(selected, now, card_cache, env, args.ai_timeout))
    explore_data = build_topics(scored, now, env, args.ai_timeout)
    ranking_rows = build_ranking_rows(scored)

    if not validate_briefing(data) or not validate_ranking(ranking_rows) or not validate_explore(explore_data):
        abort_schema_invalid()

    write_generated_ts(data, args.output)
    write_ranking(ranking_rows, args.ranking)
    write_explore(explore_data, args.explore)

    print(f"[OK] write {args.output}")
    print(f"[OK] write {args.ranking}")
    print(f"[OK] write {args.explore}")
    print(f"RSS feeds found: {len(rss_urls)}")
    print(f"Episodes parsed after favorite filtering: {len(episodes)}")
    print(f"Skipped feeds: {len(failures)}")

    if failures:
        print("\nSkipped feed details:")
        for failure in failures:
            print(f"- {failure}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
