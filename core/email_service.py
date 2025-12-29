"""
Email Notification Service using Resend
Sends beautiful, transactional emails for Chaptera events
"""
import os
import resend
from typing import Optional, Dict, Any
from datetime import datetime


class EmailService:
    def __init__(self):
        self.api_key = os.getenv('RESEND_API_KEY', '')
        if self.api_key:
            resend.api_key = self.api_key
        self.from_email = os.getenv('FROM_EMAIL', 'Chaptera <noreply@chaptera.app>')
        self.enabled = bool(self.api_key)

    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Internal method to send email via Resend"""
        if not self.enabled:
            print(f"[EMAIL] Skipped (not configured): {subject} to {to_email}")
            return False

        try:
            params = {
                "from": self.from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }

            response = resend.Emails.send(params)
            print(f"[EMAIL] Sent: {subject} to {to_email} (ID: {response.get('id')})")
            return True

        except Exception as e:
            print(f"[EMAIL] Error sending to {to_email}: {str(e)}")
            return False

    def send_book_completion_email(
        self,
        to_email: str,
        user_name: str,
        book_title: str,
        book_id: str,
        page_count: int
    ) -> bool:
        """Notify user when their book generation is complete"""

        subject = f"🎉 Your Book '{book_title}' is Complete!"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); width: 60px; height: 60px; border-radius: 16px; display: inline-flex; align-items: center; justify-center; margin-bottom: 20px;">
                <span style="font-size: 32px;">✨</span>
            </div>
            <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">Chaptera</h1>
        </div>

        <!-- Main Content -->
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #7c3aed; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
                Your Book is Complete! 🎉
            </h2>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi {user_name or 'there'},
            </p>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Great news! Your book "<strong style="color: #ffffff;">{book_title}</strong>" has been successfully generated with <strong>{page_count} pages</strong> of AI-powered content.
            </p>

            <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px; padding: 20px; margin: 24px 0;">
                <p style="color: #ffffff; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">✅ Your book is ready to:</p>
                <ul style="color: #ffffff; font-size: 14px; margin: 0; padding-left: 20px;">
                    <li>Edit and refine pages</li>
                    <li>Generate AI illustrations</li>
                    <li>Export to EPUB, PDF, or DOCX</li>
                    <li>Translate into 15 languages</li>
                </ul>
            </div>

            <a href="https://chaptera.netlify.app/book/{book_id}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 8px;">
                View Your Book →
            </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 8px 0;">
                You're receiving this because you opted in to book completion notifications.
            </p>
            <p style="margin: 0;">
                <a href="https://chaptera.netlify.app/settings" style="color: #7c3aed; text-decoration: none;">Manage notification preferences</a>
            </p>
        </div>
    </div>
</body>
</html>
        """

        return self._send_email(to_email, subject, html_content)

    def send_page_generated_email(
        self,
        to_email: str,
        book_title: str,
        page_number: int,
        book_id: str
    ) -> bool:
        """Notify user when a new page is generated"""

        subject = f"📄 New Page Generated - {book_title}"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px;">
            <h2 style="color: #10b981; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">
                📄 New Page Generated
            </h2>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Page <strong>{page_number}</strong> has been added to "<strong style="color: #ffffff;">{book_title}</strong>".
            </p>

            <a href="https://chaptera.netlify.app/editor/{book_id}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px;">
                View in Editor →
            </a>
        </div>
    </div>
</body>
</html>
        """

        return self._send_email(to_email, subject, html_content)

    def send_low_credits_email(
        self,
        to_email: str,
        user_name: str,
        credits_remaining: int
    ) -> bool:
        """Alert user when credits are running low"""

        subject = f"⚠️ Low Credits Alert - {credits_remaining} Remaining"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px;">
            <h2 style="color: #f59e0b; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
                ⚠️ Running Low on Credits
            </h2>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hi {user_name or 'there'},
            </p>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                You have <strong style="color: #f59e0b; font-size: 20px;">{credits_remaining} credits</strong> remaining.
            </p>

            <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 8px;">
                <p style="color: #fbbf24; font-size: 14px; margin: 0; font-weight: 600;">
                    💡 Don't let your creativity stop! Purchase more credits to continue creating amazing books.
                </p>
            </div>

            <a href="https://chaptera.netlify.app/credits" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                Purchase Credits →
            </a>
        </div>
    </div>
</body>
</html>
        """

        return self._send_email(to_email, subject, html_content)

    def send_affiliate_earnings_email(
        self,
        to_email: str,
        user_name: str,
        commission_amount: float,
        total_earnings: float
    ) -> bool:
        """Notify user of new affiliate commission"""

        subject = f"💰 You Earned ${commission_amount:.2f} - Affiliate Commission"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px;">
            <h2 style="color: #10b981; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
                💰 New Affiliate Earnings!
            </h2>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Hi {user_name or 'there'},
            </p>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Congratulations! You just earned <strong style="color: #10b981; font-size: 24px;">${commission_amount:.2f}</strong> in affiliate commission.
            </p>

            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                <p style="color: #ffffff; font-size: 14px; margin: 0 0 8px 0; opacity: 0.9;">Total Earnings</p>
                <p style="color: #ffffff; font-size: 32px; font-weight: 700; margin: 0;">${total_earnings:.2f}</p>
            </div>

            <p style="color: #d1d5db; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Keep sharing Chaptera to earn even more! You'll receive payouts via PayPal once you reach $50.
            </p>

            <a href="https://chaptera.netlify.app/affiliate" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 16px;">
                View Dashboard →
            </a>
        </div>
    </div>
</body>
</html>
        """

        return self._send_email(to_email, subject, html_content)

    def send_weekly_digest_email(
        self,
        to_email: str,
        user_name: str,
        stats: Dict[str, Any]
    ) -> bool:
        """Send weekly activity summary"""

        subject = "📊 Your Weekly Chaptera Summary"

        books_created = stats.get('books_created', 0)
        pages_generated = stats.get('pages_generated', 0)
        exports = stats.get('exports', 0)
        credits_used = stats.get('credits_used', 0)

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px;">
            <h2 style="color: #7c3aed; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">
                📊 Your Weekly Summary
            </h2>

            <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi {user_name or 'there'}, here's what you accomplished this week:
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
                <div style="background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #a78bfa; font-size: 28px; font-weight: 700; margin: 0;">{books_created}</p>
                    <p style="color: #d1d5db; font-size: 14px; margin: 8px 0 0 0;">Books Created</p>
                </div>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #34d399; font-size: 28px; font-weight: 700; margin: 0;">{pages_generated}</p>
                    <p style="color: #d1d5db; font-size: 14px; margin: 8px 0 0 0;">Pages Generated</p>
                </div>
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #fbbf24; font-size: 28px; font-weight: 700; margin: 0;">{exports}</p>
                    <p style="color: #d1d5db; font-size: 14px; margin: 8px 0 0 0;">Exports</p>
                </div>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 20px; text-align: center;">
                    <p style="color: #f87171; font-size: 28px; font-weight: 700; margin: 0;">{credits_used}</p>
                    <p style="color: #d1d5db; font-size: 14px; margin: 8px 0 0 0;">Credits Used</p>
                </div>
            </div>

            <a href="https://chaptera.netlify.app/library" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 16px;">
                View Your Library →
            </a>
        </div>
    </div>
</body>
</html>
        """

        return self._send_email(to_email, subject, html_content)
