"""
Premium Features for AI Book Generator
Advanced features that cost extra credits
"""
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from database.models import Book
from database.repositories import UserRepository
import uuid


class PremiumFeatures:
    """Manager for premium features"""

    # Premium feature costs (in credits)
    COSTS = {
        'ai_illustration': 15,  # Generate AI illustration for kids books
        'custom_style': 20,      # Apply custom fonts/colors
        'bulk_export': 10,       # Export all books at once
        'advanced_cover': 5,     # Professional cover templates
        'commercial_license': 0, # One-time $49 charge (not credits)
    }

    def __init__(self, session: Session):
        self.session = session
        self.user_repo = UserRepository(session)

    def generate_ai_illustration(
        self,
        user_id: uuid.UUID,
        book_id: uuid.UUID,
        page_number: int,
        description: str
    ) -> Dict:
        """
        Generate AI illustration for a page
        Uses DALL-E or Stable Diffusion
        """
        # Check credits
        user = self.user_repo.get_by_id(user_id)
        cost = self.COSTS['ai_illustration']

        if user.credits_remaining < cost:
            raise ValueError(f"Insufficient credits. Need {cost}, have {user.credits_remaining}")

        # Consume credits
        self.user_repo.consume_credits(user_id, cost)

        # TODO: Integrate with image generation API
        # For now, return placeholder
        illustration_url = f"https://placeholder.com/illustration-{book_id}-{page_number}.png"

        return {
            'success': True,
            'illustration_url': illustration_url,
            'credits_used': cost,
            'page_number': page_number
        }

    def apply_custom_style(
        self,
        user_id: uuid.UUID,
        book_id: uuid.UUID,
        style_config: Dict
    ) -> Dict:
        """
        Apply custom styling to book

        style_config = {
            'font_family': 'Arial',
            'font_size': 12,
            'primary_color': '#000000',
            'secondary_color': '#666666',
            'background_color': '#FFFFFF'
        }
        """
        user = self.user_repo.get_by_id(user_id)
        cost = self.COSTS['custom_style']

        if user.credits_remaining < cost:
            raise ValueError(f"Insufficient credits. Need {cost}, have {user.credits_remaining}")

        # Consume credits
        self.user_repo.consume_credits(user_id, cost)

        # Store style config in book metadata
        book = self.session.query(Book).filter(Book.book_id == book_id).first()
        if book:
            if not book.themes:
                book.themes = {}
            book.themes['custom_style'] = style_config
            self.session.flush()

        return {
            'success': True,
            'style_applied': style_config,
            'credits_used': cost
        }

    def bulk_export_books(
        self,
        user_id: uuid.UUID,
        book_ids: List[uuid.UUID]
    ) -> Dict:
        """
        Export multiple books at once
        Returns zip file with all EPUBs
        """
        user = self.user_repo.get_by_id(user_id)
        cost = self.COSTS['bulk_export']

        if user.credits_remaining < cost:
            raise ValueError(f"Insufficient credits. Need {cost}, have {user.credits_remaining}")

        # Consume credits
        self.user_repo.consume_credits(user_id, cost)

        # TODO: Implement bulk export logic
        # Generate all EPUBs and package into zip

        return {
            'success': True,
            'books_exported': len(book_ids),
            'credits_used': cost,
            'download_url': f'/downloads/bulk-export-{user_id}.zip'
        }

    def apply_advanced_cover(
        self,
        user_id: uuid.UUID,
        book_id: uuid.UUID,
        template_id: str
    ) -> Dict:
        """
        Apply professional cover template
        Uses pre-designed templates from professional designers
        """
        user = self.user_repo.get_by_id(user_id)
        cost = self.COSTS['advanced_cover']

        if user.credits_remaining < cost:
            raise ValueError(f"Insufficient credits. Need {cost}, have {user.credits_remaining}")

        # Consume credits
        self.user_repo.consume_credits(user_id, cost)

        # TODO: Load and apply template
        # Generate high-quality cover based on template

        return {
            'success': True,
            'template_id': template_id,
            'credits_used': cost,
            'cover_url': f'/covers/{book_id}-premium.svg'
        }

    def check_commercial_license(self, user_id: uuid.UUID) -> bool:
        """Check if user has commercial license"""
        user = self.user_repo.get_by_id(user_id)
        if not user.preferences:
            return False

        return user.preferences.get('commercial_license', False)

    def grant_commercial_license(self, user_id: uuid.UUID):
        """Grant commercial license to user"""
        user = self.user_repo.get_by_id(user_id)

        if not user.preferences:
            user.preferences = {}

        user.preferences['commercial_license'] = True
        user.preferences['commercial_license_date'] = str(uuid.uuid4())

        self.session.flush()

        return {
            'success': True,
            'message': 'Commercial license granted'
        }


# Available premium templates
PREMIUM_COVER_TEMPLATES = [
    {'id': 'professional-1', 'name': 'Professional Business', 'category': 'business'},
    {'id': 'modern-1', 'name': 'Modern Minimalist', 'category': 'general'},
    {'id': 'kids-1', 'name': 'Colorful Kids', 'category': 'kids'},
    {'id': 'elegant-1', 'name': 'Elegant Classic', 'category': 'literary'},
    {'id': 'tech-1', 'name': 'Tech & Innovation', 'category': 'technical'},
]


def get_premium_templates() -> List[Dict]:
    """Get list of premium cover templates"""
    return PREMIUM_COVER_TEMPLATES
