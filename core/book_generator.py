from typing import AsyncGenerator, Dict, Optional
import json
from .claude_client import ClaudeClient


class BookGenerator:
    """AI-powered book generation engine"""

    def __init__(self, api_key: Optional[str] = None):
        self.claude = ClaudeClient(api_key=api_key)

    async def generate_book_structure(
        self,
        description: str,
        target_pages: int,
        book_type: str = "general"
    ) -> Dict:
        """
        Generate initial book structure and outline

        Args:
            description: User's description of the book
            target_pages: Desired number of pages
            book_type: Type of book (kids, adult, educational)

        Returns:
            Dict containing book title, outline, and metadata
        """

        system_prompt = self._get_structure_system_prompt(book_type)

        user_prompt = f"""Create a comprehensive book structure for the following:

Description: {description}
Target Pages: {target_pages}
Book Type: {book_type}

Generate a complete book outline with:
1. A compelling title
2. Chapter/page structure that fits exactly {target_pages} pages
3. Brief summary of what each page should cover
4. Key themes and narrative arc

Return as JSON with this exact structure:
{{
    "title": "Book Title Here",
    "subtitle": "Optional Subtitle",
    "target_pages": {target_pages},
    "outline": [
        {{
            "page_number": 1,
            "section": "Introduction/Chapter Name",
            "content_brief": "What this page covers"
        }}
    ],
    "themes": ["theme1", "theme2"],
    "tone": "description of tone and style"
}}"""

        response = await self.claude.generate(
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
        Generate the first page (title page and introduction)

        Args:
            book_structure: The book structure from generate_book_structure
            description: Original book description

        Returns:
            Dict containing page number and content
        """

        system_prompt = f"""You are a professional book writer creating engaging content.

Book Title: {book_structure['title']}
Themes: {', '.join(book_structure['themes'])}
Tone: {book_structure['tone']}

Write compelling, well-structured content that draws readers in from the very first page.
Use proper formatting, engaging language, and maintain consistency with the book's themes."""

        first_page_outline = book_structure['outline'][0]

        user_prompt = f"""Write the first page of the book based on this outline:

Page {first_page_outline['page_number']}: {first_page_outline['section']}
Content Focus: {first_page_outline['content_brief']}

Original Book Concept: {description}

Create an engaging opening that includes:
- The book title prominently displayed
- An introduction that hooks the reader
- Sets the tone and theme
- Flows naturally into the story/content

Write the complete content for this page. Make it compelling and professional."""

        content = await self.claude.generate(
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
        Generate the next page in the book

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

        # Build context from previous pages
        context = self._build_page_context(previous_pages, max_pages=3)

        system_prompt = f"""You are a professional book writer creating engaging content.

Book Title: {book_structure['title']}
Themes: {', '.join(book_structure['themes'])}
Tone: {book_structure['tone']}

Maintain consistency with previous pages while advancing the narrative/information.
Use proper transitions and keep the reader engaged."""

        user_prompt = f"""Write page {page_outline['page_number']} of the book.

Section: {page_outline['section']}
Content Focus: {page_outline['content_brief']}

Previous Pages Context:
{context}
"""

        if user_input:
            user_prompt += f"\nUser Guidance for This Page: {user_input}\n"

        user_prompt += "\nWrite the complete, engaging content for this page. Ensure it flows naturally from previous content."

        content = await self.claude.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2000,
            temperature=0.8
        )

        return {
            "page_number": page_outline['page_number'],
            "section": page_outline['section'],
            "content": content.strip(),
            "is_title_page": False
        }

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
        """Get system prompt based on book type"""

        base = "You are an expert book planner and outline creator."

        type_specific = {
            "kids": " Specialize in children's books with age-appropriate content, engaging narratives, and educational value.",
            "adult": " Specialize in adult fiction and non-fiction with sophisticated themes and complex narratives.",
            "educational": " Specialize in educational content that teaches effectively while remaining engaging.",
            "general": " Create well-structured, engaging books for a general audience."
        }

        return base + type_specific.get(book_type, type_specific["general"])

    def _build_page_context(self, previous_pages: list, max_pages: int = 3) -> str:
        """Build context string from previous pages"""

        if not previous_pages:
            return "This is the first page of the book."

        # Get last N pages for context (prioritize more recent pages)
        recent_pages = previous_pages[-max_pages:]

        context_parts = []
        for page in recent_pages:
            # Get full content for better context
            content = page.get('content', '')

            # Truncate only if extremely long (over 1000 chars)
            if len(content) > 1000:
                content = content[:1000] + "..."

            context_parts.append(
                f"Page {page.get('page_number', 'N/A')} - {page.get('section', 'Untitled')}:\n{content}"
            )

        context_str = "\n\n---\n\n".join(context_parts)
        return f"Here is what has been written so far:\n\n{context_str}"
