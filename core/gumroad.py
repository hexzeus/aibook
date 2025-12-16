import os
import httpx
from typing import Tuple, Optional


class GumroadValidator:
    """Validates Gumroad license keys"""

    def __init__(self):
        self.product_id = os.getenv("GUMROAD_PRODUCT_ID")
        if not self.product_id:
            raise ValueError("GUMROAD_PRODUCT_ID not configured")

        self.verify_url = "https://api.gumroad.com/v2/licenses/verify"

    async def verify_license(self, license_key: str) -> Tuple[bool, str, Optional[str]]:
        """
        Verify a Gumroad license key

        Args:
            license_key: The license key to verify

        Returns:
            Tuple of (is_valid, error_message, product_id)
        """

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    self.verify_url,
                    data={
                        "product_id": self.product_id,
                        "license_key": license_key
                    }
                )

                data = response.json()

                if data.get("success"):
                    purchase = data.get("purchase", {})
                    product_id = purchase.get("product_id")
                    return True, "", product_id
                else:
                    return False, "Invalid or expired license key", None

        except Exception as e:
            return False, f"License verification failed: {str(e)}", None
