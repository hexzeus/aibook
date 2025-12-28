"""
Translation Service using Claude AI for high-quality book translations
"""
from typing import Dict, List, Optional
import os
from anthropic import Anthropic


class TranslationService:
    def __init__(self):
        self.client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.supported_languages = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese (Simplified)',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'nl': 'Dutch',
            'pl': 'Polish',
            'sv': 'Swedish',
            'tr': 'Turkish'
        }

    def get_supported_languages(self) -> Dict[str, str]:
        """Get list of supported languages"""
        return self.supported_languages

    def translate_text(
        self,
        text: str,
        target_language: str,
        source_language: str = 'en',
        context: Optional[str] = None,
        preserve_formatting: bool = True
    ) -> str:
        """Translate text using Claude AI"""

        if target_language not in self.supported_languages:
            raise ValueError(f"Unsupported target language: {target_language}")

        target_lang_name = self.supported_languages[target_language]

        prompt = f"""Translate the following text from English to {target_lang_name}.

CRITICAL INSTRUCTIONS:
- Maintain the literary quality and tone of the original text
- Preserve the emotional impact and nuance
- Keep character names unchanged unless culturally appropriate to adapt
- Maintain paragraph breaks and formatting{"" if preserve_formatting else " (you may adjust formatting for clarity)"}
- Use natural, native-sounding language
- For children's books, use age-appropriate vocabulary in the target language
- Do NOT add explanations or notes - only provide the translation

{f"CONTEXT: {context}" if context else ""}

TEXT TO TRANSLATE:
{text}

TRANSLATION:"""

        message = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            temperature=0.3,  # Lower temperature for more consistent translations
            messages=[{"role": "user", "content": prompt}]
        )

        translation = message.content[0].text.strip()

        return translation

    def translate_book_page(
        self,
        page_content: str,
        target_language: str,
        book_genre: Optional[str] = None,
        age_range: Optional[str] = None
    ) -> str:
        """Translate a book page with book-specific context"""

        context = ""
        if book_genre:
            context += f"Genre: {book_genre}. "
        if age_range:
            context += f"Target age range: {age_range}. "

        return self.translate_text(
            text=page_content,
            target_language=target_language,
            context=context,
            preserve_formatting=True
        )

    def translate_book_metadata(
        self,
        title: str,
        subtitle: Optional[str],
        description: Optional[str],
        target_language: str
    ) -> Dict[str, str]:
        """Translate book metadata (title, subtitle, description)"""

        result = {}

        # Translate title
        result['title'] = self.translate_text(
            text=title,
            target_language=target_language,
            preserve_formatting=False
        )

        # Translate subtitle if provided
        if subtitle:
            result['subtitle'] = self.translate_text(
                text=subtitle,
                target_language=target_language,
                preserve_formatting=False
            )

        # Translate description if provided
        if description:
            result['description'] = self.translate_text(
                text=description,
                target_language=target_language,
                preserve_formatting=True
            )

        return result

    def batch_translate_pages(
        self,
        pages: List[Dict],
        target_language: str,
        book_context: Optional[Dict] = None
    ) -> List[Dict]:
        """Translate multiple pages in batch"""

        translated_pages = []

        context = ""
        if book_context:
            if book_context.get('genre'):
                context += f"Genre: {book_context['genre']}. "
            if book_context.get('age_range'):
                context += f"Age range: {book_context['age_range']}. "

        for page in pages:
            translated_content = self.translate_text(
                text=page['content'],
                target_language=target_language,
                context=context,
                preserve_formatting=True
            )

            translated_pages.append({
                'page_number': page['page_number'],
                'section': page.get('section', ''),
                'content': translated_content,
                'original_content': page['content']
            })

        return translated_pages

    def detect_language(self, text: str) -> Dict[str, str]:
        """Detect the language of a text using Claude"""

        prompt = f"""What language is this text written in? Respond with ONLY the language name and ISO 639-1 code in this exact format: "Language: code"

For example: "Spanish: es" or "French: fr"

Text:
{text[:500]}"""  # Only analyze first 500 chars

        message = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=50,
            messages=[{"role": "user", "content": prompt}]
        )

        response = message.content[0].text.strip()

        # Parse response
        try:
            if ':' in response:
                lang_name, lang_code = response.split(':')
                return {
                    'language': lang_name.strip(),
                    'code': lang_code.strip()
                }
        except:
            pass

        return {'language': 'Unknown', 'code': 'unknown'}

    def validate_translation_quality(
        self,
        original: str,
        translation: str,
        target_language: str
    ) -> Dict:
        """Validate translation quality using Claude"""

        target_lang_name = self.supported_languages.get(target_language, target_language)

        prompt = f"""Compare this translation quality. Rate it on:
1. Accuracy (1-10)
2. Fluency (1-10)
3. Tone preservation (1-10)

ORIGINAL (English):
{original[:1000]}

TRANSLATION ({target_lang_name}):
{translation[:1000]}

Respond in JSON format:
{{
  "accuracy": <score>,
  "fluency": <score>,
  "tone": <score>,
  "overall": <average>,
  "notes": "<brief assessment>"
}}"""

        message = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text.strip()

        # Parse JSON response
        import json
        try:
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()

            return json.loads(response_text)
        except:
            return {
                "accuracy": 0,
                "fluency": 0,
                "tone": 0,
                "overall": 0,
                "notes": "Unable to parse quality assessment"
            }

    def get_translation_preview(
        self,
        text: str,
        target_language: str,
        max_length: int = 500
    ) -> str:
        """Get a preview translation of the first N characters"""

        preview_text = text[:max_length]

        if len(text) > max_length:
            preview_text += "..."

        return self.translate_text(
            text=preview_text,
            target_language=target_language,
            preserve_formatting=False
        )
