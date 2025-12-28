"""
Gumroad Webhook Handler for AI Book Generator
Processes purchase webhooks and instantly grants credits
"""
import hmac
import hashlib
from typing import Dict, Optional
from sqlalchemy.orm import Session
from database.repositories import UserRepository
from core.credit_packages import get_all_packages
import os


def verify_gumroad_signature(payload: bytes, signature: str) -> bool:
    """
    Verify Gumroad webhook signature

    Args:
        payload: Raw request body
        signature: X-Gumroad-Signature header value (may be empty)

    Returns:
        True if signature is valid or if signature verification is disabled

    Note:
        Gumroad's standard "Ping" webhooks don't include signatures.
        Only use signature verification if you've specifically configured it in Gumroad.
    """
    # If no signature provided, check if we should skip verification
    if not signature:
        # In development or if webhook secret not set, allow without signature
        if os.getenv("ENVIRONMENT") == "development":
            return True

        # In production, allow if GUMROAD_WEBHOOK_SECRET is not set
        # (means we're using basic Ping webhooks without signature)
        webhook_secret = os.getenv("GUMROAD_WEBHOOK_SECRET")
        if not webhook_secret:
            return True

        # If secret IS set but no signature provided, reject
        return False

    # If signature provided, verify it
    webhook_secret = os.getenv("GUMROAD_WEBHOOK_SECRET")
    if not webhook_secret:
        return False

    # Gumroad uses HMAC-SHA256
    expected_signature = hmac.new(
        webhook_secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


def process_gumroad_webhook(data: Dict, db: Session) -> Dict:
    """
    Process Gumroad webhook and grant credits

    Webhook events:
    - sale: New purchase
    - refund: Purchase refunded
    - dispute: Chargeback
    - dispute_won: Chargeback won

    Args:
        data: Webhook payload
        db: Database session

    Returns:
        Response dict
    """
    event_type = data.get("type", "sale")
    sale_data = data.get("sale", data)  # Sometimes nested, sometimes not

    # Extract key data
    license_key = sale_data.get("license_key")
    email = sale_data.get("email")
    product_permalink = sale_data.get("product_permalink", "")
    sale_id = sale_data.get("sale_id")
    price_cents = int(float(sale_data.get("price", 0)) * 100)

    if not license_key:
        return {"success": False, "error": "No license key in webhook"}

    user_repo = UserRepository(db)

    # License tier mapping (permalink → credits)
    LICENSE_TIERS = {
        "aibook-starter-1k": {"credits": 1000, "tier": "starter"},
        "aibook-pro-3k": {"credits": 3000, "tier": "pro"},
        "aibook-business-7k": {"credits": 7000, "tier": "business"},
        "aibook-enterprise-17k": {"credits": 17000, "tier": "enterprise"}
    }

    # Match product to credit package
    credits_to_grant = 0
    package_id = None
    purchase_type = None  # 'license_tier' or 'credit_refill'

    # First, check if it's a license tier purchase
    for tier_permalink, tier_data in LICENSE_TIERS.items():
        if tier_permalink in product_permalink:
            credits_to_grant = tier_data["credits"]
            package_id = tier_data["tier"]
            purchase_type = "license_tier"
            print(f"[WEBHOOK] Matched license tier: {tier_permalink} → {credits_to_grant} credits")
            break

    # If not a license tier, check credit refill packages
    if not purchase_type:
        for package in get_all_packages():
            if package.gumroad_permalink in product_permalink:
                credits_to_grant = package.credits
                package_id = package.id
                purchase_type = "credit_refill"
                print(f"[WEBHOOK] Matched credit refill: {package.gumroad_permalink} → {credits_to_grant} credits")
                break

    # Log if no match found
    if credits_to_grant == 0:
        print(f"[WEBHOOK] WARNING: No matching package found for permalink: {product_permalink}")

    # Handle different events
    if event_type == "sale":
        # New purchase - grant credits
        user = user_repo.get_by_license_key(license_key)

        if not user:
            # Create new user
            user = user_repo.create_user(
                license_key=license_key,
                email=email,
                total_credits=credits_to_grant,
                gumroad_sale_id=sale_id,
                gumroad_product_id=product_permalink
            )
        else:
            # Existing user - add credits
            user_repo.add_credits(
                user_id=user.user_id,
                credits=credits_to_grant,
                purchase_data={
                    "sale_id": sale_id,
                    "product_name": product_permalink,
                    "price_cents": price_cents,
                    "credits": credits_to_grant,
                    "email": email
                }
            )

        db.commit()

        return {
            "success": True,
            "event": "sale",
            "license_key": license_key,
            "credits_granted": credits_to_grant,
            "package_id": package_id,
            "purchase_type": purchase_type
        }

    elif event_type == "refund":
        # Refund - deduct credits (but don't go negative)
        user = user_repo.get_by_license_key(license_key)

        if user and credits_to_grant > 0:
            # Deduct credits (mark purchase as refunded)
            user.total_credits = max(0, user.total_credits - credits_to_grant)
            db.commit()

        return {
            "success": True,
            "event": "refund",
            "license_key": license_key,
            "credits_deducted": credits_to_grant
        }

    elif event_type == "dispute":
        # Chargeback - ban user and deduct credits
        user = user_repo.get_by_license_key(license_key)

        if user:
            user_repo.ban_user(
                user_id=user.user_id,
                reason=f"Chargeback/dispute on sale {sale_id}"
            )
            db.commit()

        return {
            "success": True,
            "event": "dispute",
            "license_key": license_key,
            "action": "user_banned"
        }

    elif event_type == "dispute_won":
        # Dispute won - unban user
        user = user_repo.get_by_license_key(license_key)

        if user:
            user_repo.unban_user(user_id=user.user_id)
            db.commit()

        return {
            "success": True,
            "event": "dispute_won",
            "license_key": license_key,
            "action": "user_unbanned"
        }

    return {"success": False, "error": f"Unknown event type: {event_type}"}
