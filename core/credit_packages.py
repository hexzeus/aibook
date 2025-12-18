"""
Credit Package Definitions for AI Book Generator
"""
from dataclasses import dataclass
from typing import List


@dataclass
class CreditPackage:
    """Represents a credit package for purchase"""
    id: str
    name: str
    credits: int
    price_usd: int  # in cents
    price_display: str
    savings_percent: int
    gumroad_permalink: str
    badge: str  # "Popular", "Best Value", etc.
    is_featured: bool = False


# Credit Package Configurations
# Base rate: ~$0.05 per credit (1000 credits = $50)
# Discount structure: Larger packages = better value

CREDIT_PACKAGES: List[CreditPackage] = [
    CreditPackage(
        id="starter_100",
        name="Starter Pack",
        credits=100,
        price_usd=500,  # $5.00
        price_display="$5",
        savings_percent=0,
        gumroad_permalink="aibook-credits-100",
        badge="Getting Started",
        is_featured=False
    ),
    CreditPackage(
        id="popular_500",
        name="Popular Pack",
        credits=500,
        price_usd=2000,  # $20.00 (was $25, save 20%)
        price_display="$20",
        savings_percent=20,
        gumroad_permalink="aibook-credits-500",
        badge="Most Popular",
        is_featured=True
    ),
    CreditPackage(
        id="pro_1000",
        name="Pro Pack",
        credits=1000,
        price_usd=3500,  # $35.00 (was $50, save 30%)
        price_display="$35",
        savings_percent=30,
        gumroad_permalink="aibook-credits-1000",
        badge="Best Value",
        is_featured=True
    ),
    CreditPackage(
        id="business_5000",
        name="Business Pack",
        credits=5000,
        price_usd=15000,  # $150.00 (was $250, save 40%)
        price_display="$150",
        savings_percent=40,
        gumroad_permalink="aibook-credits-5000",
        badge="For Agencies",
        is_featured=False
    ),
]


def get_package_by_id(package_id: str) -> CreditPackage:
    """Get credit package by ID"""
    for package in CREDIT_PACKAGES:
        if package.id == package_id:
            return package
    return None


def get_all_packages() -> List[CreditPackage]:
    """Get all available credit packages"""
    return CREDIT_PACKAGES


def get_gumroad_url(package_id: str, base_url: str = "https://blazestudiox.gumroad.com/l") -> str:
    """Generate Gumroad purchase URL for package"""
    package = get_package_by_id(package_id)
    if not package:
        raise ValueError(f"Unknown package ID: {package_id}")
    return f"{base_url}/{package.gumroad_permalink}"


def calculate_credit_value(credits: int) -> dict:
    """Calculate best package recommendation for desired credits"""
    # Find the package that gives best value for desired amount
    best_package = None
    min_cost_per_credit = float('inf')

    for package in CREDIT_PACKAGES:
        if package.credits >= credits:
            cost_per_credit = package.price_usd / package.credits
            if cost_per_credit < min_cost_per_credit:
                min_cost_per_credit = cost_per_credit
                best_package = package

    # If no package has enough credits, recommend largest
    if not best_package:
        best_package = max(CREDIT_PACKAGES, key=lambda p: p.credits)

    return {
        "recommended_package": best_package,
        "cost_per_credit": min_cost_per_credit / 100,  # Convert to dollars
        "total_cost": best_package.price_usd / 100
    }
