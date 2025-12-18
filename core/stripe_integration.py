"""
Stripe Payment Integration for AI Book Generator
Alternative payment processor to Gumroad
"""
import os
from typing import Dict, Optional
import hmac
import hashlib


class StripeIntegration:
    """Handles Stripe payment processing"""

    def __init__(self):
        self.api_key = os.getenv('STRIPE_SECRET_KEY')
        self.webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        self.publishable_key = os.getenv('STRIPE_PUBLISHABLE_KEY')

    def create_checkout_session(
        self,
        price_id: str,
        customer_email: str,
        metadata: Dict
    ) -> Dict:
        """
        Create Stripe Checkout session for payment

        Args:
            price_id: Stripe Price ID
            customer_email: User email
            metadata: Custom metadata (user_id, package_id, etc.)

        Returns:
            Session URL and ID
        """
        try:
            import stripe
            stripe.api_key = self.api_key

            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{os.getenv('FRONTEND_URL')}/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{os.getenv('FRONTEND_URL')}/cancel",
                customer_email=customer_email,
                metadata=metadata
            )

            return {
                'session_id': session.id,
                'url': session.url
            }
        except Exception as e:
            raise Exception(f"Stripe checkout creation failed: {str(e)}")

    def create_subscription(
        self,
        price_id: str,
        customer_email: str,
        metadata: Dict
    ) -> Dict:
        """
        Create Stripe subscription

        Args:
            price_id: Stripe Price ID for subscription
            customer_email: User email
            metadata: Custom metadata

        Returns:
            Subscription details
        """
        try:
            import stripe
            stripe.api_key = self.api_key

            # Create customer
            customer = stripe.Customer.create(
                email=customer_email,
                metadata=metadata
            )

            # Create subscription
            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{'price': price_id}],
                metadata=metadata
            )

            return {
                'subscription_id': subscription.id,
                'customer_id': customer.id,
                'status': subscription.status
            }
        except Exception as e:
            raise Exception(f"Stripe subscription creation failed: {str(e)}")

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify Stripe webhook signature"""
        if not self.webhook_secret:
            # Development mode
            if os.getenv('ENVIRONMENT') == 'development':
                return True
            raise ValueError("STRIPE_WEBHOOK_SECRET not configured")

        try:
            import stripe
            stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return True
        except Exception:
            return False

    def process_webhook(self, event_data: Dict) -> Dict:
        """
        Process Stripe webhook events

        Events:
        - checkout.session.completed: One-time payment succeeded
        - invoice.paid: Subscription payment succeeded
        - customer.subscription.deleted: Subscription cancelled
        """
        event_type = event_data.get('type')
        data = event_data.get('data', {}).get('object', {})

        if event_type == 'checkout.session.completed':
            # One-time payment completed
            metadata = data.get('metadata', {})
            return {
                'event': 'payment_completed',
                'user_id': metadata.get('user_id'),
                'package_id': metadata.get('package_id'),
                'amount_cents': data.get('amount_total'),
                'customer_email': data.get('customer_email')
            }

        elif event_type == 'invoice.paid':
            # Subscription payment
            subscription_id = data.get('subscription')
            metadata = data.get('metadata', {})
            return {
                'event': 'subscription_paid',
                'subscription_id': subscription_id,
                'user_id': metadata.get('user_id'),
                'amount_cents': data.get('amount_paid'),
                'period_end': data.get('period_end')
            }

        elif event_type == 'customer.subscription.deleted':
            # Subscription cancelled
            metadata = data.get('metadata', {})
            return {
                'event': 'subscription_cancelled',
                'subscription_id': data.get('id'),
                'user_id': metadata.get('user_id')
            }

        return {'event': 'unknown', 'type': event_type}

    def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancel Stripe subscription"""
        try:
            import stripe
            stripe.api_key = self.api_key

            stripe.Subscription.delete(subscription_id)
            return True
        except Exception:
            return False

    def get_publishable_key(self) -> str:
        """Get Stripe publishable key for frontend"""
        return self.publishable_key
