"""
Subscription Management for AI Book Generator
Handles tiered subscription plans with recurring credits
"""
from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database.models import User
from database.repositories import UserRepository
import uuid


@dataclass
class SubscriptionPlan:
    """Represents a subscription tier"""
    id: str
    name: str
    price_monthly_usd: int  # in cents
    price_yearly_usd: int  # in cents (save ~20%)
    price_display_monthly: str
    price_display_yearly: str
    credits_per_month: int
    features: List[str]
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None
    gumroad_permalink_monthly: Optional[str] = None
    gumroad_permalink_yearly: Optional[str] = None
    is_popular: bool = False


# Subscription Plans
SUBSCRIPTION_PLANS: List[SubscriptionPlan] = [
    SubscriptionPlan(
        id="starter",
        name="Starter",
        price_monthly_usd=900,  # $9/month
        price_yearly_usd=9000,  # $90/year (save 17%)
        price_display_monthly="$9/mo",
        price_display_yearly="$90/yr",
        credits_per_month=100,
        features=[
            "100 credits per month",
            "Basic EPUB export",
            "Standard AI models",
            "Email support"
        ],
        gumroad_permalink_monthly="aibook-starter-monthly",
        gumroad_permalink_yearly="aibook-starter-yearly",
        is_popular=False
    ),
    SubscriptionPlan(
        id="pro",
        name="Pro",
        price_monthly_usd=2900,  # $29/month
        price_yearly_usd=29000,  # $290/year (save 17%)
        price_display_monthly="$29/mo",
        price_display_yearly="$290/yr",
        credits_per_month=500,
        features=[
            "500 credits per month",
            "Enhanced EPUB export",
            "Priority AI generation",
            "Custom book styles",
            "Priority support"
        ],
        gumroad_permalink_monthly="aibook-pro-monthly",
        gumroad_permalink_yearly="aibook-pro-yearly",
        is_popular=True
    ),
    SubscriptionPlan(
        id="business",
        name="Business",
        price_monthly_usd=9900,  # $99/month
        price_yearly_usd=99000,  # $990/year (save 17%)
        price_display_monthly="$99/mo",
        price_display_yearly="$990/yr",
        credits_per_month=2000,
        features=[
            "2,000 credits per month",
            "Bulk export",
            "AI illustrations",
            "White-label options",
            "API access",
            "Dedicated support"
        ],
        gumroad_permalink_monthly="aibook-business-monthly",
        gumroad_permalink_yearly="aibook-business-yearly",
        is_popular=False
    ),
    SubscriptionPlan(
        id="enterprise",
        name="Enterprise",
        price_monthly_usd=29900,  # $299/month
        price_yearly_usd=299000,  # $2,990/year (save 17%)
        price_display_monthly="$299/mo",
        price_display_yearly="$2,990/yr",
        credits_per_month=10000,  # Effectively unlimited for most users
        features=[
            "10,000 credits per month",
            "Custom AI training",
            "White-label everything",
            "Unlimited team members",
            "Custom integrations",
            "24/7 phone support"
        ],
        gumroad_permalink_monthly="aibook-enterprise-monthly",
        gumroad_permalink_yearly="aibook-enterprise-yearly",
        is_popular=False
    ),
]


def get_plan_by_id(plan_id: str) -> Optional[SubscriptionPlan]:
    """Get subscription plan by ID"""
    for plan in SUBSCRIPTION_PLANS:
        if plan.id == plan_id:
            return plan
    return None


def get_all_plans() -> List[SubscriptionPlan]:
    """Get all subscription plans"""
    return SUBSCRIPTION_PLANS


class SubscriptionService:
    """Service for managing subscriptions"""

    def __init__(self, session: Session):
        self.session = session
        self.user_repo = UserRepository(session)

    def activate_subscription(
        self,
        user_id: uuid.UUID,
        plan_id: str,
        billing_cycle: str = "monthly",  # monthly or yearly
        external_subscription_id: Optional[str] = None,
        provider: str = "gumroad"  # gumroad or stripe
    ):
        """Activate subscription for user"""
        plan = get_plan_by_id(plan_id)
        if not plan:
            raise ValueError(f"Invalid plan ID: {plan_id}")

        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        # Update user subscription
        user.subscription_tier = plan.id
        user.subscription_status = "active"
        user.monthly_credit_allocation = plan.credits_per_month

        # Set subscription IDs
        if provider == "stripe":
            user.subscription_stripe_id = external_subscription_id
        else:
            user.subscription_gumroad_id = external_subscription_id

        # Set expiration based on billing cycle
        if billing_cycle == "yearly":
            user.subscription_expires_at = datetime.utcnow() + timedelta(days=365)
            user.next_credit_reset_at = datetime.utcnow() + timedelta(days=30)
        else:
            user.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
            user.next_credit_reset_at = datetime.utcnow() + timedelta(days=30)

        # Grant initial credits
        user.total_credits += plan.credits_per_month

        self.session.flush()
        return user

    def reset_monthly_credits(self, user_id: uuid.UUID):
        """Reset monthly credits for subscription user"""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return

        # Only reset if subscription is active
        if user.subscription_status != "active":
            return

        # Check if it's time to reset
        now = datetime.utcnow()
        if user.next_credit_reset_at and now >= user.next_credit_reset_at:
            # Grant monthly allocation
            user.total_credits += user.monthly_credit_allocation

            # Set next reset date
            user.next_credit_reset_at = now + timedelta(days=30)

            self.session.flush()

    def cancel_subscription(self, user_id: uuid.UUID):
        """Cancel subscription (still active until expiration)"""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return

        user.subscription_status = "cancelled"
        # Note: Don't remove subscription_expires_at - they keep access until then

        self.session.flush()

    def expire_subscription(self, user_id: uuid.UUID):
        """Expire subscription (immediately)"""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return

        user.subscription_status = "expired"
        user.subscription_tier = "basic"
        user.monthly_credit_allocation = 0
        user.subscription_expires_at = None
        user.next_credit_reset_at = None

        self.session.flush()

    def check_and_expire_subscriptions(self):
        """
        Check all subscriptions and expire if needed
        Should be run as a cron job daily
        """
        now = datetime.utcnow()

        expired_users = self.session.query(User).filter(
            User.subscription_status == "active",
            User.subscription_expires_at < now
        ).all()

        for user in expired_users:
            self.expire_subscription(user.user_id)

        self.session.flush()
        return len(expired_users)
