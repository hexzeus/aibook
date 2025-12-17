"""
User repository - handles all user database operations
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict
from datetime import datetime
import uuid

from ..models import User, LicensePurchase


class UserRepository:
    """Repository for user operations"""

    def __init__(self, session: Session):
        self.session = session

    def get_by_license_key(self, license_key: str) -> Optional[User]:
        """Get user by license key"""
        return self.session.query(User).filter(User.license_key == license_key).first()

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Get user by ID"""
        return self.session.query(User).filter(User.user_id == user_id).first()

    def create_user(
        self,
        license_key: str,
        email: Optional[str] = None,
        total_credits: int = 1000,
        gumroad_product_id: Optional[str] = None,
        gumroad_sale_id: Optional[str] = None,
        subscription_tier: str = 'basic'
    ) -> User:
        """Create new user"""
        user = User(
            license_key=license_key,
            email=email,
            total_credits=total_credits,
            credits_used=0,  # Explicitly set to 0
            gumroad_product_id=gumroad_product_id,
            gumroad_sale_id=gumroad_sale_id,
            subscription_tier=subscription_tier,
            is_active=True
        )
        self.session.add(user)
        self.session.flush()
        return user

    def add_credits(self, user_id: uuid.UUID, credits: int, purchase_data: Optional[Dict] = None) -> User:
        """Add credits to user and record purchase"""
        user = self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        user.total_credits += credits

        # Record purchase if data provided
        if purchase_data:
            purchase = LicensePurchase(
                user_id=user_id,
                license_key=user.license_key,
                gumroad_sale_id=purchase_data.get('sale_id'),
                product_name=purchase_data.get('product_name'),
                price_cents=purchase_data.get('price_cents'),
                currency=purchase_data.get('currency', 'USD'),
                credits_granted=credits
            )
            self.session.add(purchase)

        self.session.flush()
        return user

    def consume_credits(self, user_id: uuid.UUID, credits: int) -> bool:
        """
        Consume credits from user
        Returns True if successful, False if insufficient credits
        """
        print(f"[REPO] consume_credits called for {user_id}, credits={credits}", flush=True)
        user = self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        # Ensure credits_used is not None
        if user.credits_used is None:
            user.credits_used = 0

        if user.credits_remaining < credits:
            return False

        user.credits_used += credits
        print(f"[REPO] Credits updated, skipping flush (will commit later)", flush=True)
        # Don't flush here - causes session locks. Will commit at endpoint level.
        # self.session.flush()
        return True

    def refund_credits(self, user_id: uuid.UUID, credits: int) -> User:
        """Refund credits to user (e.g., on generation failure)"""
        user = self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        user.credits_used = max(0, user.credits_used - credits)
        self.session.flush()
        return user

    def update_last_login(self, user_id: uuid.UUID) -> User:
        """Update user's last login timestamp"""
        print(f"[REPO] update_last_login called for {user_id}", flush=True)
        user = self.get_by_id(user_id)
        print(f"[REPO] Got user: {user is not None}", flush=True)
        if user:
            print(f"[REPO] Setting last_login_at...", flush=True)
            user.last_login_at = datetime.utcnow()
            print(f"[REPO] Flushing session...", flush=True)
            self.session.flush()
            print(f"[REPO] Flush complete", flush=True)
        return user

    def update_preferences(self, user_id: uuid.UUID, preferences: Dict) -> User:
        """Update user preferences"""
        user = self.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        user.preferences = preferences
        self.session.flush()
        return user

    def increment_book_count(self, user_id: uuid.UUID) -> User:
        """Increment total books created counter"""
        user = self.get_by_id(user_id)
        if user:
            user.total_books_created += 1
            self.session.flush()
        return user

    def increment_page_count(self, user_id: uuid.UUID, count: int = 1) -> User:
        """Increment total pages generated counter"""
        user = self.get_by_id(user_id)
        if user:
            user.total_pages_generated += count
            self.session.flush()
        return user

    def increment_export_count(self, user_id: uuid.UUID) -> User:
        """Increment total exports counter"""
        user = self.get_by_id(user_id)
        if user:
            user.total_exports += 1
            self.session.flush()
        return user

    def get_user_stats(self, user_id: uuid.UUID) -> Dict:
        """Get comprehensive user statistics"""
        user = self.get_by_id(user_id)
        if not user:
            return None

        return {
            'user_id': str(user.user_id),
            'email': user.email,
            'credits_total': user.total_credits,
            'credits_used': user.credits_used,
            'credits_remaining': user.credits_remaining,
            'total_books_created': user.total_books_created,
            'total_pages_generated': user.total_pages_generated,
            'total_exports': user.total_exports,
            'subscription_tier': user.subscription_tier,
            'member_since': user.created_at.isoformat() if user.created_at else None,
            'last_login': user.last_login_at.isoformat() if user.last_login_at else None
        }

    def ban_user(self, user_id: uuid.UUID, reason: str) -> User:
        """Ban user account"""
        user = self.get_by_id(user_id)
        if user:
            user.is_banned = True
            user.ban_reason = reason
            user.is_active = False
            self.session.flush()
        return user

    def unban_user(self, user_id: uuid.UUID) -> User:
        """Unban user account"""
        user = self.get_by_id(user_id)
        if user:
            user.is_banned = False
            user.ban_reason = None
            user.is_active = True
            self.session.flush()
        return user
