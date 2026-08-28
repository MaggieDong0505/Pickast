import importlib.util
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "generate_briefing_data.py"
SPEC = importlib.util.spec_from_file_location("generate_briefing_data", MODULE_PATH)
assert SPEC and SPEC.loader
generator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = generator
SPEC.loader.exec_module(generator)


class BriefingFallbackTest(unittest.TestCase):
    def make_item(self):
        episode = generator.FeedEpisode(
            podcast_name="测试播客",
            episode_title="今天的新节目",
            description="这期讨论人工智能如何改变普通人的工作方式，并给出三个具体案例。",
            href="https://www.xiaoyuzhoufm.com/episode/test-episode",
            guid="test-guid",
            unique_id="test-episode",
            published_at=datetime.now(timezone.utc),
            rss_url="https://example.com/feed.xml",
            cover_image_url="https://example.com/cover.jpg",
        )
        return generator.ScoredEpisode(
            episode=episode,
            recency_score=10,
            value_score=8,
            total_score=9,
            domain="AI",
            selected=True,
            reason="本地降级测试",
        )

    def test_missing_ai_key_still_produces_valid_briefing(self):
        item = self.make_item()
        card = generator.build_card_for_item(item, {}, timeout=1)
        data = generator.to_frontend_briefing(
            generator.build_briefing(
                [item],
                datetime(2026, 8, 28, tzinfo=timezone.utc),
                {generator.card_cache_key(item.episode): card},
                {},
                timeout=1,
            )
        )

        self.assertTrue(generator.validate_briefing(data))
        self.assertEqual(data["dateStr"], "2026.08.28")
        self.assertLessEqual(len(data["mainEpisode"]["whyRecommend"]), 50)
        self.assertTrue(data["mainEpisode"]["whyRecommend"].endswith("。"))

    def test_ai_failure_fallback_still_produces_required_fields(self):
        item = self.make_item()
        card = generator.episode_to_card(item.episode)
        fallback = generator.fallback_card_without_ai(card)
        frontend = generator.to_frontend_card(fallback)

        for field in ("whyRecommend", "goldenQuote", "topicTag", "episodeId", "episodeTitle"):
            self.assertTrue(frontend[field])
        self.assertTrue(generator.is_valid_recommendation_reason(frontend["whyRecommend"]))


if __name__ == "__main__":
    unittest.main()
