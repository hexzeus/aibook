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
# Premium pricing based on value delivery (5 illustrated books from 1000 credits)
# API costs: ~$0.02-0.03/credit | User value: $2000+ worth of content
# Discount structure: Larger packages = better value (up to 43% savings)

CREDIT_PACKAGES: List[CreditPackage] = [
    CreditPackage(
        id="starter_100",
        name="Starter Pack",
        credits=100,
        price_usd=700,  # $7.00
        price_display="$7",
        savings_percent=0,
        gumroad_permalink="aibook-credits-100",
        badge="Getting Started",
        is_featured=False
    ),
    CreditPackage(
        id="popular_500",
        name="Popular Pack",
        credits=500,
        price_usd=2900,  # $29.00 (save 17%)
        price_display="$29",
        savings_percent=17,
        gumroad_permalink="aibook-credits-500",
        badge="Most Popular",
        is_featured=True
    ),
    CreditPackage(
        id="pro_1000",
        name="Pro Pack",
        credits=1000,
        price_usd=4900,  # $49.00 (save 30%)
        price_display="$49",
        savings_percent=30,
        gumroad_permalink="aibook-credits-1000",
        badge="Best Value",
        is_featured=True
    ),
    CreditPackage(
        id="business_5000",
        name="Business Pack",
        credits=5000,
        price_usd=19900,  # $199.00 (save 43%)
        price_display="$199",
        savings_percent=43,
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
