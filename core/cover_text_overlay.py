"""
Book Cover Text Overlay - Add perfect text to AI-generated cover backgrounds
"""
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import textwrap
from typing import Optional


class CoverTextOverlay:
    """
    Overlay text on book cover backgrounds with professional typography

    Handles:
    - Multi-line title wrapping
    - Subtitle placement
    - Automatic font sizing
    - Contrast-aware text color
    - Professional layout
    """

    # Standard cover dimensions (portrait)
    COVER_WIDTH = 1024
    COVER_HEIGHT = 1792

    def add_text_to_cover(
        self,
        background_base64: str,
        title: str,
        subtitle: Optional[str] = None,
        author: Optional[str] = None
    ) -> str:
        """
        Add text overlay to cover background

        Args:
            background_base64: Base64-encoded PNG background image
            title: Book title (will be wrapped if too long)
            subtitle: Optional subtitle
            author: Optional author name

        Returns:
            Base64-encoded PNG with text overlay
        """
        # Decode background image
        img_data = base64.b64decode(background_base64)
        img = Image.open(BytesIO(img_data)).convert('RGBA')

        # Resize to standard dimensions if needed
        if img.size != (self.COVER_WIDTH, self.COVER_HEIGHT):
            img = img.resize((self.COVER_WIDTH, self.COVER_HEIGHT), Image.Resampling.LANCZOS)

        # Create overlay layer for text
        overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Determine text color based on background brightness
        text_color = self._get_text_color(img)

        # Load fonts
        try:
            # Try to use system fonts (will work on most systems)
            title_font = self._get_font('bold', 80)
            subtitle_font = self._get_font('regular', 40)
            author_font = self._get_font('regular', 35)
        except Exception as e:
            print(f"[COVER] Font loading warning: {e}, using default font")
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            author_font = ImageFont.load_default()

        # Calculate positions (center-aligned)
        center_x = self.COVER_WIDTH // 2

        # Title positioning (upper-middle area)
        title_y_start = 350

        # Wrap title if too long
        wrapped_title = self._wrap_text(title, title_font, draw, max_width=900)

        # Draw title (centered, multi-line)
        current_y = title_y_start
        for line in wrapped_title:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            # Add shadow for better readability
            self._draw_text_with_shadow(
                draw, (text_x, current_y), line, font=title_font,
                fill=text_color, shadow_color=self._get_shadow_color(text_color)
            )

            current_y += bbox[3] - bbox[1] + 20  # Line height + spacing

        # Draw subtitle if provided (below title)
        if subtitle:
            subtitle_y = current_y + 40
            wrapped_subtitle = self._wrap_text(subtitle, subtitle_font, draw, max_width=850)

            for line in wrapped_subtitle:
                bbox = draw.textbbox((0, 0), line, font=subtitle_font)
                text_width = bbox[2] - bbox[0]
                text_x = center_x - text_width // 2

                # Subtitle with slight transparency
                subtitle_color = self._adjust_alpha(text_color, 0.9)
                self._draw_text_with_shadow(
                    draw, (text_x, subtitle_y), line, font=subtitle_font,
                    fill=subtitle_color, shadow_color=self._get_shadow_color(text_color)
                )

                subtitle_y += bbox[3] - bbox[1] + 15

        # Draw author if provided (bottom)
        if author:
            author_y = self.COVER_HEIGHT - 150
            bbox = draw.textbbox((0, 0), author, font=author_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            self._draw_text_with_shadow(
                draw, (text_x, author_y), author, font=author_font,
                fill=text_color, shadow_color=self._get_shadow_color(text_color)
            )

        # Composite text overlay on background
        img = Image.alpha_composite(img, overlay)

        # Convert back to RGB (remove alpha channel)
        final_img = Image.new('RGB', img.size, (255, 255, 255))
        final_img.paste(img, mask=img.split()[3])  # Use alpha as mask

        # Encode to base64
        buffer = BytesIO()
        final_img.save(buffer, format='PNG', optimize=True)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return img_base64

    def _get_font(self, weight: str, size: int) -> ImageFont.FreeTypeFont:
        """Load system font with fallbacks"""
        import platform

        system = platform.system()
        font_paths = []

        if weight == 'bold':
            if system == "Windows":
                font_paths = [
                    "C:/Windows/Fonts/arialbd.ttf",  # Arial Bold
                    "C:/Windows/Fonts/calibrib.ttf",  # Calibri Bold
                    "C:/Windows/Fonts/framd.ttf",     # Franklin Gothic Medium
                ]
            elif system == "Darwin":  # macOS
                font_paths = [
                    "/System/Library/Fonts/Helvetica.ttc",
                    "/System/Library/Fonts/SFNSDisplay-Bold.otf",
                ]
            else:  # Linux
                font_paths = [
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                ]
        else:  # regular
            if system == "Windows":
                font_paths = [
                    "C:/Windows/Fonts/arial.ttf",
                    "C:/Windows/Fonts/calibri.ttf",
                ]
            elif system == "Darwin":
                font_paths = [
                    "/System/Library/Fonts/Helvetica.ttc",
                    "/System/Library/Fonts/SFNSDisplay.otf",
                ]
            else:  # Linux
                font_paths = [
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                ]

        # Try each font path
        for font_path in font_paths:
            try:
                return ImageFont.truetype(font_path, size)
            except:
                continue

        # Final fallback
        return ImageFont.load_default()

    def _wrap_text(
        self,
        text: str,
        font: ImageFont.FreeTypeFont,
        draw: ImageDraw.ImageDraw,
        max_width: int
    ) -> list:
        """Wrap text to fit within max_width"""
        words = text.split()
        lines = []
        current_line = []

        for word in words:
            test_line = ' '.join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            width = bbox[2] - bbox[0]

            if width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]

        if current_line:
            lines.append(' '.join(current_line))

        return lines if lines else [text]

    def _get_text_color(self, img: Image.Image) -> tuple:
        """
        Determine text color based on background brightness

        Returns white text for dark backgrounds, black for light
        """
        # Sample center area of image
        sample_area = img.crop((
            self.COVER_WIDTH // 4,
            300,
            3 * self.COVER_WIDTH // 4,
            800
        ))

        # Convert to grayscale and get average brightness
        gray = sample_area.convert('L')
        pixels = list(gray.getdata())
        avg_brightness = sum(pixels) / len(pixels)

        # Return white for dark backgrounds, black for light
        if avg_brightness < 128:
            return (255, 255, 255, 255)  # White
        else:
            return (0, 0, 0, 255)  # Black

    def _get_shadow_color(self, text_color: tuple) -> tuple:
        """Get shadow color (opposite of text color)"""
        if text_color[0] > 128:  # White text
            return (0, 0, 0, 128)  # Semi-transparent black shadow
        else:  # Black text
            return (255, 255, 255, 128)  # Semi-transparent white shadow

    def _adjust_alpha(self, color: tuple, alpha: float) -> tuple:
        """Adjust alpha channel of color"""
        return (color[0], color[1], color[2], int(color[3] * alpha))

    def _draw_text_with_shadow(
        self,
        draw: ImageDraw.ImageDraw,
        position: tuple,
        text: str,
        font: ImageFont.FreeTypeFont,
        fill: tuple,
        shadow_color: tuple
    ):
        """Draw text with shadow for better readability"""
        x, y = position

        # Draw shadow (offset slightly)
        draw.text((x + 2, y + 2), text, font=font, fill=shadow_color)

        # Draw main text
        draw.text((x, y), text, font=font, fill=fill)
