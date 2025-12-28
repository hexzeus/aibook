"""
Audiobook Service using ElevenLabs API for text-to-speech
"""
from typing import Dict, List, Optional
import os
import requests
import base64
from io import BytesIO


class AudiobookService:
    def __init__(self):
        self.api_key = os.getenv('ELEVENLABS_API_KEY')
        self.base_url = "https://api.elevenlabs.io/v1"

        # Popular voices for different book types
        self.voice_presets = {
            'male_narrator': {
                'voice_id': 'TxGEqnHWrfWFTfGW9XjX',  # Josh - Deep American male
                'name': 'Josh',
                'description': 'Deep, warm male voice - great for general narration'
            },
            'female_narrator': {
                'voice_id': 'EXAVITQu4vr4xnSDxMaL',  # Bella - Soft American female
                'name': 'Bella',
                'description': 'Soft, expressive female voice - ideal for fiction'
            },
            'british_male': {
                'voice_id': 'pNInz6obpgDQGcFmaJgB',  # Adam - British male
                'name': 'Adam',
                'description': 'Professional British male - perfect for non-fiction'
            },
            'young_female': {
                'voice_id': 'jsCqWAovK2LkecY7zXl4',  # Freya - Young American female
                'name': 'Freya',
                'description': 'Youthful, energetic female - great for YA and children\'s books'
            },
            'calm_male': {
                'voice_id': 'onwK4e9ZLuTAKqWW03F9',  # Daniel - Calm British male
                'name': 'Daniel',
                'description': 'Calm, authoritative British male - ideal for educational content'
            }
        }

    def get_available_voices(self) -> List[Dict]:
        """Get all available voices from ElevenLabs"""

        if not self.api_key:
            return list(self.voice_presets.values())

        try:
            headers = {"xi-api-key": self.api_key}
            response = requests.get(f"{self.base_url}/voices", headers=headers)

            if response.status_code == 200:
                voices = response.json().get('voices', [])
                return [{
                    'voice_id': v['voice_id'],
                    'name': v['name'],
                    'description': v.get('description', ''),
                    'category': v.get('category', 'general')
                } for v in voices]
        except:
            pass

        return list(self.voice_presets.values())

    def text_to_speech(
        self,
        text: str,
        voice_id: str = 'TxGEqnHWrfWFTfGW9XjX',  # Default to Josh
        model_id: str = 'eleven_multilingual_v2',
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.0,
        use_speaker_boost: bool = True
    ) -> bytes:
        """Convert text to speech using ElevenLabs"""

        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY not configured")

        url = f"{self.base_url}/text-to-speech/{voice_id}"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "use_speaker_boost": use_speaker_boost
            }
        }

        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 200:
            raise Exception(f"ElevenLabs API error: {response.status_code} - {response.text}")

        return response.content

    def generate_audiobook_chapter(
        self,
        chapter_text: str,
        voice_preset: str = 'male_narrator',
        chunk_size: int = 5000
    ) -> List[bytes]:
        """Generate audio for a chapter, splitting into chunks if needed"""

        voice_config = self.voice_presets.get(voice_preset, self.voice_presets['male_narrator'])
        voice_id = voice_config['voice_id']

        # Split text into chunks (ElevenLabs has character limits)
        chunks = self._split_text_into_chunks(chapter_text, chunk_size)

        audio_chunks = []

        for chunk in chunks:
            if chunk.strip():
                audio_data = self.text_to_speech(
                    text=chunk,
                    voice_id=voice_id
                )
                audio_chunks.append(audio_data)

        return audio_chunks

    def _split_text_into_chunks(self, text: str, max_chunk_size: int) -> List[str]:
        """Split text into chunks at sentence boundaries"""

        sentences = text.replace('\n\n', ' [PARAGRAPH] ').split('. ')
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            sentence = sentence.strip()

            if not sentence:
                continue

            # Add period back if it's not a paragraph marker
            if not sentence.endswith('[PARAGRAPH]'):
                sentence += '.'
            else:
                sentence = sentence.replace('[PARAGRAPH]', '\n\n')

            # Check if adding this sentence exceeds chunk size
            if len(current_chunk) + len(sentence) > max_chunk_size and current_chunk:
                chunks.append(current_chunk)
                current_chunk = sentence
            else:
                current_chunk += " " + sentence if current_chunk else sentence

        # Add remaining chunk
        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def combine_audio_chunks(self, audio_chunks: List[bytes]) -> bytes:
        """Combine multiple audio chunks into a single audio file"""

        # For MP3 files, we can simply concatenate
        combined = b''.join(audio_chunks)
        return combined

    def generate_full_audiobook(
        self,
        pages: List[Dict],
        voice_preset: str = 'male_narrator',
        include_page_numbers: bool = False
    ) -> Dict[str, bytes]:
        """Generate complete audiobook from all pages"""

        audiobook_parts = {}

        for page in pages:
            page_num = page.get('page_number', 0)
            content = page.get('content', '')

            # Optionally add page number announcement
            if include_page_numbers and page_num > 0:
                content = f"Page {page_num}. {content}"

            # Generate audio
            audio_chunks = self.generate_audiobook_chapter(
                chapter_text=content,
                voice_preset=voice_preset
            )

            # Combine chunks for this page
            page_audio = self.combine_audio_chunks(audio_chunks)

            audiobook_parts[f"page_{page_num:03d}"] = page_audio

        return audiobook_parts

    def get_voice_preview(self, voice_id: str, sample_text: str = None) -> bytes:
        """Generate a preview of a voice"""

        if not sample_text:
            sample_text = "Hello! This is a preview of this voice. I'll be narrating your book with clarity and emotion, bringing your story to life for your listeners."

        return self.text_to_speech(
            text=sample_text,
            voice_id=voice_id
        )

    def estimate_audiobook_duration(self, total_words: int, words_per_minute: int = 150) -> Dict:
        """Estimate audiobook duration based on word count"""

        total_minutes = total_words / words_per_minute
        hours = int(total_minutes // 60)
        minutes = int(total_minutes % 60)

        return {
            "total_words": total_words,
            "estimated_minutes": round(total_minutes, 1),
            "formatted_duration": f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m",
            "hours": hours,
            "minutes": minutes
        }

    def get_character_cost(self, text: str) -> Dict:
        """Estimate cost based on character count"""

        char_count = len(text)

        # ElevenLabs pricing (approximate)
        # Free tier: 10,000 chars/month
        # Starter: $5 for 30,000 chars
        # Creator: $22 for 100,000 chars
        # Pro: $99 for 500,000 chars

        cost_per_1k_chars = 0.15  # Approximate average

        estimated_cost = (char_count / 1000) * cost_per_1k_chars

        return {
            "character_count": char_count,
            "estimated_cost_usd": round(estimated_cost, 2),
            "tier_recommendation": self._get_tier_recommendation(char_count)
        }

    def _get_tier_recommendation(self, char_count: int) -> str:
        """Recommend ElevenLabs pricing tier based on character count"""

        if char_count <= 10000:
            return "Free tier sufficient"
        elif char_count <= 30000:
            return "Starter tier recommended ($5)"
        elif char_count <= 100000:
            return "Creator tier recommended ($22)"
        elif char_count <= 500000:
            return "Pro tier recommended ($99)"
        else:
            return "Enterprise tier required"

    def create_audiobook_package(
        self,
        book_title: str,
        pages: List[Dict],
        voice_preset: str = 'male_narrator',
        output_format: str = 'mp3'
    ) -> Dict:
        """Create a complete audiobook package with metadata"""

        # Generate all audio
        audio_parts = self.generate_full_audiobook(pages, voice_preset)

        # Combine all parts
        all_audio = [audio_parts[key] for key in sorted(audio_parts.keys())]
        full_audiobook = self.combine_audio_chunks(all_audio)

        # Calculate total word count
        total_words = sum(len(page.get('content', '').split()) for page in pages)

        # Get duration estimate
        duration_info = self.estimate_audiobook_duration(total_words)

        return {
            "title": book_title,
            "audio_data": full_audiobook,
            "audio_format": output_format,
            "file_size_mb": round(len(full_audiobook) / (1024 * 1024), 2),
            "duration": duration_info,
            "voice_used": voice_preset,
            "total_pages": len(pages),
            "total_words": total_words
        }
