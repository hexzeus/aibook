"""
Book Cover Text Overlay - Modern fringe design with top/bottom bars
Creates professional book covers without obscuring the AI-generated artwork
"""
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import Optional


class CoverTextOverlay:
    """
    Create professional book covers with:
    - AI-generated artwork in the center (unobscured)
    - Top fringe bar for title
    - Bottom fringe bar for subtitle/author
    - Clean, modern aesthetic
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
        Create professional book cover with top/bottom fringe bars

        Args:
            background_base64: Base64-encoded PNG background design
            title: Book title (goes in top bar)
            subtitle: Optional subtitle (goes in bottom bar with author)
            author: Optional author name (goes in bottom bar)

        Returns:
            Base64-encoded PNG book cover
        """
        # Decode background design
        img_data = base64.b64decode(background_base64)
        design = Image.open(BytesIO(img_data)).convert('RGB')

        # Resize/crop to cover dimensions
        design = self._prepare_background(design)

        # Load fonts
        try:
            title_font = self._get_font('bold', 72)
            subtitle_font = self._get_font('regular', 42)
            author_font = self._get_font('regular', 36)
        except Exception as e:
            print(f"[COVER] Font warning: {e}")
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            author_font = ImageFont.load_default()

        # Create temporary draw to measure text
        temp_overlay = Image.new('RGBA', (self.COVER_WIDTH, self.COVER_HEIGHT), (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp_overlay)

        # Calculate top bar height (for title)
        text_max_width = self.COVER_WIDTH - 120  # Side padding
        wrapped_title = self._wrap_text(title, title_font, temp_draw, max_width=text_max_width)

        title_height = 0
        for line in wrapped_title:
            bbox = temp_draw.textbbox((0, 0), line, font=title_font)
            title_height += (bbox[3] - bbox[1]) + 15  # Line spacing

        # Top bar dimensions (with padding)
        top_bar_padding = 50  # Vertical padding inside bar
        top_bar_height = max(200, title_height + (top_bar_padding * 2))  # Minimum 200px

        # Calculate bottom bar height (for subtitle + author)
        bottom_text_height = 0

        if subtitle:
            wrapped_subtitle = self._wrap_text(subtitle, subtitle_font, temp_draw, max_width=text_max_width)
            for line in wrapped_subtitle:
                bbox = temp_draw.textbbox((0, 0), line, font=subtitle_font)
                bottom_text_height += (bbox[3] - bbox[1]) + 12
            bottom_text_height += 25  # Gap between subtitle and author

        if author:
            bbox = temp_draw.textbbox((0, 0), author, font=author_font)
            bottom_text_height += (bbox[3] - bbox[1])

        # Bottom bar dimensions
        bottom_bar_padding = 45
        bottom_bar_height = max(150, bottom_text_height + (bottom_bar_padding * 2)) if (subtitle or author) else 0

        # Create overlay with gradient bars
        overlay = Image.new('RGBA', (self.COVER_WIDTH, self.COVER_HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # === TOP BAR (Title) ===
        # Gradient from solid to transparent (creates elegant fade into artwork)
        self._draw_gradient_bar(
            draw,
            y_start=0,
            y_end=top_bar_height,
            base_color=(0, 0, 0),  # Black
            opacity_start=245,      # Nearly opaque at top
            opacity_end=180,        # Fade to semi-transparent
            direction='down'
        )

        # Accent line at bottom of top bar (subtle gold)
        draw.rectangle(
            [0, top_bar_height - 3, self.COVER_WIDTH, top_bar_height],
            fill=(212, 175, 55, 200)  # Gold accent
        )

        # === BOTTOM BAR (Subtitle/Author) ===
        if bottom_bar_height > 0:
            bottom_bar_start = self.COVER_HEIGHT - bottom_bar_height

            # Gradient from transparent to solid
            self._draw_gradient_bar(
                draw,
                y_start=bottom_bar_start,
                y_end=self.COVER_HEIGHT,
                base_color=(0, 0, 0),  # Black
                opacity_start=180,      # Fade from semi-transparent
                opacity_end=245,        # To nearly opaque at bottom
                direction='up'
            )

            # Accent line at top of bottom bar
            draw.rectangle(
                [0, bottom_bar_start, self.COVER_WIDTH, bottom_bar_start + 3],
                fill=(212, 175, 55, 200)  # Gold accent
            )

        # Composite overlay onto cover
        cover_rgba = design.convert('RGBA')
        cover_rgba = Image.alpha_composite(cover_rgba, overlay)
        cover = cover_rgba.convert('RGB')

        # Now add text
        draw = ImageDraw.Draw(cover)
        text_color = (255, 255, 255)  # White text
        center_x = self.COVER_WIDTH // 2

        # === DRAW TITLE (Top bar) ===
        text_y = (top_bar_height - title_height) // 2  # Center vertically in top bar

        for line in wrapped_title:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            # Add subtle shadow for depth
            shadow_offset = 3
            draw.text((text_x + shadow_offset, text_y + shadow_offset), line, font=title_font, fill=(0, 0, 0, 180))
            draw.text((text_x, text_y), line, font=title_font, fill=text_color)
            text_y += bbox[3] - bbox[1] + 15

        # === DRAW SUBTITLE & AUTHOR (Bottom bar) ===
        if bottom_bar_height > 0:
            bottom_bar_start = self.COVER_HEIGHT - bottom_bar_height
            text_y = bottom_bar_start + (bottom_bar_height - bottom_text_height) // 2

            # Draw subtitle
            if subtitle:
                for line in wrapped_subtitle:
                    bbox = draw.textbbox((0, 0), line, font=subtitle_font)
                    text_width = bbox[2] - bbox[0]
                    text_x = center_x - text_width // 2

                    # Slightly dimmer for subtitle
                    subtitle_color = (230, 230, 230)
                    draw.text((text_x + 2, text_y + 2), line, font=subtitle_font, fill=(0, 0, 0, 150))
                    draw.text((text_x, text_y), line, font=subtitle_font, fill=subtitle_color)
                    text_y += bbox[3] - bbox[1] + 12

                text_y += 25  # Gap before author

            # Draw author
            if author:
                bbox = draw.textbbox((0, 0), author, font=author_font)
                text_width = bbox[2] - bbox[0]
                text_x = center_x - text_width // 2

                draw.text((text_x + 2, text_y + 2), author, font=author_font, fill=(0, 0, 0, 150))
                draw.text((text_x, text_y), author, font=author_font, fill=text_color)

        # Amazon KDP optimization
        kdp_width = 800
        kdp_height = int(self.COVER_HEIGHT * (kdp_width / self.COVER_WIDTH))

        print(f"[COVER] Resizing from {self.COVER_WIDTH}x{self.COVER_HEIGHT} to {kdp_width}x{kdp_height} for Amazon KDP", flush=True)
        cover_resized = cover.resize((kdp_width, kdp_height), Image.Resampling.LANCZOS)

        # Compress to stay under 127KB
        buffer = BytesIO()
        cover_resized.save(buffer, format='JPEG', quality=75, optimize=True)
        cover_data = buffer.getvalue()

        if len(cover_data) > 127 * 1024:
            print(f"[COVER] Cover too large ({len(cover_data)//1024}KB), compressing to quality 65", flush=True)
            buffer = BytesIO()
            cover_resized.save(buffer, format='JPEG', quality=65, optimize=True)
            cover_data = buffer.getvalue()

        if len(cover_data) > 127 * 1024:
            print(f"[COVER] Still too large ({len(cover_data)//1024}KB), compressing to quality 55", flush=True)
            buffer = BytesIO()
            cover_resized.save(buffer, format='JPEG', quality=55, optimize=True)
            cover_data = buffer.getvalue()

        print(f"[COVER] Final cover size: {len(cover_data)//1024}KB", flush=True)
        img_base64 = base64.b64encode(cover_data).decode('utf-8')

        return f"data:image/jpeg;base64,{img_base64}"

    def _draw_gradient_bar(
        self,
        draw: ImageDraw.ImageDraw,
        y_start: int,
        y_end: int,
        base_color: tuple,
        opacity_start: int,
        opacity_end: int,
        direction: str = 'down'
    ):
        """
        Draw a vertical gradient bar with smooth opacity transition

        Args:
            draw: ImageDraw object
            y_start: Top Y coordinate
            y_end: Bottom Y coordinate
            base_color: RGB tuple (e.g., (0, 0, 0) for black)
            opacity_start: Starting opacity (0-255)
            opacity_end: Ending opacity (0-255)
            direction: 'down' (fade down) or 'up' (fade up)
        """
        height = y_end - y_start

        for i in range(height):
            # Calculate opacity for this row
            progress = i / height
            if direction == 'down':
                opacity = int(opacity_start + (opacity_end - opacity_start) * progress)
            else:  # 'up'
                opacity = int(opacity_start + (opacity_end - opacity_start) * (1 - progress))

            # Draw horizontal line with calculated opacity
            draw.rectangle(
                [0, y_start + i, self.COVER_WIDTH, y_start + i + 1],
                fill=(*base_color, opacity)
            )

    def _prepare_background(self, design: Image.Image) -> Image.Image:
        """Resize and crop design to fit cover"""
        target_ratio = self.COVER_WIDTH / self.COVER_HEIGHT
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
