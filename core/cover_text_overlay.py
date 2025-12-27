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

        # Load fonts first to calculate text dimensions
        try:
            title_font = self._get_font('bold', 75)
            subtitle_font = self._get_font('regular', 38)
            author_font = self._get_font('regular', 32)
        except Exception as e:
            print(f"[COVER] Font warning: {e}")
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            author_font = ImageFont.load_default()

        # Create temporary draw to measure text
        temp_overlay = Image.new('RGBA', cover.size, (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp_overlay)

        # Calculate text dimensions
        box_margin = 80
        text_max_width = self.COVER_WIDTH - (box_margin * 2) - 100  # Horizontal padding inside box

        wrapped_title = self._wrap_text(title, title_font, temp_draw, max_width=text_max_width)

        # Calculate title height
        total_text_height = 0
        for line in wrapped_title:
            bbox = temp_draw.textbbox((0, 0), line, font=title_font)
            total_text_height += (bbox[3] - bbox[1]) + 20

        # Add subtitle height if exists
        if subtitle:
            total_text_height += 30  # Gap between title and subtitle
            wrapped_subtitle = self._wrap_text(subtitle, subtitle_font, temp_draw, max_width=text_max_width)
            for line in wrapped_subtitle:
                bbox = temp_draw.textbbox((0, 0), line, font=subtitle_font)
                total_text_height += (bbox[3] - bbox[1]) + 15

        # Add author height if exists
        if author:
            total_text_height += 50  # Gap before author
            bbox = temp_draw.textbbox((0, 0), author, font=author_font)
            total_text_height += (bbox[3] - bbox[1])

        # Calculate box dimensions - tight fit around text with padding
        vertical_padding = 60  # Top and bottom padding inside box
        box_height = int(total_text_height + (vertical_padding * 2))

        # Position box centered vertically
        box_y1 = (self.COVER_HEIGHT - box_height) // 2
        box_x1 = box_margin
        box_x2 = self.COVER_WIDTH - box_margin
        box_y2 = box_y1 + box_height

        # Create text box overlay
        overlay = Image.new('RGBA', cover.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # ELABORATE ORNAMENTAL BORDER - Museum-quality picture frame aesthetic

        # Color palette for ornate frame
        dark_gold = (184, 134, 11, 255)     # Dark goldenrod
        gold = (255, 215, 0, 255)            # Pure gold
        light_gold = (255, 223, 100, 255)    # Light gold highlight
        white = (255, 255, 255, 255)         # Pure white
        cream = (255, 253, 208, 255)         # Cream highlight
        dark_brown = (101, 67, 33, 255)      # Deep wood brown

        # LAYER 1: Outermost shadow/depth (20px) - Creates 3D lifted effect
        draw.rectangle(
            [box_x1 - 20, box_y1 - 20, box_x2 + 20, box_y2 + 20],
            fill=dark_brown
        )

        # LAYER 2: Outer gold frame (18px)
        draw.rectangle(
            [box_x1 - 18, box_y1 - 18, box_x2 + 18, box_y2 + 18],
            fill=dark_gold
        )

        # LAYER 3: Gold bevel highlight (16px) - Top/left lighter
        draw.rectangle(
            [box_x1 - 16, box_y1 - 16, box_x2 + 16, box_y2 + 16],
            fill=gold
        )

        # LAYER 4: White separator with ornate feel (14px)
        draw.rectangle(
            [box_x1 - 14, box_y1 - 14, box_x2 + 14, box_y2 + 14],
            fill=white
        )

        # LAYER 5: Cream accent (12px)
        draw.rectangle(
            [box_x1 - 12, box_y1 - 12, box_x2 + 12, box_y2 + 12],
            fill=cream
        )

        # LAYER 6: Light gold inner frame (10px)
        draw.rectangle(
            [box_x1 - 10, box_y1 - 10, box_x2 + 10, box_y2 + 10],
            fill=light_gold
        )

        # LAYER 7: White inner separator (8px)
        draw.rectangle(
            [box_x1 - 8, box_y1 - 8, box_x2 + 8, box_y2 + 8],
            fill=white
        )

        # LAYER 8: Gold detail (6px)
        draw.rectangle(
            [box_x1 - 6, box_y1 - 6, box_x2 + 6, box_y2 + 6],
            fill=gold
        )

        # LAYER 9: Dark gold inner shadow (4px) - Creates inset effect
        draw.rectangle(
            [box_x1 - 4, box_y1 - 4, box_x2 + 4, box_y2 + 4],
            fill=dark_gold
        )

        # LAYER 10: Final white trim (2px)
        draw.rectangle(
            [box_x1 - 2, box_y1 - 2, box_x2 + 2, box_y2 + 2],
            fill=white
        )

        # Semi-transparent background (lets background show through slightly)
        draw.rectangle(
            [box_x1, box_y1, box_x2, box_y2],
            fill=(0, 0, 0, 200)  # Semi-transparent black
        )

        # Composite overlay onto cover
        cover_rgba = cover.convert('RGBA')
        cover_rgba = Image.alpha_composite(cover_rgba, overlay)
        cover = cover_rgba.convert('RGB')

        # Now add text on top
        draw = ImageDraw.Draw(cover)

        # Text color (white for dark box)
        text_color = (255, 255, 255)

        # Center text horizontally
        center_x = self.COVER_WIDTH // 2

        # Start text at top of box with padding
        text_y = box_y1 + vertical_padding

        # Draw title
        for line in wrapped_title:
            bbox = draw.textbbox((0, 0), line, font=title_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            draw.text((text_x, text_y), line, font=title_font, fill=text_color)
            text_y += bbox[3] - bbox[1] + 20

        # Draw subtitle if provided
        if subtitle:
            text_y += 30  # Space between title and subtitle

            for line in wrapped_subtitle:
                bbox = draw.textbbox((0, 0), line, font=subtitle_font)
                text_width = bbox[2] - bbox[0]
                text_x = center_x - text_width // 2

                # Subtitle slightly dimmer
                subtitle_color = (220, 220, 220)
                draw.text((text_x, text_y), line, font=subtitle_font, fill=subtitle_color)
                text_y += bbox[3] - bbox[1] + 15

        # Draw author if provided
        if author:
            text_y += 50  # Space before author
            bbox = draw.textbbox((0, 0), author, font=author_font)
            text_width = bbox[2] - bbox[0]
            text_x = center_x - text_width // 2

            draw.text((text_x, text_y), author, font=author_font, fill=text_color)

        # Amazon KDP recommends max 800px width and <127KB file size
        # Resize to Amazon KDP dimensions first, then compress
        kdp_width = 800
        kdp_height = int(self.COVER_HEIGHT * (kdp_width / self.COVER_WIDTH))

        print(f"[COVER] Resizing from {self.COVER_WIDTH}x{self.COVER_HEIGHT} to {kdp_width}x{kdp_height} for Amazon KDP", flush=True)
        cover_resized = cover.resize((kdp_width, kdp_height), Image.Resampling.LANCZOS)

        # Start with quality 70 to ensure we stay under 127KB
        buffer = BytesIO()
        cover_resized.save(buffer, format='JPEG', quality=70, optimize=True)
        cover_data = buffer.getvalue()

        # If still too large, compress to quality 60
        if len(cover_data) > 127 * 1024:
            print(f"[COVER] Cover too large ({len(cover_data)//1024}KB), compressing to quality 60", flush=True)
            buffer = BytesIO()
            cover_resized.save(buffer, format='JPEG', quality=60, optimize=True)
            cover_data = buffer.getvalue()

        # Final fallback - very aggressive compression at quality 50
        if len(cover_data) > 127 * 1024:
            print(f"[COVER] Still too large ({len(cover_data)//1024}KB), compressing to quality 50", flush=True)
            buffer = BytesIO()
            cover_resized.save(buffer, format='JPEG', quality=50, optimize=True)
            cover_data = buffer.getvalue()

        print(f"[COVER] Final cover size: {len(cover_data)//1024}KB", flush=True)
        img_base64 = base64.b64encode(cover_data).decode('utf-8')

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
