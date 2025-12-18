"""
Analytics and Event Tracking for AI Book Generator
Tracks user behavior to optimize conversion and retention
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from database.models import User, Book, UsageLog, BookExport, DailyUsageSummary
import uuid


class AnalyticsService:
    """Service for tracking and analyzing user behavior"""

    def __init__(self, session: Session):
        self.session = session

    def track_event(
        self,
        user_id: uuid.UUID,
        event_type: str,
        metadata: Optional[Dict] = None
    ):
        """
        Track custom event
        Events: signup, login, book_created, page_generated, book_completed, export, credit_purchase
        """
        log = UsageLog(
            user_id=user_id,
            action_type=event_type,
            credits_consumed=0,
            metadata=metadata or {}
        )
        self.session.add(log)
        self.session.flush()

    def get_conversion_funnel(self, days: int = 30) -> Dict:
        """
        Calculate conversion funnel metrics
        signup -> first_book -> first_page -> book_complete -> export
        """
        since = datetime.utcnow() - timedelta(days=days)

        # Total signups
        total_users = self.session.query(func.count(User.user_id))\
            .filter(User.created_at >= since)\
            .scalar()

        # Users who created at least one book
        users_with_books = self.session.query(func.count(func.distinct(Book.user_id)))\
            .join(User)\
            .filter(
                User.created_at >= since,
                Book.created_at >= since
            )\
            .scalar()

        # Users who generated at least one page
        users_generated_pages = self.session.query(func.count(func.distinct(User.user_id)))\
            .join(UsageLog)\
            .filter(
                User.created_at >= since,
                UsageLog.action_type == 'page_generated',
                UsageLog.created_at >= since
            )\
            .scalar()

        # Users who completed a book
        users_completed = self.session.query(func.count(func.distinct(Book.user_id)))\
            .join(User)\
            .filter(
                User.created_at >= since,
                Book.is_completed == True,
                Book.completed_at >= since
            )\
            .scalar()

        # Users who exported
        users_exported = self.session.query(func.count(func.distinct(BookExport.user_id)))\
            .join(User)\
            .filter(
                User.created_at >= since,
                BookExport.created_at >= since
            )\
            .scalar()

        return {
            "period_days": days,
            "total_signups": total_users or 0,
            "created_book": users_with_books or 0,
            "generated_pages": users_generated_pages or 0,
            "completed_book": users_completed or 0,
            "exported_book": users_exported or 0,
            "conversion_rates": {
                "signup_to_book": (users_with_books / total_users * 100) if total_users else 0,
                "book_to_complete": (users_completed / users_with_books * 100) if users_with_books else 0,
                "complete_to_export": (users_exported / users_completed * 100) if users_completed else 0,
                "signup_to_export": (users_exported / total_users * 100) if total_users else 0
            }
        }

    def get_daily_stats(self, days: int = 30) -> List[Dict]:
        """Get daily usage statistics"""
        since = datetime.utcnow() - timedelta(days=days)

        stats = self.session.query(
            func.date(DailyUsageSummary.summary_date).label('date'),
            func.sum(DailyUsageSummary.new_users).label('new_users'),
            func.sum(DailyUsageSummary.active_users).label('active_users'),
            func.sum(DailyUsageSummary.books_created).label('books_created'),
            func.sum(DailyUsageSummary.pages_generated).label('pages_generated'),
            func.sum(DailyUsageSummary.exports_created).label('exports')
        )\
            .filter(DailyUsageSummary.summary_date >= since)\
            .group_by(func.date(DailyUsageSummary.summary_date))\
            .order_by(func.date(DailyUsageSummary.summary_date))\
            .all()

        return [
            {
                'date': str(s.date),
                'new_users': s.new_users or 0,
                'active_users': s.active_users or 0,
                'books_created': s.books_created or 0,
                'pages_generated': s.pages_generated or 0,
                'exports': s.exports or 0
            }
            for s in stats
        ]

    def get_user_cohort_analysis(self, cohort_months: int = 6) -> Dict:
        """Analyze user retention by signup cohort"""
        # Simplified cohort analysis
        since = datetime.utcnow() - timedelta(days=cohort_months * 30)

        cohorts = self.session.query(
            func.date_trunc('month', User.created_at).label('cohort'),
            func.count(User.user_id).label('users'),
            func.avg(User.total_credits).label('avg_credits_purchased'),
            func.avg(User.credits_used).label('avg_credits_used'),
            func.count(func.distinct(Book.book_id)).label('total_books')
        )\
            .outerjoin(Book)\
            .filter(User.created_at >= since)\
            .group_by(func.date_trunc('month', User.created_at))\
            .order_by(desc(func.date_trunc('month', User.created_at)))\
            .all()

        return [
            {
                'cohort_month': str(c.cohort),
                'user_count': c.users,
                'avg_credits_purchased': float(c.avg_credits_purchased or 0),
                'avg_credits_used': float(c.avg_credits_used or 0),
                'total_books_created': c.total_books or 0,
                'avg_books_per_user': (c.total_books / c.users) if c.users else 0
            }
            for c in cohorts
        ]

    def get_top_users(self, limit: int = 10) -> List[Dict]:
        """Get most active users by books created"""
        users = self.session.query(
            User.user_id,
            User.email,
            User.created_at,
            User.total_credits,
            User.credits_used,
            User.total_books_created,
            User.total_pages_generated,
            User.total_exports
        )\
            .order_by(desc(User.total_books_created))\
            .limit(limit)\
            .all()

        return [
            {
                'user_id': str(u.user_id),
                'email': u.email,
                'member_since': u.created_at.isoformat(),
                'books_created': u.total_books_created,
                'pages_generated': u.total_pages_generated,
                'exports': u.total_exports,
                'credits_purchased': u.total_credits,
                'credits_used': u.credits_used
            }
            for u in users
        ]

    def get_real_time_stats(self) -> Dict:
        """Get real-time statistics for social proof"""
        today = datetime.utcnow().date()

        books_today = self.session.query(func.count(Book.book_id))\
            .filter(func.date(Book.created_at) == today)\
            .scalar()

        # Count page generation events (simpler approach - just count the events)
        pages_today = self.session.query(func.count(UsageLog.log_id))\
            .filter(
                UsageLog.action_type == 'page_generated',
                func.date(UsageLog.created_at) == today
            )\
            .scalar()

        exports_today = self.session.query(func.count(BookExport.export_id))\
            .filter(func.date(BookExport.created_at) == today)\
            .scalar()

        active_users_today = self.session.query(func.count(func.distinct(User.user_id)))\
            .join(UsageLog)\
            .filter(func.date(UsageLog.created_at) == today)\
            .scalar()

        return {
            'books_created_today': books_today or 0,
            'pages_generated_today': pages_today or 0,
            'exports_today': exports_today or 0,
            'active_users_today': active_users_today or 0,
            'timestamp': datetime.utcnow().isoformat()
        }

    def get_credit_usage_stats(self) -> Dict:
        """Analyze credit usage patterns"""
        stats = self.session.query(
            func.sum(User.total_credits).label('total_credits_sold'),
            func.sum(User.credits_used).label('total_credits_consumed'),
            func.avg(User.total_credits).label('avg_credits_per_user'),
            func.avg(User.credits_used).label('avg_credits_used_per_user')
        ).first()

        return {
            'total_credits_sold': stats.total_credits_sold or 0,
            'total_credits_consumed': stats.total_credits_consumed or 0,
            'total_credits_remaining': (stats.total_credits_sold or 0) - (stats.total_credits_consumed or 0),
            'avg_credits_per_user': float(stats.avg_credits_per_user or 0),
            'avg_credits_used_per_user': float(stats.avg_credits_used_per_user or 0),
            'utilization_rate': ((stats.total_credits_consumed or 0) / (stats.total_credits_sold or 1)) * 100
        }
