"""
White Label Configuration Service
"""
from typing import Optional, Dict
from sqlalchemy.orm import Session
from database.models import WhiteLabelConfig
import uuid
from datetime import datetime
import secrets


class WhiteLabelService:
    def __init__(self, db: Session):
        self.db = db

    def get_config(self, user_id: uuid.UUID) -> Optional[WhiteLabelConfig]:
        """Get white label configuration for a user"""
        return self.db.query(WhiteLabelConfig).filter(
            WhiteLabelConfig.user_id == user_id
        ).first()

    def create_or_update_config(
        self,
        user_id: uuid.UUID,
        **config_data
    ) -> WhiteLabelConfig:
        """Create or update white label configuration"""

        config = self.get_config(user_id)

        if config:
            # Update existing
            for key, value in config_data.items():
                if hasattr(config, key):
                    setattr(config, key, value)

            config.updated_at = datetime.utcnow()
        else:
            # Create new
            config = WhiteLabelConfig(
                user_id=user_id,
                **config_data
            )
            self.db.add(config)

        self.db.commit()
        self.db.refresh(config)

        return config

    def set_custom_domain(
        self,
        user_id: uuid.UUID,
        custom_domain: str
    ) -> Dict:
        """Set a custom domain and generate verification token"""

        # Check if domain is already taken
        existing = self.db.query(WhiteLabelConfig).filter(
            WhiteLabelConfig.custom_domain == custom_domain,
            WhiteLabelConfig.user_id != user_id
        ).first()

        if existing:
            raise ValueError("Domain already in use")

        # Generate verification token
        verification_token = secrets.token_urlsafe(32)

        config = self.create_or_update_config(
            user_id=user_id,
            custom_domain=custom_domain,
            domain_verified=False,
            domain_verification_token=verification_token
        )

        return {
            "domain": custom_domain,
            "verification_token": verification_token,
            "instructions": f"Add TXT record to your DNS: _aibook-verify={verification_token}"
        }

    def verify_domain(
        self,
        user_id: uuid.UUID,
        domain: str
    ) -> bool:
        """Verify domain ownership via DNS TXT record"""

        config = self.get_config(user_id)

        if not config or config.custom_domain != domain:
            return False

        # TODO: Implement actual DNS verification
        # For now, we'll simulate verification
        # In production, use dnspython to query TXT records

        # import dns.resolver
        # try:
        #     answers = dns.resolver.resolve(f'_aibook-verify.{domain}', 'TXT')
        #     for rdata in answers:
        #         if config.domain_verification_token in str(rdata):
        #             # Verified!
        #             break
        # except:
        #     return False

        # For development, mark as verified immediately
        config.domain_verified = True
        config.domain_verified_at = datetime.utcnow()

        self.db.commit()

        return True

    def get_config_by_domain(self, domain: str) -> Optional[WhiteLabelConfig]:
        """Get configuration by custom domain"""
        return self.db.query(WhiteLabelConfig).filter(
            WhiteLabelConfig.custom_domain == domain,
            WhiteLabelConfig.domain_verified == True,
            WhiteLabelConfig.is_active == True
        ).first()

    def update_branding(
        self,
        user_id: uuid.UUID,
        brand_name: Optional[str] = None,
        logo_url: Optional[str] = None,
        favicon_url: Optional[str] = None,
        primary_color: Optional[str] = None,
        secondary_color: Optional[str] = None,
        accent_color: Optional[str] = None
    ) -> WhiteLabelConfig:
        """Update branding settings"""

        updates = {}
        if brand_name is not None:
            updates['brand_name'] = brand_name
        if logo_url is not None:
            updates['logo_url'] = logo_url
        if favicon_url is not None:
            updates['favicon_url'] = favicon_url
        if primary_color is not None:
            updates['primary_color'] = primary_color
        if secondary_color is not None:
            updates['secondary_color'] = secondary_color
        if accent_color is not None:
            updates['accent_color'] = accent_color

        return self.create_or_update_config(user_id, **updates)

    def update_contact_info(
        self,
        user_id: uuid.UUID,
        support_email: Optional[str] = None,
        company_name: Optional[str] = None,
        company_address: Optional[str] = None,
        privacy_policy_url: Optional[str] = None,
        terms_of_service_url: Optional[str] = None
    ) -> WhiteLabelConfig:
        """Update contact and legal information"""

        updates = {}
        if support_email is not None:
            updates['support_email'] = support_email
        if company_name is not None:
            updates['company_name'] = company_name
        if company_address is not None:
            updates['company_address'] = company_address
        if privacy_policy_url is not None:
            updates['privacy_policy_url'] = privacy_policy_url
        if terms_of_service_url is not None:
            updates['terms_of_service_url'] = terms_of_service_url

        return self.create_or_update_config(user_id, **updates)

    def update_analytics(
        self,
        user_id: uuid.UUID,
        google_analytics_id: Optional[str] = None,
        facebook_pixel_id: Optional[str] = None
    ) -> WhiteLabelConfig:
        """Update analytics tracking IDs"""

        updates = {}
        if google_analytics_id is not None:
            updates['google_analytics_id'] = google_analytics_id
        if facebook_pixel_id is not None:
            updates['facebook_pixel_id'] = facebook_pixel_id

        return self.create_or_update_config(user_id, **updates)

    def toggle_feature(
        self,
        user_id: uuid.UUID,
        feature: str,
        enabled: bool
    ) -> WhiteLabelConfig:
        """Toggle a white label feature"""

        if feature == 'hide_powered_by':
            return self.create_or_update_config(user_id, hide_powered_by=enabled)
        elif feature == 'is_active':
            return self.create_or_update_config(user_id, is_active=enabled)
        else:
            raise ValueError(f"Unknown feature: {feature}")

    def delete_config(self, user_id: uuid.UUID) -> bool:
        """Delete white label configuration"""

        config = self.get_config(user_id)

        if not config:
            return False

        self.db.delete(config)
        self.db.commit()

        return True

    def export_config(self, user_id: uuid.UUID) -> Dict:
        """Export configuration as dictionary"""

        config = self.get_config(user_id)

        if not config:
            return {}

        return {
            "domain": config.custom_domain,
            "domain_verified": config.domain_verified,
            "branding": {
                "brand_name": config.brand_name,
                "logo_url": config.logo_url,
                "favicon_url": config.favicon_url,
                "colors": {
                    "primary": config.primary_color,
                    "secondary": config.secondary_color,
                    "accent": config.accent_color
                }
            },
            "contact": {
                "support_email": config.support_email,
                "company_name": config.company_name,
                "company_address": config.company_address,
                "privacy_policy_url": config.privacy_policy_url,
                "terms_of_service_url": config.terms_of_service_url
            },
            "features": {
                "hide_powered_by": config.hide_powered_by,
                "custom_footer_text": config.custom_footer_text
            },
            "analytics": {
                "google_analytics_id": config.google_analytics_id,
                "facebook_pixel_id": config.facebook_pixel_id
            },
            "is_active": config.is_active
        }
