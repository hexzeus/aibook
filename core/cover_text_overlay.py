"""
Book Cover Text Overlay - Professional book cover with design background and text box
"""
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import Optional


class CoverTextOverlay:
    """
    Create professional book covers with:
    - AI-generated design background
    - Clean text box with readable background
    - Professional typography
    - Signature look
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
        Create professional book cover with text box overlay

        Args:
            background_base64: Base64-encoded PNG background design
            title: Book title
            subtitle: Optional subtitle
            author: Optional author name

        Returns:
            Base64-encoded PNG book cover
        """
        # Decode background design
        img_data = base64.b64decode(background_base64)
        design = Image.open(BytesIO(img_data)).convert('RGB')

        # Resize/crop to cover dimensions
        design = self._prepare_background(design)

        # Create book cover canvas
        cover = Image.new('RGB', (self.COVER_WIDTH, self.COVER_HEIGHT), (255, 255, 255))

        # Add the design as background
        cover.paste(design, (0, 0))

        # Create text box overlay
        overlay = Image.new('RGBA', cover.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Define text box area (centered, with padding)
        box_margin = 80
        box_x1 = box_margin
        box_x2 = self.COVER_WIDTH - box_margin
        box_y1 = 450
        box_height = 600
        box_y2 = box_y1 + box_height

        # Draw semi-transparent text box with border
        # This creates a clean, readable area for text
        box_bg_color = (0, 0, 0, 200)  # Semi-transparent black
        border_color = (255, 255, 255, 230)  # White border

        # Draw outer border (decorative)
        border_width = 3
        draw.rectangle(
            [box_x1 - border_width, box_y1 - border_width,
             box_x2 + border_width, box_y2 + border_width],
            fill=border_color
        )

        # Draw inner box
        draw.rectangle(
            [box_x1, box_y1, box_x2, box_y2],
            fill=box_bg_color
        )

        # Composite overlay onto cover
        cover_rgba = cover.convert('RGBA')
        cover_rgba = Image.alpha_composite(cover_rgba, overlay)
        cover = cover_rgba.convert('RGB')

        # Now add text on top
        draw = ImageDraw.Draw(cover)

        # Load fonts
        try:
            title_font = self._get_font('bold', 75)
            subtitle_font = self._get_font('regular', 38)
            author_font = self._get_font('regular', 32)
        except Exception as e:
            print(f"[COVER] Font warning: {e}")
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            author_font = ImageFont.load_default()

        # Text color (white for dark box)
        text_color = (255, 255, 255)

        # Center text within the box
        center_x = self.COVER_WIDTH // 2
        text_y = box_y1 + 80  # Start position within box

        # Wrap and draw title
        wrapped_title = self._wrap_text(title, title_font, draw, max_width=box_x2 - box_x1 - 80)

        for line in wrapped_title:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            draw.text((text_x, text_y), line, font=title_font, fill=text_color)
            text_y += bbox[3] - bbox[1] + 20

        # Draw subtitle if provided
        if subtitle:
            text_y += 30  # Space between title and subtitle
            wrapped_subtitle = self._wrap_text(subtitle, subtitle_font, draw, max_width=box_x2 - box_x1 - 80)

            for line in wrapped_subtitle:
                bbox = draw.textbbox((0, 0), line, font=subtitle_font)
                text_width = bbox[2] - bbox[0]
                text_x = center_x - text_width // 2

                # Subtitle slightly dimmer
                subtitle_color = (220, 220, 220)
                draw.text((text_x, text_y), line, font=subtitle_font, fill=subtitle_color)
                text_y += bbox[3] - bbox[1] + 15

        # Draw author at bottom if provided
        if author:
            author_y = box_y2 - 70
            bbox = draw.textbbox((0, 0), author, font=author_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            draw.text((text_x, author_y), author, font=author_font, fill=text_color)

        # Convert to base64 with JPEG compression for smaller file size
        # Amazon KDP recommends <127KB per image
        buffer = BytesIO()
        cover.save(buffer, format='JPEG', quality=85, optimize=True)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return img_base64

    def _prepare_background(self, design: Image.Image) -> Image.Image:
        """Resize and crop design to fit cover"""
        # Target aspect ratio
        target_ratio = self.COVER_WIDTH / self.COVER_HEIGHT

        # Calculate current ratio
        design_ratio = design.width / design.height

        if design_ratio > target_ratio:
            # Design is wider - crop width
            new_height = self.COVER_HEIGHT
            new_width = int(new_height * design_ratio)
            design = design.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Crop to center
            left = (new_width - self.COVER_WIDTH) // 2
            design = design.crop((left, 0, left + self.COVER_WIDTH, self.COVER_HEIGHT))
        else:
            # Design is taller - crop height
            new_width = self.COVER_WIDTH
            new_height = int(new_width / design_ratio)
            design = design.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Crop to center
            top = (new_height - self.COVER_HEIGHT) // 2
            design = design.crop((0, top, self.COVER_WIDTH, top + self.COVER_HEIGHT))

        return design

    def _get_font(self, weight: str, size: int) -> ImageFont.FreeTypeFont:
        """Load system font with fallbacks"""
        import platform

        system = platform.system()
        font_paths = []

        if weight == 'bold':
            if system == "Windows":
                font_paths = [
                    "C:/Windows/Fonts/arialbd.ttf",
                    "C:/Windows/Fonts/calibrib.ttf",
                ]
            elif system == "Darwin":  # macOS
                font_paths = [
                    "/System/Library/Fonts/Helvetica.ttc",
                ]
            else:  # Linux
                font_paths = [
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
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
                ]
            else:  # Linux
                font_paths = [
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                ]

        for font_path in font_paths:
            try:
                return ImageFont.truetype(font_path, size)
            except:
                continue

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
