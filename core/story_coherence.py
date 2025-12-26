"""
Story Coherence Engine - Maintains plot consistency, character tracking, and narrative flow
"""
from typing import Dict, List, Optional
import json


class StoryCoherenceTracker:
    """
    Tracks story elements across long books to prevent plot holes, contradictions,
    and repetition. Provides comprehensive context for AI generation.
    """

    def __init__(self):
        self.summary_update_interval = 5  # Update summary every N pages

    def initialize_tracking(self, book_structure: Dict) -> Dict:
        """
        Initialize coherence tracking metadata for a new book

        Returns:
            Dict with tracking fields to store in book.structure JSONB
        """
        return {
            # Core story tracking
            "story_summary": "",  # Rolling summary of entire story so far
            "last_summary_page": 0,  # Last page where summary was updated

            # Character tracking
            "characters": {},  # {name: {traits, role, first_appearance, last_mentioned}}

            # Setting/location tracking
            "locations": {},  # {name: {description, first_mentioned}}

            # Plot tracking
            "plot_points": [],  # [{page, event, importance}]
            "active_subplots": [],  # [{name, status, pages}]

            # Thematic tracking
            "key_concepts": [],  # Important concepts/ideas introduced
            "recurring_motifs": [],  # Themes that appear multiple times

            # Quality control
            "used_examples": [],  # Examples/metaphors used to avoid repetition
            "used_opening_phrases": [],  # Track variety in page openings

            # Continuity checks
            "established_facts": {},  # {fact: page_number} for consistency
            "timeline_events": [],  # [{page, event}] for temporal consistency
        }

    def build_enhanced_context(
        self,
        previous_pages: List[Dict],
        book_structure: Dict,
        current_page_number: int,
        max_recent_pages: int = 10
    ) -> str:
        """
        Build comprehensive context including:
        - Recent pages (last 10 for immediate continuity)
        - Story summary (big picture view)
        - Character/setting/plot tracking

        Args:
            previous_pages: List of all previous pages
            book_structure: Book structure with coherence tracking
            current_page_number: Current page being generated
            max_recent_pages: Number of recent pages to include in detail

        Returns:
            Formatted context string for AI generation
        """
        if not previous_pages:
            return "This is the first page of the book."

        # Get coherence tracking data
        tracking = book_structure.get('coherence_tracking', {})

        context_parts = []

        # 1. STORY SUMMARY (Big Picture)
        story_summary = tracking.get('story_summary', '')
        if story_summary:
            context_parts.append(f"""📖 STORY SO FAR (COMPLETE SUMMARY):
{story_summary}

This summary covers pages 1-{tracking.get('last_summary_page', 0)}. Use this to maintain overall plot coherence.""")

        # 2. RECENT PAGES (Immediate Context)
        recent_pages = previous_pages[-max_recent_pages:]
        recent_context = []
        for page in recent_pages:
            content = page.get('content', '')
            # Truncate very long pages
            if len(content) > 2500:
                content = content[:2500] + "..."
            recent_context.append(
                f"Page {page.get('page_number', 'N/A')} - {page.get('section', 'Untitled')}:\n{content}"
            )

        context_parts.append(f"""📄 RECENT PAGES (DETAILED):
{chr(10).join(['---', *[f'{p}' for p in recent_context], '---'])}

These are the last {len(recent_pages)} pages for immediate continuity.""")

        # 3. CHARACTER TRACKING
        characters = tracking.get('characters', {})
        if characters:
            char_list = []
            for name, info in characters.items():
                traits = info.get('traits', [])
                role = info.get('role', 'character')
                char_list.append(f"  • {name} ({role}): {', '.join(traits)}")

            context_parts.append(f"""👥 CHARACTERS INTRODUCED:
{chr(10).join(char_list)}

CRITICAL: Maintain consistent character traits, names, and roles!""")

        # 4. LOCATION TRACKING
        locations = tracking.get('locations', {})
        if locations:
            loc_list = []
            for name, info in locations.items():
                desc = info.get('description', '')
                loc_list.append(f"  • {name}: {desc}")

            context_parts.append(f"""🌍 LOCATIONS/SETTINGS:
{chr(10).join(loc_list)}

CRITICAL: Keep location descriptions consistent!""")

        # 5. PLOT POINTS
        plot_points = tracking.get('plot_points', [])
        if plot_points:
            # Show last 5 major plot points
            recent_plots = plot_points[-5:]
            plot_list = [f"  • Page {p['page']}: {p['event']}" for p in recent_plots]

            context_parts.append(f"""🎬 KEY PLOT POINTS:
{chr(10).join(plot_list)}

Continue building on these events!""")

        # 6. ACTIVE SUBPLOTS
        subplots = tracking.get('active_subplots', [])
        if subplots:
            subplot_list = [f"  • {s['name']}: {s['status']}" for s in subplots]

            context_parts.append(f"""📚 ACTIVE SUBPLOTS:
{chr(10).join(subplot_list)}

Don't forget these ongoing storylines!""")

        # 7. ESTABLISHED FACTS (For Consistency)
        facts = tracking.get('established_facts', {})
        if facts:
            fact_list = [f"  • {fact} (page {page})" for fact, page in list(facts.items())[-10:]]

            context_parts.append(f"""✓ ESTABLISHED FACTS:
{chr(10).join(fact_list)}

CRITICAL: Do NOT contradict these facts!""")

        # 8. USED EXAMPLES (Avoid Repetition)
        used_examples = tracking.get('used_examples', [])
        if used_examples:
            recent_examples = used_examples[-10:]

            context_parts.append(f"""⚠️ AVOID REPEATING THESE EXAMPLES/METAPHORS:
{chr(10).join([f'  • {ex}' for ex in recent_examples])}

Use fresh, original examples!""")

        return "\n\n".join(context_parts)

    async def extract_story_elements(
        self,
        page_content: str,
        page_number: int,
        section: str,
        ai_client
    ) -> Dict:
        """
        Use AI to extract story elements from a generated page

        Args:
            page_content: The generated page content
            page_number: Page number
            section: Section name
            ai_client: AI client (Claude or OpenAI) for extraction

        Returns:
            Dict with extracted elements: {characters, locations, plot_points, facts, examples}
        """

        extraction_prompt = f"""Analyze this book page and extract key story elements for continuity tracking.

PAGE {page_number} - {section}:
{page_content}

Extract and return a JSON object with:
{{
    "characters": [
        {{"name": "Character Name", "traits": ["trait1", "trait2"], "role": "protagonist/antagonist/supporting"}}
    ],
    "locations": [
        {{"name": "Location Name", "description": "Brief description"}}
    ],
    "plot_points": [
        {{"event": "Major event description", "importance": "high/medium/low"}}
    ],
    "facts": [
        "Established fact 1",
        "Established fact 2"
    ],
    "examples_used": [
        "Metaphor or example used"
    ],
    "key_concepts": [
        "Important concept introduced"
    ]
}}

ONLY extract elements that are explicitly mentioned or clearly established in this page.
If a category has no relevant items, return an empty array.
Be concise but specific."""

        try:
            response = await ai_client.generate(
                system_prompt="You are an expert literary analyst. Extract story elements accurately and concisely in JSON format.",
                user_prompt=extraction_prompt,
                max_tokens=1500,
                temperature=0.3  # Low temperature for consistent extraction
            )

            # Clean response and parse JSON
            response_clean = response.strip()
            if response_clean.startswith('```json'):
                response_clean = response_clean[7:]
            if response_clean.endswith('```'):
                response_clean = response_clean[:-3]

            elements = json.loads(response_clean.strip())

            return elements

        except Exception as e:
            print(f"[COHERENCE] Failed to extract story elements: {str(e)}", flush=True)
            return {
                "characters": [],
                "locations": [],
                "plot_points": [],
                "facts": [],
                "examples_used": [],
                "key_concepts": []
            }

    def update_tracking(
        self,
        book_structure: Dict,
        page_number: int,
        extracted_elements: Dict
    ) -> Dict:
        """
        Update coherence tracking with extracted elements from latest page

        Args:
            book_structure: Current book structure with coherence_tracking
            page_number: Page number that was just generated
            extracted_elements: Elements extracted from that page

        Returns:
            Updated book structure
        """
        tracking = book_structure.get('coherence_tracking', self.initialize_tracking(book_structure))

        # Update characters
        for char in extracted_elements.get('characters', []):
            name = char.get('name')
            if name:
                if name not in tracking['characters']:
                    tracking['characters'][name] = {
                        'traits': char.get('traits', []),
                        'role': char.get('role', 'character'),
                        'first_appearance': page_number,
                        'last_mentioned': page_number
                    }
                else:
                    # Update last mentioned and add new traits
                    tracking['characters'][name]['last_mentioned'] = page_number
                    existing_traits = set(tracking['characters'][name]['traits'])
                    new_traits = set(char.get('traits', []))
                    tracking['characters'][name]['traits'] = list(existing_traits | new_traits)

        # Update locations
        for loc in extracted_elements.get('locations', []):
            name = loc.get('name')
            if name and name not in tracking['locations']:
                tracking['locations'][name] = {
                    'description': loc.get('description', ''),
                    'first_mentioned': page_number
                }

        # Add plot points
        for plot in extracted_elements.get('plot_points', []):
            tracking['plot_points'].append({
                'page': page_number,
                'event': plot.get('event', ''),
                'importance': plot.get('importance', 'medium')
            })

        # Add established facts
        for fact in extracted_elements.get('facts', []):
            if fact and fact not in tracking['established_facts']:
                tracking['established_facts'][fact] = page_number

        # Track used examples to avoid repetition
        for example in extracted_elements.get('examples_used', []):
            if example:
                tracking['used_examples'].append(example)

        # Track key concepts
        for concept in extracted_elements.get('key_concepts', []):
            if concept and concept not in tracking['key_concepts']:
                tracking['key_concepts'].append(concept)

        # Update book structure
        book_structure['coherence_tracking'] = tracking

        return book_structure

    async def generate_rolling_summary(
        self,
        previous_pages: List[Dict],
        current_summary: str,
        last_summary_page: int,
        current_page: int,
        ai_client
    ) -> str:
        """
        Generate or update rolling story summary

        Args:
            previous_pages: All pages generated so far
            current_summary: Existing summary (may be empty)
            last_summary_page: Last page included in summary
            current_page: Current page number
            ai_client: AI client for summary generation

        Returns:
            Updated summary string
        """

        # Get pages since last summary
        new_pages = [p for p in previous_pages if p.get('page_number', 0) > last_summary_page]

        if not new_pages:
            return current_summary

        # Build content of new pages
        new_content = []
        for page in new_pages:
            new_content.append(f"Page {page.get('page_number')}: {page.get('content', '')[:1000]}")

        new_pages_text = "\n\n".join(new_content)

        summary_prompt = f"""Update the story summary to include the latest pages.

PREVIOUS SUMMARY (Pages 1-{last_summary_page}):
{current_summary if current_summary else "No previous summary - this is the first summary."}

NEW PAGES TO SUMMARIZE (Pages {last_summary_page + 1}-{current_page}):
{new_pages_text}

Generate a COMPREHENSIVE SUMMARY (500-800 words) that:
1. Incorporates the previous summary if it exists
2. Adds the major events, character development, and plot progression from new pages
3. Maintains chronological flow
4. Highlights key plot points, character arcs, and story developments
5. Notes important facts, locations, and thematic elements
6. Is detailed enough for an author to continue the story coherently

Write in third person, past tense. Focus on WHAT HAPPENED, not writing style."""

        try:
            summary = await ai_client.generate(
                system_prompt="You are an expert story analyst creating comprehensive plot summaries.",
                user_prompt=summary_prompt,
                max_tokens=1200,
                temperature=0.3
            )

            return summary.strip()

        except Exception as e:
            print(f"[COHERENCE] Failed to generate summary: {str(e)}", flush=True)
            return current_summary  # Return old summary if generation fails

    def should_update_summary(self, current_page: int, last_summary_page: int) -> bool:
        """Check if summary should be updated"""
        return (current_page - last_summary_page) >= self.summary_update_interval
