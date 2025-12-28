"""
Enhanced Gumroad validator with credit-based licensing
"""
import httpx
import os
from typing import Tuple, Optional, Dict, List


class GumroadValidator:
    """
    Gumroad license validator with credit package detection
    """

    def __init__(self):
        self.access_token = os.getenv('GUMROAD_ACCESS_TOKEN')

        # Product IDs for different credit packages
        self.product_ids = {
            'starter': os.getenv('GUMROAD_PRODUCT_ID_STARTER', 'aibook-starter-1k'),
            'pro': os.getenv('GUMROAD_PRODUCT_ID_PRO', 'aibook-pro-3k'),
            'business': os.getenv('GUMROAD_PRODUCT_ID_BUSINESS', 'aibook-business-7k'),
            'enterprise': os.getenv('GUMROAD_PRODUCT_ID_ENTERPRISE', 'aibook-enterprise-17k')
        }

        # Credits per package
        self.credit_packages = {
            'starter': 1000,
            'pro': 3000,
            'business': 7000,
            'enterprise': 17000
        }

        # Price per package (in cents)
        self.package_prices = {
            'starter': 1900,   # $19
            'pro': 4900,       # $49
            'business': 9900,  # $99
            'enterprise': 19900  # $199
        }

    def _get_package_tier(self, product_id: str) -> Optional[str]:
        """Determine package tier from product ID"""
        for tier, pid in self.product_ids.items():
            if pid == product_id:
                return tier
        return None

    def _get_credits_for_tier(self, tier: str) -> int:
        """Get credit amount for package tier"""
        return self.credit_packages.get(tier, 1000)

    def _get_price_for_tier(self, tier: str) -> int:
        """Get price in cents for package tier"""
        return self.package_prices.get(tier, 1900)

    async def verify_license(
        self,
        license_key: str,
        increment_uses: bool = False
    ) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Verify Gumroad license key and get purchase details

        Args:
            license_key: License key to verify
            increment_uses: Whether to increment use count in Gumroad

        Returns:
            Tuple of (is_valid, error_message, purchase_data)
            purchase_data contains: {
                'product_id': str,
                'product_name': str,
                'sale_id': str,
                'email': str,
                'tier': str,
                'credits': int,
                'price_cents': int,
                'purchase_date': str,
                'refunded': bool
            }
        """
        if not self.access_token:
            return False, "Gumroad not configured", None

        try:
            # Try each product ID separately (Gumroad doesn't support comma-separated IDs)
            print(f"[GUMROAD] Checking license key against {len(self.product_ids)} products...")

            async with httpx.AsyncClient(timeout=10.0) as client:
                # Try each product ID until we find a match
                for tier, product_id in self.product_ids.items():
                    print(f"[GUMROAD] Trying product: {tier} ({product_id})")

                    response = await client.post(
                        'https://api.gumroad.com/v2/licenses/verify',
                        data={
                            'product_id': product_id,
                            'license_key': license_key,
                            'increment_uses_count': 'true' if increment_uses else 'false'
                        },
                        headers={'Authorization': f'Bearer {self.access_token}'}
                    )

                    data = response.json()
                    print(f"[GUMROAD] API Response for {tier}: {data}")

                    # If successful, we found the right product
                    if data.get('success'):
                        print(f"[GUMROAD] License key matched to product: {tier}")
                        break

                    # If this is the last product and still no match, return error
                    if tier == list(self.product_ids.keys())[-1]:
                        return False, "Invalid license key", None

                # If we get here, data contains the successful response
                if not data.get('success'):
                    return False, data.get('message', 'License validation failed'), None

                purchase = data.get('purchase', {})
                product_id = purchase.get('product_id')

                # Check if it's a test purchase (free purchases on your own products)
                is_test = purchase.get('test', False)
                if is_test:
                    print(f"[GUMROAD] Test purchase detected - allowing in development mode")
                    # Allow test purchases in development, but warn in production
                    environment = os.getenv('ENVIRONMENT', 'development')
                    if environment == 'production':
                        print(f"[GUMROAD] WARNING: Test purchase used in production environment")

                # Check if refunded
                if purchase.get('refunded') or purchase.get('chargebacked'):
                    return False, "This license has been refunded", None

                # Determine package tier
                tier = self._get_package_tier(product_id)
                if not tier:
                    # If product ID doesn't match any known tier, default to starter
                    tier = 'starter'

                purchase_data = {
                    'product_id': product_id,
                    'product_name': purchase.get('product_name', 'AI Book Generator'),
                    'sale_id': purchase.get('sale_id'),
                    'email': purchase.get('email'),
                    'tier': tier,
                    'credits': self._get_credits_for_tier(tier),
                    'price_cents': self._get_price_for_tier(tier),
                    'purchase_date': purchase.get('created_at'),
                    'refunded': purchase.get('refunded', False),
                    'subscription_id': purchase.get('subscription_id'),
                    'variants': purchase.get('variants', '')
                }

                return True, None, purchase_data

        except httpx.TimeoutException:
            return False, "License verification timed out", None
        except httpx.RequestError as e:
            return False, f"License verification failed: {str(e)}", None
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", None

    async def verify_license_simple(self, license_key: str) -> bool:
        """
        Simple license verification (returns only True/False)

        Args:
            license_key: License key to verify

        Returns:
            bool: True if valid, False otherwise
        """
        is_valid, _, _ = await self.verify_license(license_key, increment_uses=False)
        return is_valid

    def get_tier_info(self, tier: str) -> Dict:
        """
        Get information about a package tier

        Args:
            tier: Package tier name (starter, pro, business, enterprise)

        Returns:
            Dict with tier information
        """
        return {
            'tier': tier,
            'credits': self._get_credits_for_tier(tier),
            'price_cents': self._get_price_for_tier(tier),
            'price_display': f"${self._get_price_for_tier(tier) / 100:.2f}",
            'product_id': self.product_ids.get(tier)
        }

    def get_all_tiers(self) -> List[Dict]:
        """Get information about all package tiers"""
        return [
            self.get_tier_info(tier)
            for tier in ['starter', 'pro', 'business', 'enterprise']
        ]
