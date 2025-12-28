"""
Style Analyzer - Extract writing style patterns from sample text
Uses Claude AI to analyze and generate style profiles
"""
from typing import Dict, Optional
import anthropic
import os


class StyleAnalyzer:
    """Analyze writing style from sample text and generate style profiles"""

    # Famous author style presets
    AUTHOR_PRESETS = {
        'stephen_king': {
            'name': 'Stephen King',
            'tone': 'conversational, suspenseful, direct',
            'vocabulary_level': 'accessible',
            'sentence_style': 'varied, punchy dialogue, immersive descriptions',
            'characteristics': 'Strong character voice, builds tension gradually, colloquial language, present-tense urgency'
        },
        'jk_rowling': {
            'name': 'J.K. Rowling',
            'tone': 'whimsical, detailed, adventurous',
            'vocabulary_level': 'accessible with magical terminology',
            'sentence_style': 'descriptive, flowing, world-building focused',
            'characteristics': 'Rich world-building, character-driven, detailed descriptions, British expressions'
        },
        'malcolm_gladwell': {
            'name': 'Malcolm Gladwell',
            'tone': 'analytical, story-driven, thought-provoking',
            'vocabulary_level': 'sophisticated but accessible',
            'sentence_style': 'anecdote-based, research-supported, conversational academic',
            'characteristics': 'Opens with stories, weaves research seamlessly, counterintuitive insights, accessible science'
        },
        'hemingway': {
            'name': 'Ernest Hemingway',
            'tone': 'sparse, direct, understated',
            'vocabulary_level': 'simple',
            'sentence_style': 'short, declarative, minimal adjectives',
            'characteristics': 'Iceberg theory, show don\'t tell, masculine prose, minimal description'
        },
        'jane_austen': {
            'name': 'Jane Austen',
            'tone': 'witty, satirical, elegant',
            'vocabulary_level': 'sophisticated, period-appropriate',
            'sentence_style': 'long, elaborate, balanced',
            'characteristics': 'Social commentary, irony, free indirect discourse, formal dialogue'
        },
        'neil_gaiman': {
            'name': 'Neil Gaiman',
            'tone': 'mythical, dark, lyrical',
            'vocabulary_level': 'varied, poetic',
            'sentence_style': 'flowing, atmospheric, folklore-inspired',
            'characteristics': 'Mythology references, dream-like quality, modern fairy tales, subtle horror'
        },
        'nora_roberts': {
            'name': 'Nora Roberts',
            'tone': 'romantic, fast-paced, emotional',
            'vocabulary_level': 'accessible',
            'sentence_style': 'dialogue-heavy, action-driven, sensory',
            'characteristics': 'Strong chemistry, quick pacing, multiple subplots, satisfying endings'
        },
        'james_patterson': {
            'name': 'James Patterson',
            'tone': 'fast-paced, thriller-focused, cliffhanger-driven',
            'vocabulary_level': 'simple',
            'sentence_style': 'extremely short chapters, one-sentence paragraphs, rapid fire',
            'characteristics': 'Page-turner structure, constant action, short punchy sentences, multiple POVs'
        }
    }

    TONE_OPTIONS = {
        'formal': 'Professional, academic, structured',
        'casual': 'Conversational, friendly, relaxed',
        'poetic': 'Lyrical, metaphorical, flowing',
        'humorous': 'Witty, playful, entertaining',
        'dramatic': 'Intense, emotional, theatrical',
        'matter-of-fact': 'Direct, no-nonsense, straightforward',
        'inspirational': 'Uplifting, motivational, hopeful',
        'dark': 'Moody, atmospheric, serious'
    }

    VOCABULARY_LEVELS = {
        'grade_6': 'Elementary - Simple words, short sentences',
        'grade_8': 'Middle School - Conversational, clear',
        'grade_12': 'High School - Moderate complexity',
        'college': 'College - Sophisticated vocabulary',
        'academic': 'Academic - Complex, specialized terms'
    }

    SENTENCE_STYLES = {
        'short_punchy': 'Short, impactful sentences. Gets to the point.',
        'medium_balanced': 'Mix of short and medium sentences for natural flow.',
        'long_flowing': 'Longer, elaborate sentences with multiple clauses.',
        'varied_dynamic': 'Varied lengths for rhythm and emphasis.'
    }

    def __init__(self, api_key: Optional[str] = None):
        """Initialize with Anthropic API key"""
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        else:
            self.client = None

    def analyze_sample_text(self, sample_text: str) -> Dict:
        """
        Analyze a sample text to extract style patterns

        Args:
            sample_text: User's sample writing (500-5000 words ideal)

        Returns:
            Dict with analyzed patterns: {
                'tone': str,
                'vocabulary_level': str,
                'sentence_style': str,
                'avg_sentence_length': float,
                'vocabulary_richness': str,
                'common_patterns': list,
                'voice_characteristics': str
            }
        """
        if not self.client:
            # Fallback basic analysis without AI
            return self._basic_analysis(sample_text)

        # Use Claude to analyze writing style
        analysis_prompt = f"""Analyze the following writing sample and extract the author's style characteristics:

Sample text:
{sample_text[:3000]}  # Limit to 3000 chars to save tokens

Provide a JSON response with these fields:
{{
    "tone": "describe the overall tone (e.g., formal, casual, poetic, humorous)",
    "vocabulary_level": "grade level or sophistication (e.g., grade_8, college, academic)",
    "sentence_style": "describe sentence length and rhythm (e.g., short_punchy, long_flowing)",
    "avg_sentence_length": estimate average words per sentence,
    "vocabulary_richness": "simple, moderate, or sophisticated",
    "common_patterns": ["list 3-5 recurring stylistic patterns"],
    "voice_characteristics": "unique voice traits that define this writer"
}}

Respond ONLY with valid JSON, no markdown formatting."""

        try:
            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[{"role": "user", "content": analysis_prompt}]
            )

            response_text = message.content[0].text

            # Parse JSON response
            import json
            analysis = json.loads(response_text)
            return analysis

        except Exception as e:
            print(f"[STYLE] AI analysis failed: {str(e)}, using basic analysis", flush=True)
            return self._basic_analysis(sample_text)

    def _basic_analysis(self, text: str) -> Dict:
        """Basic statistical analysis without AI"""
        sentences = text.split('.')
        words = text.split()

        avg_sentence_length = len(words) / max(len(sentences), 1)

        # Simple vocabulary analysis
        unique_words = len(set(word.lower() for word in words))
        vocab_richness = "simple" if unique_words < 100 else "moderate" if unique_words < 300 else "sophisticated"

        return {
            'tone': 'neutral',
            'vocabulary_level': 'moderate',
            'sentence_style': 'short_punchy' if avg_sentence_length < 12 else 'medium_balanced' if avg_sentence_length < 18 else 'long_flowing',
            'avg_sentence_length': round(avg_sentence_length, 1),
            'vocabulary_richness': vocab_richness,
            'common_patterns': ['analysis unavailable without AI'],
            'voice_characteristics': 'analysis unavailable without AI'
        }

    def create_style_profile(
        self,
        author_preset: Optional[str] = None,
        tone: Optional[str] = None,
        vocabulary_level: Optional[str] = None,
        sentence_style: Optional[str] = None,
        sample_text: Optional[str] = None
    ) -> Dict:
        """
        Create a comprehensive style profile

        Args:
            author_preset: Key from AUTHOR_PRESETS
            tone: Key from TONE_OPTIONS
            vocabulary_level: Key from VOCABULARY_LEVELS
            sentence_style: Key from SENTENCE_STYLES
            sample_text: Optional user sample to analyze

        Returns:
            Complete style profile dict
        """
        profile = {
            'author_preset': None,
            'tone': None,
            'vocabulary_level': None,
            'sentence_style': None,
            'analyzed_patterns': None
        }

        # Apply author preset if specified
        if author_preset and author_preset in self.AUTHOR_PRESETS:
            preset = self.AUTHOR_PRESETS[author_preset]
            profile['author_preset'] = author_preset
            profile['tone'] = preset['tone']
            profile['vocabulary_level'] = preset['vocabulary_level']
            profile['sentence_style'] = preset['sentence_style']
            profile['characteristics'] = preset['characteristics']

        # Override with custom selections
        if tone:
            profile['tone'] = tone
        if vocabulary_level:
            profile['vocabulary_level'] = vocabulary_level
        if sentence_style:
            profile['sentence_style'] = sentence_style

        # Analyze sample text if provided
        if sample_text and len(sample_text) > 100:
            profile['analyzed_patterns'] = self.analyze_sample_text(sample_text)
            profile['sample_text'] = sample_text[:1000]  # Store first 1000 chars

        return profile

    def generate_style_instructions(self, style_profile: Dict) -> str:
        """
        Convert style profile into prompt instructions for book generation

        Args:
            style_profile: Style profile dict

        Returns:
            String of instructions to include in AI prompts
        """
        instructions = []

        # Author preset instructions
        if style_profile.get('author_preset'):
            preset_name = self.AUTHOR_PRESETS[style_profile['author_preset']]['name']
            characteristics = style_profile.get('characteristics', '')
            instructions.append(f"Write in the style of {preset_name}: {characteristics}")

        # Tone instructions
        if style_profile.get('tone'):
            instructions.append(f"Tone: {style_profile['tone']}")

        # Vocabulary instructions
        if style_profile.get('vocabulary_level'):
            level = style_profile['vocabulary_level']
            if level in self.VOCABULARY_LEVELS:
                instructions.append(f"Vocabulary: {self.VOCABULARY_LEVELS[level]}")
            else:
                instructions.append(f"Vocabulary level: {level}")

        # Sentence style instructions
        if style_profile.get('sentence_style'):
            style = style_profile['sentence_style']
            if style in self.SENTENCE_STYLES:
                instructions.append(f"Sentence style: {self.SENTENCE_STYLES[style]}")
            else:
                instructions.append(f"Sentence style: {style}")

        # Analyzed patterns from sample
        if style_profile.get('analyzed_patterns'):
            patterns = style_profile['analyzed_patterns']
            if patterns.get('voice_characteristics'):
                instructions.append(f"Voice: {patterns['voice_characteristics']}")
            if patterns.get('common_patterns'):
                instructions.append(f"Patterns: {', '.join(patterns['common_patterns'][:3])}")

        return "\n".join(instructions)
