import os
import httpx
import base64
from typing import Optional, Dict


class OpenAIClient:
    """Wrapper for OpenAI API with text generation and DALL-E image generation"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (api_key or os.getenv("OPEN_AI_ID", "")).strip()
        if not self.api_key:
            raise ValueError("OpenAI API key not provided")

        self.chat_url = "https://api.openai.com/v1/chat/completions"
        self.image_url = "https://api.openai.com/v1/images/generations"
        self.model = "gpt-4o"  # Latest GPT-4 model with vision
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.7,
        timeout: int = 120
    ) -> str:
        """
        Generate response from OpenAI GPT models

        Args:
            system_prompt: System instructions
            user_prompt: User message
            max_tokens: Maximum tokens to generate
            temperature: Creativity level (0-2 for OpenAI)
            timeout: Request timeout in seconds (default 120s)

        Returns:
            Generated text response

        Raises:
            Exception: On API errors or timeouts
        """

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.chat_url,
                    headers=self.headers,
                    json={
                        "model": self.model,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ]
                    }
                )

                if response.status_code != 200:
                    error_data = response.json()
                    error_message = error_data.get('error', {}).get('message', 'Unknown error')
                    raise Exception(f"OpenAI API error: {error_message}")

                result = response.json()
                return result["choices"][0]["message"]["content"]

        except httpx.TimeoutException:
            raise Exception(f"OpenAI API timeout after {timeout}s - request took too long")
        except httpx.RequestError as e:
            raise Exception(f"Network error connecting to OpenAI API: {str(e)}")
        except KeyError as e:
            raise Exception(f"Unexpected OpenAI API response format: missing {str(e)}")
        except Exception as e:
            if "OpenAI API" in str(e):
                raise
            raise Exception(f"Failed to generate: {str(e)}")

    async def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        quality: str = "standard",
        timeout: int = 60
    ) -> Dict[str, str]:
        """
        Generate image using DALL-E 3

        Args:
            prompt: Description of the image to generate
            size: Image size (1024x1024, 1792x1024, or 1024x1792)
            quality: Image quality (standard or hd)
            timeout: Request timeout in seconds

        Returns:
            Dict with 'url' and 'revised_prompt' keys

        Raises:
            Exception: On API errors or timeouts
        """

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.image_url,
                    headers=self.headers,
                    json={
                        "model": "dall-e-3",
                        "prompt": prompt,
                        "size": size,
                        "quality": quality,
                        "n": 1
                    }
                )

                if response.status_code != 200:
                    error_data = response.json()
                    error_message = error_data.get('error', {}).get('message', 'Unknown error')
                    raise Exception(f"DALL-E API error: {error_message}")

                result = response.json()
                return {
                    "url": result["data"][0]["url"],
                    "revised_prompt": result["data"][0].get("revised_prompt", prompt)
                }

        except httpx.TimeoutException:
            raise Exception(f"DALL-E API timeout after {timeout}s - request took too long")
        except httpx.RequestError as e:
            raise Exception(f"Network error connecting to DALL-E API: {str(e)}")
        except KeyError as e:
            raise Exception(f"Unexpected DALL-E API response format: missing {str(e)}")
        except Exception as e:
            if "DALL-E API" in str(e) or "OpenAI API" in str(e):
                raise
            raise Exception(f"Failed to generate image: {str(e)}")

    async def download_image_as_base64(self, image_url: str, timeout: int = 30) -> str:
        """
        Download image from URL and convert to base64

        Args:
            image_url: URL of the image to download
            timeout: Request timeout in seconds

        Returns:
            Base64-encoded image data

        Raises:
            Exception: On download errors
        """

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(image_url)

                if response.status_code != 200:
                    raise Exception(f"Failed to download image: HTTP {response.status_code}")

                # Convert to base64
                image_bytes = response.content
                base64_image = base64.b64encode(image_bytes).decode('utf-8')

                return base64_image

        except httpx.TimeoutException:
            raise Exception(f"Image download timeout after {timeout}s")
        except httpx.RequestError as e:
            raise Exception(f"Network error downloading image: {str(e)}")
        except Exception as e:
            if "Failed to download" in str(e):
                raise
            raise Exception(f"Failed to download image: {str(e)}")
