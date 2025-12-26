from typing import AsyncGenerator, Dict, Optional
import json
from .claude_client import ClaudeClient
from .openai_client import OpenAIClient
from .story_coherence import StoryCoherenceTracker


class BookGenerator:
    """AI-powered book generation engine with support for Claude and OpenAI"""

    def __init__(self, api_key: Optional[str] = None, model_provider: str = "claude"):
        """
        Initialize the book generator

        Args:
            api_key: API key for the selected provider (optional, will use env vars)
            model_provider: "claude" or "openai" (default: "claude")
        """
        self.model_provider = model_provider.lower()

        if self.model_provider == "claude":
            self.client = ClaudeClient(api_key=api_key)
        elif self.model_provider == "openai":
            self.client = OpenAIClient(api_key=api_key)
        else:
            raise ValueError(f"Unsupported model provider: {model_provider}. Use 'claude' or 'openai'")

        # Always initialize OpenAI client for DALL-E image generation
        self.openai_client = OpenAIClient(api_key=api_key) if self.model_provider != "openai" else self.client

        # Initialize story coherence tracker
        self.coherence_tracker = StoryCoherenceTracker()

    async def generate_book_structure(
        self,
        description: str,
        target_pages: int,
        book_type: str = "general"
    ) -> Dict:
        """
        Generate initial book structure and outline with award-winning architecture

        Args:
            description: User's description of the book
            target_pages: Desired number of pages
            book_type: Type of book (kids, adult, educational)

        Returns:
            Dict containing book title, outline, and metadata
        """

        system_prompt = self._get_structure_system_prompt(book_type)

        user_prompt = f"""You are crafting the structural foundation for a professionally published book that will compete with bestsellers. This is not just content generation—this is ARCHITECTURAL MASTERY.

BOOK CONCEPT: {description}
TARGET LENGTH: {target_pages} pages
FORMAT: {book_type}

YOUR MISSION:
Create a meticulously architected book structure that demonstrates:

✨ NARRATIVE EXCELLENCE
- Compelling story arc or information flow that builds momentum
- Strategic pacing that keeps readers engaged page-to-page
- Emotional or intellectual hooks at key transition points
- Natural climax and resolution structure

✨ PROFESSIONAL PUBLISHING STANDARDS
- Chapter/section divisions that feel intentional, not arbitrary
- Page allocation that matches content weight and importance
- Clear thematic through-lines that unify the work
- Market-ready title and subtitle that would perform on Amazon/Etsy

✨ READER PSYCHOLOGY
- Opening hook that makes skipping the book impossible
- Middle content that delivers consistent value and satisfaction
- Ending that provides closure and leaves lasting impact
- Strategic variety to prevent monotony

DELIVER THIS EXACT JSON STRUCTURE:
{{
    "title": "[Publisher-quality title that's memorable and marketable]",
    "subtitle": "[Optional subtitle that clarifies value proposition]",
    "target_pages": {target_pages},
    "outline": [
        {{
            "page_number": 1,
            "section": "[Evocative chapter/section name]",
            "content_brief": "[Specific content focus with purpose and reader benefit]"
        }}
        // ... exactly {target_pages} page entries
    ],
    "themes": ["[Deep thematic elements that elevate the work]"],
    "tone": "[Precise description of voice, style, and emotional register]",
    "target_audience": "[Specific reader demographic and psychographic]",
    "unique_angle": "[What makes this book irreplaceable and different]"
}}

CRITICAL: Every page must serve a PURPOSE. Every transition must feel INEVITABLE. The structure should read like it was designed by a publishing house's editorial board, not generated randomly."""

        response = await self.client.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=3000,
            temperature=0.8
        )

        # Parse JSON response
        try:
            # Extract JSON from response if it's wrapped in markdown
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()

            structure = json.loads(response)

            # Initialize coherence tracking in the structure
            structure['coherence_tracking'] = self.coherence_tracker.initialize_tracking(structure)

            return structure
        except json.JSONDecodeError:
            # Fallback structure if parsing fails
            return {
                "title": "Untitled Book",
                "subtitle": "",
                "target_pages": target_pages,
                "outline": [
                    {
                        "page_number": i + 1,
                        "section": f"Page {i + 1}",
                        "content_brief": "Content to be generated"
                    }
                    for i in range(target_pages)
                ],
                "themes": ["generated content"],
                "tone": "engaging and clear"
            }

    async def generate_first_page(
        self,
        book_structure: Dict,
        description: str
    ) -> Dict:
        """
        Generate the first page with award-winning opening that hooks readers immediately

        Args:
            book_structure: The book structure from generate_book_structure
            description: Original book description

        Returns:
            Dict containing page number and content
        """

        system_prompt = f"""You are an AWARD-WINNING author whose first pages have launched bestsellers. You understand that the opening page is where books are bought or abandoned.

BOOK IDENTITY:
Title: {book_structure['title']}
Themes: {', '.join(book_structure['themes'])}
Tone: {book_structure['tone']}
Unique Angle: {book_structure.get('unique_angle', 'Distinctive perspective')}

PROFESSIONAL STANDARDS:
- Every sentence must earn its place
- Hook readers within the first paragraph
- Establish voice, world, and stakes immediately
- Create a reading experience that feels PUBLISHED, not generated
- Use vivid, specific language that creates imagery
- Vary sentence structure for natural rhythm
- Build momentum that makes the next page irresistible"""

        first_page_outline = book_structure['outline'][0]

        user_prompt = f"""You're writing the OPENING PAGE of a professionally published book. This page will determine if readers continue or close the book forever.

STRUCTURAL BLUEPRINT:
Page {first_page_outline['page_number']}: {first_page_outline['section']}
Mission: {first_page_outline['content_brief']}

Original Vision: {description}

CRAFT A MASTERFUL OPENING:

📖 TITLE PRESENTATION
- Display the book title with elegant formatting (use # for main title)
- If there's a subtitle, include it (use ## for subtitle)
- Create visual hierarchy that feels professional

🎯 THE HOOK (First Paragraph)
This paragraph must be IRRESISTIBLE. Use one of these proven techniques:
- Intriguing question that demands an answer
- Vivid scene that drops readers into action
- Surprising statement that challenges assumptions
- Emotional moment that creates instant connection
- Mystery that begs to be solved

✨ TONE & ATMOSPHERE
- Establish the book's unique voice within 3 sentences
- Use sensory details that make the content VIVID
- Create rhythm through varied sentence lengths
- Show, don't tell wherever possible

🔗 FORWARD MOMENTUM
- End with a transition that makes Page 2 inevitable
- Plant questions or curiosity gaps
- Create anticipation for what's coming

WRITING QUALITY STANDARDS:
❌ NO generic openings like "Welcome to..." or "In this book..."
❌ NO telling readers what they'll learn (show through story/example)
❌ NO robotic AI language patterns or corporate speak
✅ YES to specific, concrete details instead of abstractions
✅ YES to personality and distinctive voice
✅ YES to professional formatting with proper markdown
✅ YES to prose that would pass a publisher's editorial review

Write the complete first page NOW. Make it unforgettable."""

        content = await self.client.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2000,
            temperature=0.8
        )

        return {
            "page_number": 1,
            "section": first_page_outline['section'],
            "content": content.strip(),
            "is_title_page": True
        }

    async def generate_next_page(
        self,
        book_structure: Dict,
        current_page: int,
        previous_pages: list,
        user_input: Optional[str] = None
    ) -> Dict:
        """
        Generate the next page with autopublisher polish and professional flow

        Args:
            book_structure: The book structure
            current_page: Current page number (0-indexed in list)
            previous_pages: List of previously generated pages
            user_input: Optional user guidance for this page

        Returns:
            Dict containing page number and content
        """

        if current_page >= len(book_structure['outline']):
            raise ValueError("Page number exceeds book outline")

        page_outline = book_structure['outline'][current_page]
        page_number = page_outline['page_number']

        # Build enhanced context from previous pages with coherence tracking
        context = self._build_page_context(
            previous_pages=previous_pages,
            book_structure=book_structure,
            current_page_number=page_number,
            max_pages=10  # Expanded from 3 to 10 for better continuity
        )

        system_prompt = f"""You are an AWARD-WINNING author and PROFESSIONAL EDITOR combined. Every page you write goes through an internal "autopublisher" quality filter.

BOOK DNA:
Title: {book_structure['title']}
Themes: {', '.join(book_structure['themes'])}
Tone: {book_structure['tone']}
Unique Angle: {book_structure.get('unique_angle', 'Distinctive perspective')}

AUTOPUBLISHER STANDARDS:
✅ CONTINUITY: Seamlessly continue from previous pages (don't restart or repeat)
✅ PROGRESSION: Advance the narrative/information meaningfully
✅ TRANSITIONS: Start with elegant connection to previous page
✅ VARIETY: Vary sentence structure, paragraph length, pacing
✅ VOICE: Maintain consistent authorial voice throughout
✅ ENGAGEMENT: Every paragraph must add value or advance the story
✅ FORMATTING: Professional markdown (headings, emphasis, structure)
✅ POLISH: Remove AI-isms, repetition, generic phrases
✅ PACING: Know when to slow down for detail, speed up for momentum

This page must feel like it was written by the SAME AUTHOR who wrote the previous pages, then EDITED BY A PROFESSIONAL for publication."""

        user_prompt = f"""Write Page {page_outline['page_number']} as part of this professionally published book.

📄 PAGE MISSION:
Section: {page_outline['section']}
Goal: {page_outline['content_brief']}

📚 STORY SO FAR:
{context}

🎯 AUTOPUBLISHER CHECKLIST FOR THIS PAGE:

1. SEAMLESS OPENING
- Start with a natural transition from the last page (subtle callback or flow)
- NO jarring restarts or "Now let's talk about..."
- Continue the momentum established

2. CORE CONTENT DELIVERY
- Fulfill the page's mission ({page_outline['content_brief']})
- Use specific examples, vivid details, or concrete scenes
- Advance character development OR information architecture
- Maintain emotional/intellectual engagement

3. STRUCTURAL VARIETY
- Mix paragraph lengths (short for impact, longer for immersion)
- Vary sentence structure (simple, compound, complex)
- Use formatting strategically (## for subheadings, ** for emphasis)
- Consider bullet points ONLY if listing specific items naturally

4. VOICE & QUALITY
- Sound like a REAL AUTHOR, not an AI
- Eliminate phrases like "it's important to note" or "remember that"
- Use active voice predominantly
- Show through examples rather than explaining

5. PAGE ENDING
- Create a natural stopping point that invites turning to next page
- Plant a question, create anticipation, or hint at what's coming
- NO abrupt endings or meta-commentary"""

        if user_input:
            user_prompt += f"""

🎨 USER CREATIVE DIRECTION:
{user_input}
(Incorporate this guidance while maintaining professional quality)
"""

        user_prompt += f"""

Now write Page {page_outline['page_number']} with AUTOPUBLISHER EXCELLENCE.

Remember: This will be sold on marketplaces like Amazon and Etsy. It must compete with traditionally published books. Make every word count."""

        content = await self.client.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2000,
            temperature=0.8
        )

        page_data = {
            "page_number": page_outline['page_number'],
            "section": page_outline['section'],
            "content": content.strip(),
            "is_title_page": False
        }

        # Extract story elements for coherence tracking (background task)
        print(f"[COHERENCE] Extracting story elements from page {page_number}...", flush=True)
        try:
            extracted_elements = await self.coherence_tracker.extract_story_elements(
                page_content=content.strip(),
                page_number=page_number,
                section=page_outline['section'],
                ai_client=self.client
            )

            # Update coherence tracking in book structure
            book_structure = self.coherence_tracker.update_tracking(
                book_structure=book_structure,
                page_number=page_number,
                extracted_elements=extracted_elements
            )

            # Check if we should update the rolling summary
            tracking = book_structure.get('coherence_tracking', {})
            last_summary_page = tracking.get('last_summary_page', 0)

            if self.coherence_tracker.should_update_summary(page_number, last_summary_page):
                print(f"[COHERENCE] Updating story summary (page {page_number})...", flush=True)
                updated_summary = await self.coherence_tracker.generate_rolling_summary(
                    previous_pages=previous_pages + [page_data],  # Include current page
                    current_summary=tracking.get('story_summary', ''),
                    last_summary_page=last_summary_page,
                    current_page=page_number,
                    ai_client=self.client
                )

                book_structure['coherence_tracking']['story_summary'] = updated_summary
                book_structure['coherence_tracking']['last_summary_page'] = page_number
                print(f"[COHERENCE] Summary updated successfully", flush=True)

            # Return updated structure along with page data
            page_data['updated_structure'] = book_structure

        except Exception as e:
            print(f"[COHERENCE] Warning: Failed to extract story elements: {str(e)}", flush=True)
            # Continue anyway - coherence is enhancement, not critical

        return page_data

    async def generate_book_stream(
        self,
        description: str,
        target_pages: int,
        book_type: str = "general"
    ) -> AsyncGenerator[Dict, None]:
        """
        Stream the book generation process

        Yields status updates as each step completes
        """

        try:
            # Stage 1: Generate structure
            yield {
                "stage": "structure",
                "status": "generating",
                "message": "Creating book outline and structure..."
            }

            structure = await self.generate_book_structure(
                description=description,
                target_pages=target_pages,
                book_type=book_type
            )

            yield {
                "stage": "structure",
                "status": "complete",
                "data": structure
            }

            # Stage 2: Generate first page
            yield {
                "stage": "first_page",
                "status": "generating",
                "message": "Writing the first page..."
            }

            first_page = await self.generate_first_page(structure, description)

            yield {
                "stage": "first_page",
                "status": "complete",
                "data": first_page
            }

            # Send completion
            yield {
                "stage": "ready",
                "status": "complete",
                "message": "Book initialized! You can now generate subsequent pages."
            }

        except Exception as e:
            yield {
                "stage": "error",
                "status": "failed",
                "error": str(e)
            }

    def _get_structure_system_prompt(self, book_type: str) -> str:
        """Get award-winning system prompt based on book type"""

        base = """You are a MASTER BOOK ARCHITECT who has structured dozens of bestselling books. Your outlines have launched careers and won awards. You understand story/information architecture at the deepest level."""

        type_specific = {
            "kids": """

CHILDREN'S BOOK SPECIALIZATION:
- Age-appropriate language that respects young intelligence
- Rhythm and repetition that aids memory and engagement
- Visual story beats that translate well to illustration
- Emotional resonance that teaches without preaching
- Page turns that create anticipation ("What happens next?")
- Educational value woven into entertainment seamlessly
- Character voices that children want to read aloud
- Endings that satisfy while encouraging rereading

Reference Level: Eric Carle, Dr. Seuss, Mo Willems excellence""",

            "adult": """

ADULT BOOK SPECIALIZATION:
- Sophisticated thematic layering with depth
- Complex character psychology and development arcs
- Nuanced exploration of ideas without oversimplification
- Pacing that respects reader intelligence
- Prose that balances accessibility with literary quality
- Emotional authenticity that resonates with adult experiences
- Cultural/historical/philosophical depth when relevant
- Endings that provide catharsis while inviting reflection

Reference Level: Published literary fiction or high-quality non-fiction""",

            "educational": """

EDUCATIONAL BOOK SPECIALIZATION:
- Clear learning objectives disguised as engaging content
- Scaffolded information that builds systematically
- Multiple explanation approaches for different learning styles
- Real-world applications and concrete examples
- Retention strategies built into narrative structure
- Balance between challenge and accessibility
- Actionable takeaways at natural intervals
- Ending that creates competence and confidence

Reference Level: Malcolm Gladwell, James Clear, Carol Dweck quality""",

            "general": """

GENERAL AUDIENCE SPECIALIZATION:
- Broad accessibility without dumbing down
- Universal themes that cross demographics
- Engaging narrative or information flow for varied readers
- Professional craft that holds up to critical reading
- Market awareness (what sells on Amazon/Etsy/bookstores)
- Voice that feels authentic and human
- Structure that serves both casual and serious readers

Reference Level: Mainstream published books that succeed commercially and critically"""
        }

        return base + type_specific.get(book_type, type_specific["general"])

    async def generate_book_cover_svg(
        self,
        book_title: str,
        book_themes: list,
        book_tone: str,
        book_type: str = "general"
    ) -> str:
        """
        Generate a professional SVG book cover using AI

        Args:
            book_title: The title of the book
            book_themes: List of themes in the book
            book_tone: The tone/style of the book
            book_type: Type of book (kids, adult, educational, general)

        Returns:
            SVG code as a string
        """

        system_prompt = """You are an AWARD-WINNING graphic designer specializing in book cover design. You create stunning, professional SVG book covers that would sell on Amazon, Etsy, and bookstores.

DESIGN PRINCIPLES:
- Professional typography with hierarchy
- Elegant color schemes that match the book's mood
- Balanced composition with negative space
- Market-ready design that attracts readers
- SVG code that is clean, valid, and renders perfectly"""

        user_prompt = f"""Design a PROFESSIONAL book cover in SVG format for this book:

BOOK DETAILS:
Title: {book_title}
Themes: {', '.join(book_themes)}
Tone: {book_tone}
Type: {book_type}

CRITICAL DESIGN REQUIREMENTS:

📐 DIMENSIONS (MUST FOLLOW EXACTLY):
- SVG must have: width="800" height="1200" viewBox="0 0 800 1200"
- PORTRAIT orientation ONLY (taller than wide)
- ALL content must fit within the 800x1200 viewBox
- Use margins: minimum 60px from all edges
- Safe area for text: x=60 to x=740, y=100 to y=1100

🎨 VISUAL ELEMENTS:
- Eye-catching title typography (large, bold, readable)
- Title positioned in upper-middle area (y=200-500)
- Elegant background (gradient, pattern, or solid with texture)
- Optional subtitle below title
- Thematic visual elements that reflect the book's content
- Professional color palette (3-5 colors maximum)
- All elements must stay within viewBox bounds

✨ STYLE GUIDELINES:
{"- Kid-friendly with bright colors, playful fonts, and whimsical illustrations" if book_type == "kids" else ""}
{"- Sophisticated adult design with elegant typography and mature aesthetic" if book_type == "adult" else ""}
{"- Clean educational design with clear hierarchy and professional look" if book_type == "educational" else ""}
{"- Versatile general market design that appeals broadly" if book_type == "general" else ""}

🎯 TYPOGRAPHY:
- Title should be the dominant element, sized 48-72px
- Center-align text horizontally (x=400, text-anchor="middle")
- Use web-safe fonts (Arial, Helvetica, Times, Georgia, or similar)
- Excellent contrast for readability (light text on dark bg or vice versa)
- Break long titles into multiple lines within the safe area

⚠️ CRITICAL RULES:
1. SVG MUST start with: <svg width="800" height="1200" viewBox="0 0 800 1200" xmlns="http://www.w3.org/2000/svg">
2. ALL coordinates must be within 0-800 (x) and 0-1200 (y)
3. NO content should extend beyond these bounds
4. Design for PORTRAIT/VERTICAL orientation (like a real book cover)

DELIVER:
Output ONLY the complete SVG code. No markdown fences, no explanations. Just the raw SVG starting with <svg> and ending with </svg>.

The cover should look like it was designed by a professional for a published book in PORTRAIT orientation."""

        response = await self.client.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=3000,
            temperature=0.8
        )

        # Extract SVG from response (in case it's wrapped)
        svg_code = response.strip()

        # Remove markdown fences if present
        if "```svg" in svg_code:
            start = svg_code.find("```svg") + 6
            end = svg_code.find("```", start)
            svg_code = svg_code[start:end].strip()
        elif "```" in svg_code:
            start = svg_code.find("```") + 3
            end = svg_code.find("```", start)
            svg_code = svg_code[start:end].strip()

        # Ensure it starts with <svg
        if not svg_code.startswith("<svg"):
            # Try to find the SVG tag
            svg_start = svg_code.find("<svg")
            if svg_start != -1:
                svg_code = svg_code[svg_start:]

        return svg_code

    async def generate_book_cover_image(
        self,
        book_title: str,
        book_themes: list,
        book_tone: str,
        book_type: str = "general"
    ) -> str:
        """
        Generate a professional book cover using DALL-E 3

        Args:
            book_title: The title of the book
            book_themes: List of themes in the book
            book_tone: The tone/style of the book
            book_type: Type of book (kids, adult, educational, general)

        Returns:
            Base64-encoded PNG image data
        """

        # Build a detailed prompt for DALL-E
        type_styles = {
            "kids": "whimsical, colorful, playful children's book illustration style",
            "adult": "sophisticated, elegant, mature literary fiction cover design",
            "educational": "clean, professional, modern educational book design",
            "general": "professional, eye-catching mainstream book cover design"
        }

        style = type_styles.get(book_type, type_styles["general"])

        prompt = f"""Create an artistic desktop wallpaper design.
Style: {style}.
Themes: {', '.join(book_themes)}.
Mood: {book_tone}.

CRITICAL RULES:
- This is a DESKTOP WALLPAPER / ARTISTIC BACKGROUND only
- ABSOLUTELY NO text, letters, words, books, signs, labels, or writing
- NO book covers, book spines, posters, newspapers, or text-bearing objects
- Create abstract patterns, textures, thematic imagery, or atmospheric scenes
- Think: watercolor art, gradient designs, nature scenes, abstract patterns
- Professional digital art quality
- Rich, vibrant colors
- Evocative of the themes and mood listed above"""

        # Generate image with DALL-E (returns base64 directly)
        result = await self.openai_client.generate_image(
            prompt=prompt,
            size="1024x1792",  # Portrait orientation for book cover
            quality="hd"
        )

        # Return the base64 image data directly from DALL-E
        return result["b64_json"]

    def _build_page_context(
        self,
        previous_pages: list,
        book_structure: Dict,
        current_page_number: int,
        max_pages: int = 10
    ) -> str:
        """
        Build enhanced context string from previous pages using coherence tracking

        Args:
            previous_pages: All previously generated pages
            book_structure: Book structure with coherence tracking
            current_page_number: Current page being generated
            max_pages: Number of recent pages to include in detail (default: 10)

        Returns:
            Enhanced context string with story summary, character tracking, etc.
        """

        # Use coherence tracker to build comprehensive context
        return self.coherence_tracker.build_enhanced_context(
            previous_pages=previous_pages,
            book_structure=book_structure,
            current_page_number=current_page_number,
            max_recent_pages=max_pages
        )
