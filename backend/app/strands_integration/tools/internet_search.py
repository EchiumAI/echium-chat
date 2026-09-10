"""Internet search tool with a swappable, provider-agnostic backend.

Adding or switching a search company is intentionally cheap:

    1. Write a subclass of `SearchProvider` implementing `search()`.
    2. Register a factory for it in `PROVIDER_REGISTRY`.

Which providers are used, and in what order, is controlled at runtime by the
`SEARCH_PROVIDER` environment variable (e.g. "brave" or "brave,tavily") with no
code change. Nothing about a specific vendor is hardcoded into the tool logic.

Current setup: Brave is the primary provider. Tavily is registered as a
fallback and activates automatically once a TAVILY_API_KEY is present.
DuckDuckGo is a keyless, best-effort local-dev fallback only (it is rate-limited
from datacenter IPs like AWS Lambda).
"""

import abc
import json
import logging
import os
from typing import Callable, Optional

import requests
from app.repositories.models.custom_bot import BotModel
from strands import tool
from strands.types.tools import AgentTool as StrandsAgentTool

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# A single normalized search hit.
SearchResult = dict[str, str]  # {"content", "source_name", "source_link"}


# ==========================================================================
# Provider interface
# ==========================================================================
class SearchProvider(abc.ABC):
    """Base class for a search backend. One concrete subclass per company."""

    name: str = "provider"

    @abc.abstractmethod
    def search(
        self, query: str, locale: str, time_limit: str, count: int = 10
    ) -> list[SearchResult]:
        """Run a search and return normalized results.

        Must raise on hard failures (auth, transport, quota) so the caller can
        fall through to the next provider and surface an honest diagnostic.
        An empty list means "searched fine, found nothing".
        """
        raise NotImplementedError


def _parse_locale(locale: str) -> tuple[str, str]:
    """Split an `en-us` style locale into (language, country); default en/US."""
    if not locale or "-" not in locale:
        return "en", "US"
    language, country = locale.split("-", 1)
    return (language or "en").lower(), (country or "US").upper()


# ==========================================================================
# Providers
# ==========================================================================
class BraveProvider(SearchProvider):
    """Brave Search API. Returns ranked snippets directly (no scraping)."""

    name = "brave"
    endpoint = os.environ.get(
        "BRAVE_SEARCH_URL", "https://api.search.brave.com/res/v1/web/search"
    )
    timeout_seconds = 8
    _freshness = {"d": "pd", "w": "pw", "m": "pm", "y": "py"}

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(
        self, query: str, locale: str, time_limit: str, count: int = 10
    ) -> list[SearchResult]:
        language, country = _parse_locale(locale)
        params: dict[str, str | int | bool] = {
            "q": query,
            "count": min(max(count, 1), 20),
            "search_lang": language,
            "country": country,
            "safesearch": "moderate",
            "text_decorations": False,
            "spellcheck": True,
        }
        freshness = self._freshness.get(time_limit)
        if freshness:
            params["freshness"] = freshness

        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
        }

        logger.info(
            f"[brave] query={query}, count={params['count']}, "
            f"lang={language}, country={country}, freshness={freshness or 'any'}"
        )
        response = requests.get(
            self.endpoint, headers=headers, params=params, timeout=self.timeout_seconds
        )
        response.raise_for_status()
        payload = response.json()

        results = (payload.get("web") or {}).get("results") or []
        formatted: list[SearchResult] = []
        for result in results:
            title = result.get("title", "")
            url = result.get("url", "")
            content = result.get("description", "")
            extra_snippets = result.get("extra_snippets") or []
            if extra_snippets:
                content = (content + "\n" + "\n".join(extra_snippets)).strip()
            if title or content:
                formatted.append(
                    {"content": content, "source_name": title, "source_link": url}
                )

        logger.info(f"[brave] found {len(formatted)} results")
        return formatted


class TavilyProvider(SearchProvider):
    """Tavily search. Returns clean, LLM-ready content directly.

    Registered as a fallback; activates automatically once TAVILY_API_KEY is set.
    """

    name = "tavily"
    endpoint = os.environ.get("TAVILY_SEARCH_URL", "https://api.tavily.com/search")
    timeout_seconds = 8
    _time_range = {"d": "day", "w": "week", "m": "month", "y": "year"}

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(
        self, query: str, locale: str, time_limit: str, count: int = 10
    ) -> list[SearchResult]:
        body: dict[str, object] = {
            "query": query,
            "max_results": min(max(count, 1), 20),
            "search_depth": "basic",
            "include_answer": False,
        }
        time_range = self._time_range.get(time_limit)
        if time_range:
            body["time_range"] = time_range

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        logger.info(f"[tavily] query={query}, max_results={body['max_results']}")
        response = requests.post(
            self.endpoint, headers=headers, json=body, timeout=self.timeout_seconds
        )
        response.raise_for_status()
        payload = response.json()

        results = payload.get("results") or []
        formatted: list[SearchResult] = []
        for result in results:
            title = result.get("title", "")
            url = result.get("url", "")
            content = result.get("content", "")
            if title or content:
                formatted.append(
                    {"content": content, "source_name": title, "source_link": url}
                )

        logger.info(f"[tavily] found {len(formatted)} results")
        return formatted


class FirecrawlProvider(SearchProvider):
    """Firecrawl search. Scrapes full pages, so results are summarized.

    Kept for bots explicitly configured to use Firecrawl.
    """

    name = "firecrawl"

    def __init__(self, api_key: str, max_results: int = 10):
        self.api_key = api_key
        self.max_results = max_results

    def search(
        self, query: str, locale: str, time_limit: str, count: int = 10
    ) -> list[SearchResult]:
        from firecrawl import FirecrawlApp, ScrapeOptions

        language, country = _parse_locale(locale)
        logger.info(f"[firecrawl] query={query}, max_results={self.max_results}")

        app = FirecrawlApp(api_key=self.api_key)
        results = app.search(
            query,
            limit=self.max_results,
            lang=language,
            location=country.lower(),
            scrape_options=ScrapeOptions(formats=["markdown"], onlyMainContent=True),
        )

        if not results or not hasattr(results, "data") or not results.data:
            logger.warning("[firecrawl] no results")
            return []

        formatted: list[SearchResult] = []
        for data in results.data:
            if not isinstance(data, dict):
                continue
            title = data.get("title", "")
            metadata = data.get("metadata")
            url = data.get("url", "") or (
                metadata.get("sourceURL", "") if isinstance(metadata, dict) else ""
            )
            content = data.get("markdown", "") or data.get("content", "")
            if title or content:
                formatted.append(
                    {
                        "content": _summarize_content(content, title, url, query),
                        "source_name": title,
                        "source_link": url,
                    }
                )

        logger.info(f"[firecrawl] found {len(formatted)} results")
        return formatted


class DuckDuckGoProvider(SearchProvider):
    """Keyless, best-effort fallback. Rate-limited from datacenter IPs, so it
    fails fast (one attempt per backend, no long retry/backoff). Local-dev only."""

    name = "duckduckgo"

    def search(
        self, query: str, locale: str, time_limit: str, count: int = 10
    ) -> list[SearchResult]:
        from duckduckgo_search import DDGS

        language, country = _parse_locale(locale)
        region = f"{country}-{language}".lower()

        last_error: Optional[Exception] = None
        for backend in ("api", "html", "lite"):
            try:
                logger.info(
                    f"[duckduckgo] query={query}, region={region}, backend={backend}"
                )
                with DDGS(timeout=5) as ddgs:
                    hits = list(
                        ddgs.text(
                            keywords=query,
                            region=region,
                            safesearch="moderate",
                            timelimit=time_limit or None,
                            max_results=min(count, 10),
                            backend=backend,
                        )
                    )
                formatted = [
                    {
                        "content": hit.get("body", ""),
                        "source_name": hit.get("title", ""),
                        "source_link": hit.get("href", ""),
                    }
                    for hit in hits
                ]
                if formatted:
                    logger.info(f"[duckduckgo] found {len(formatted)} via '{backend}'")
                    return formatted
            except Exception as e:
                last_error = e
                logger.warning(f"[duckduckgo] backend '{backend}' failed: {e}")

        if last_error:
            raise last_error
        return []


# ==========================================================================
# Provider registry + runtime selection
# ==========================================================================
def _brave_from_env() -> Optional[SearchProvider]:
    key = os.environ.get("BRAVE_API_KEY", "")
    return BraveProvider(key) if key else None


def _tavily_from_env() -> Optional[SearchProvider]:
    key = os.environ.get("TAVILY_API_KEY", "")
    return TavilyProvider(key) if key else None


def _firecrawl_from_env() -> Optional[SearchProvider]:
    key = os.environ.get("FIRECRAWL_API_KEY", "")
    return FirecrawlProvider(key) if key else None


def _duckduckgo_from_env() -> Optional[SearchProvider]:
    return DuckDuckGoProvider()


# name -> factory that builds the provider from env (None if unconfigured).
PROVIDER_REGISTRY: dict[str, Callable[[], Optional[SearchProvider]]] = {
    "brave": _brave_from_env,
    "tavily": _tavily_from_env,
    "firecrawl": _firecrawl_from_env,
    "duckduckgo": _duckduckgo_from_env,
}

# Default order when SEARCH_PROVIDER is unset. Only configured providers (with a
# key) actually run, so this is effectively: Brave primary, Tavily fallback once
# TAVILY_API_KEY is set, DuckDuckGo as a keyless last resort (local dev).
DEFAULT_PROVIDER_ORDER = ["brave", "tavily", "duckduckgo"]


def _configured_order() -> list[str]:
    raw = os.environ.get("SEARCH_PROVIDER", "").strip()
    if not raw:
        return DEFAULT_PROVIDER_ORDER
    return [name.strip().lower() for name in raw.split(",") if name.strip()]


def _get_internet_tool_config(bot: BotModel | None):
    if not bot or not bot.agent or not bot.agent.tools:
        return None
    for tool_config in bot.agent.tools:
        if tool_config.tool_type == "internet":
            return tool_config
    return None


def _resolve_providers(bot: BotModel | None) -> list[SearchProvider]:
    """Build the ordered list of providers to try for this request."""
    providers: list[SearchProvider] = []

    # A bot with its own Firecrawl key keeps that behavior, first.
    tool_cfg = _get_internet_tool_config(bot) if bot else None
    if (
        tool_cfg
        and tool_cfg.search_engine == "firecrawl"
        and tool_cfg.firecrawl_config
        and tool_cfg.firecrawl_config.api_key
    ):
        providers.append(
            FirecrawlProvider(
                tool_cfg.firecrawl_config.api_key,
                tool_cfg.firecrawl_config.max_results,
            )
        )

    for name in _configured_order():
        factory = PROVIDER_REGISTRY.get(name)
        if not factory:
            logger.warning(f"[INTERNET_SEARCH] Unknown provider '{name}' in config")
            continue
        provider = factory()
        if provider is not None:
            providers.append(provider)

    return providers


# ==========================================================================
# Content summarization (Firecrawl path only)
# ==========================================================================
def _summarize_content(content: str, title: str, url: str, query: str) -> str:
    """Summarize long scraped content with Claude 3 Haiku."""
    try:
        from app.utils import get_bedrock_runtime_client

        max_input_length = 8000
        if len(content) > max_input_length:
            content = content[:max_input_length] + "..."

        client = get_bedrock_runtime_client()
        prompt = f"""Please provide a concise summary of the following web content in 500-800 tokens maximum. Focus on information that directly answers or relates to the user's query: "{query}"

Title: {title}
URL: {url}
Content: {content}

Summary:"""

        response = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps(
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 800,
                    "messages": [{"role": "user", "content": prompt}],
                }
            ),
        )
        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"].strip()
    except Exception as e:
        logger.error(f"Error summarizing content: {e}")
        return content[:1000] + "..." if len(content) > 1000 else content


# ==========================================================================
# Tool factory
# ==========================================================================
def create_internet_search_tool(bot: BotModel | None) -> StrandsAgentTool:
    """Create an internet search tool with bot context captured in closure."""

    @tool
    def internet_search(
        query: str, locale: str = "en-us", time_limit: str = "d"
    ) -> dict:
        """
        Search the internet for information.

        Args:
            query: The query to search for on the internet.
            locale: The language and country code for the search, formatted `{language}-{country}`, for example `en-us` (English - United States), `es-es` (Spanish - Spain), `de-de` (German - Germany), `de-at` (German - Austria), `pt-pt` (Portuguese - Portugal), `it-it` (Italian - Italy), `fr-fr` (French - France). Set this to the country whose local sources best answer the query. If empty the default is `en-us`.
            time_limit: Retrieve only the most recent results, for example `w` only returns results from the last week. Units are 'd' (day), 'w' (week), 'm' (month), 'y' (year). Use empty string to retrieve all results.

        Returns:
            dict: ToolResult format with search results in json field
        """
        logger.info(
            f"[INTERNET_SEARCH] query={query}, locale={locale}, time_limit={time_limit}"
        )

        providers = _resolve_providers(bot)
        if not providers:
            logger.error("[INTERNET_SEARCH] No search providers configured")
            return {
                "status": "error",
                "content": [
                    {
                        "text": (
                            "Internet search is not configured. Tell the user "
                            "search is unavailable rather than guessing an answer."
                        )
                    }
                ],
            }

        errors: list[str] = []
        for provider in providers:
            try:
                results = provider.search(query, locale, time_limit)
                logger.info(
                    f"[INTERNET_SEARCH] Provider '{provider.name}' returned "
                    f"{len(results)} results"
                )
                return {
                    "status": "success",
                    "content": [{"json": result} for result in results],
                }
            except Exception as e:
                errors.append(f"{provider.name}: {type(e).__name__}: {e}")
                logger.warning(
                    f"[INTERNET_SEARCH] Provider '{provider.name}' failed: {e}"
                )

        logger.error(f"[INTERNET_SEARCH] All providers failed: {errors}")
        return {
            "status": "error",
            "content": [
                {
                    "text": (
                        "The internet search could not be completed (all providers "
                        "failed). Tell the user search is temporarily unavailable "
                        "rather than guessing an answer."
                    )
                }
            ],
        }

    return internet_search
