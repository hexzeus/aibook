"""
Affiliate Program System for AI Book Generator
Incentivizes users to refer others
"""
import uuid
import secrets
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy.orm import Session
from database.models import User, LicensePurchase
from database.repositories import UserRepository


class AffiliateSystem:
    """Manages affiliate program operations"""

    COMMISSION_RATE = 0.20  # 20% commission on all purchases
    MIN_PAYOUT_CENTS = 5000  # Minimum $50 for payout

    def __init__(self, session: Session):
        self.session = session
        self.user_repo = UserRepository(session)

    def generate_affiliate_code(self, user_id: uuid.UUID) -> str:
        """
        Generate unique affiliate code for user
        Format: AIBOOK-XXXXX (8 characters)
        """
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        # If user already has code, return it
        if user.affiliate_code:
            return user.affiliate_code

        # Generate unique code
        while True:
            code = f"AIBOOK-{secrets.token_hex(3).upper()}"
            # Check if code exists
            existing = self.session.query(User).filter(User.affiliate_code == code).first()
            if not existing:
                break

        user.affiliate_code = code
        self.session.flush()

        return code

    def track_referral(self, new_user_id: uuid.UUID, referral_code: str) -> bool:
        """
        Track referral when new user signs up
        Returns True if referral was tracked
        """
        # Find referrer by affiliate code
        referrer = self.session.query(User).filter(User.affiliate_code == referral_code).first()
        if not referrer:
            return False

        # Update new user
        new_user = self.user_repo.get_by_id(new_user_id)
        if not new_user:
            return False

        new_user.referred_by_code = referral_code

        # Increment referrer's count
        referrer.total_referrals += 1

        self.session.flush()
        return True

    def process_purchase_commission(
        self,
        purchase_id: uuid.UUID,
        user_id: uuid.UUID,
        amount_cents: int
    ):
        """
        Process affiliate commission for purchase
        Called when user makes a purchase and they were referred
        """
        user = self.user_repo.get_by_id(user_id)
        if not user or not user.referred_by_code:
            return

        # Find referrer
        referrer = self.session.query(User).filter(
            User.affiliate_code == user.referred_by_code
        ).first()

        if not referrer:
            return

        # Calculate commission (20% of purchase)
        commission_cents = int(amount_cents * self.COMMISSION_RATE)

        # Credit referrer
        referrer.affiliate_earnings_cents += commission_cents

        self.session.flush()

        return {
            "referrer_id": str(referrer.user_id),
            "commission_cents": commission_cents,
            "commission_dollars": commission_cents / 100
        }

    def get_affiliate_stats(self, user_id: uuid.UUID) -> Dict:
        """Get affiliate statistics for user"""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return None

        # Ensure user has affiliate code
        if not user.affiliate_code:
            self.generate_affiliate_code(user_id)
            user = self.user_repo.get_by_id(user_id)

        # Count successful referrals (users who made purchases)
        successful_referrals = self.session.query(User).filter(
            User.referred_by_code == user.affiliate_code,
            User.total_credits > 1000  # Made at least one purchase
        ).count()

        # Calculate pending earnings (not yet paid out)
        pending_cents = user.affiliate_earnings_cents

        return {
            "affiliate_code": user.affiliate_code,
            "total_referrals": user.total_referrals,
            "successful_referrals": successful_referrals,
            "total_earnings_cents": user.affiliate_earnings_cents,
            "total_earnings_dollars": user.affiliate_earnings_cents / 100,
            "pending_payout": pending_cents >= self.MIN_PAYOUT_CENTS,
            "payout_email": user.affiliate_payout_email,
            "share_url": f"https://aibook.app?ref={user.affiliate_code}"
        }

    def request_payout(self, user_id: uuid.UUID, paypal_email: str) -> Dict:
        """
        Request affiliate payout
        Requires minimum $50 earnings
        """
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        if user.affiliate_earnings_cents < self.MIN_PAYOUT_CENTS:
            raise ValueError(
                f"Minimum payout is ${self.MIN_PAYOUT_CENTS/100}. "
                f"You have ${user.affiliate_earnings_cents/100}"
            )

        # Update payout email
        user.affiliate_payout_email = paypal_email

        # In production, integrate with PayPal API here
        # For now, just mark for manual processing

        payout_amount = user.affiliate_earnings_cents

        # Reset earnings
        user.affiliate_earnings_cents = 0

        self.session.flush()

        return {
            "success": True,
            "payout_amount_cents": payout_amount,
            "payout_amount_dollars": payout_amount / 100,
            "paypal_email": paypal_email,
            "status": "Processing - you'll receive payment within 5-7 business days"
        }
