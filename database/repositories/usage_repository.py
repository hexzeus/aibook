"""
Usage repository - handles usage tracking and analytics
Fixed NoneType credits_used error
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from typing import Optional, List, Dict
from datetime import datetime, date
import uuid

from ..models import UsageLog, DailyUsageSummary, BookExport


class UsageRepository:
    """Repository for usage tracking and analytics"""

    def __init__(self, session: Session):
        self.session = session

    def log_action(
        self,
        user_id: uuid.UUID,
        action_type: str,
        credits_consumed: int = 0,
        book_id: Optional[uuid.UUID] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[uuid.UUID] = None,
        metadata: Optional[Dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> UsageLog:
        """Log user action"""
        print(f"[REPO] log_action called: {action_type}, credits={credits_consumed}", flush=True)
        log = UsageLog(
            user_id=user_id,
            action_type=action_type,
            credits_consumed=credits_consumed,
            book_id=book_id,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.session.add(log)
        print(f"[REPO] Usage log added, skipping flush (will commit later)", flush=True)
        # Don't flush here - causes session locks. Will commit at endpoint level.
        # self.session.flush()

        # Update daily summary
        print(f"[REPO] Updating daily summary...", flush=True)
        self._update_daily_summary(user_id, action_type, credits_consumed)
        print(f"[REPO] Daily summary updated", flush=True)

        return log

    def _update_daily_summary(self, user_id: uuid.UUID, action_type: str, credits_consumed: int):
        """Update or create daily usage summary with proper conflict handling"""
        today = date.today()

        # Use with_for_update to prevent race conditions
        summary = self.session.query(DailyUsageSummary).filter(
            and_(
                DailyUsageSummary.user_id == user_id,
                DailyUsageSummary.date == today
            )
        ).with_for_update(skip_locked=True).first()

        if not summary:
            # Try to create, but handle conflict if another transaction created it
            try:
                summary = DailyUsageSummary(
                    user_id=user_id,
                    date=today,
                    books_created=0,
                    pages_generated=0,
                    books_exported=0,
                    credits_used=0
                )
                self.session.add(summary)
                self.session.flush()
            except Exception as e:
                # If duplicate, rollback and fetch existing record
                if 'UniqueViolation' in str(e) or 'duplicate key' in str(e):
                    self.session.rollback()
                    summary = self.session.query(DailyUsageSummary).filter(
                        and_(
                            DailyUsageSummary.user_id == user_id,
                            DailyUsageSummary.date == today
                        )
                    ).first()
                else:
                    raise

        # Ensure fields are not None before incrementing
        if summary.books_created is None:
            summary.books_created = 0
        if summary.pages_generated is None:
            summary.pages_generated = 0
        if summary.books_exported is None:
            summary.books_exported = 0
        if summary.credits_used is None:
            summary.credits_used = 0

        # Update counters based on action type
        if action_type == 'book_created':
            summary.books_created += 1
        elif action_type == 'page_generated':
            summary.pages_generated += 1
        elif action_type == 'book_exported':
            summary.books_exported += 1

        summary.credits_used += credits_consumed
        print(f"[REPO] Daily summary updated, skipping flush (will commit later)", flush=True)
        # Don't flush here - causes session locks. Will commit at endpoint level.
        # self.session.flush()

    def get_user_usage_logs(
        self,
        user_id: uuid.UUID,
        action_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[UsageLog]:
        """Get usage logs for user"""
        query = self.session.query(UsageLog).filter(UsageLog.user_id == user_id)

        if action_type:
            query = query.filter(UsageLog.action_type == action_type)

        return query.order_by(desc(UsageLog.created_at)).limit(limit).offset(offset).all()

    def get_daily_summary(self, user_id: uuid.UUID, target_date: date) -> Optional[DailyUsageSummary]:
        """Get daily usage summary for specific date"""
        return self.session.query(DailyUsageSummary).filter(
            and_(
                DailyUsageSummary.user_id == user_id,
                DailyUsageSummary.date == target_date
            )
        ).first()

    def get_usage_stats(self, user_id: uuid.UUID) -> Dict:
        """Get comprehensive usage statistics"""
        # Total actions
        total_logs = self.session.query(func.count(UsageLog.log_id)).filter(
            UsageLog.user_id == user_id
        ).scalar()

        # Total credits consumed
        total_credits = self.session.query(func.sum(UsageLog.credits_consumed)).filter(
            UsageLog.user_id == user_id
        ).scalar() or 0

        # Action type breakdown
        action_counts = self.session.query(
            UsageLog.action_type,
            func.count(UsageLog.log_id)
        ).filter(
            UsageLog.user_id == user_id
        ).group_by(UsageLog.action_type).all()

        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow().date()
        recent_summaries = self.session.query(DailyUsageSummary).filter(
            and_(
                DailyUsageSummary.user_id == user_id,
                DailyUsageSummary.date >= thirty_days_ago
            )
        ).order_by(desc(DailyUsageSummary.date)).limit(30).all()

        return {
            'total_actions': total_logs,
            'total_credits_consumed': total_credits,
            'actions_by_type': {action: count for action, count in action_counts},
            'recent_activity': [
                {
                    'date': summary.date.isoformat(),
                    'books_created': summary.books_created,
                    'pages_generated': summary.pages_generated,
                    'books_exported': summary.books_exported,
                    'credits_used': summary.credits_used
                }
                for summary in recent_summaries
            ]
        }

    # Export tracking

    def create_export(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        format: str,
        file_size_bytes: Optional[int] = None,
        **kwargs
    ) -> BookExport:
        """Create export record"""
        export = BookExport(
            book_id=book_id,
            user_id=user_id,
            format=format,
            file_size_bytes=file_size_bytes,
            export_status='completed',
            **kwargs
        )
        self.session.add(export)
        self.session.flush()

        # Log the action
        self.log_action(
            user_id=user_id,
            action_type='book_exported',
            book_id=book_id,
            resource_type='export',
            resource_id=export.export_id,
            metadata={'format': format}
        )

        return export

    def get_export(self, export_id: uuid.UUID) -> Optional[BookExport]:
        """Get export by ID"""
        return self.session.query(BookExport).filter(
            BookExport.export_id == export_id
        ).first()

    def list_exports(
        self,
        user_id: Optional[uuid.UUID] = None,
        book_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[BookExport]:
        """List exports"""
        query = self.session.query(BookExport)

        if user_id:
            query = query.filter(BookExport.user_id == user_id)
        if book_id:
            query = query.filter(BookExport.book_id == book_id)

        return query.order_by(desc(BookExport.created_at)).limit(limit).offset(offset).all()

    def increment_download_count(self, export_id: uuid.UUID) -> Optional[BookExport]:
        """Increment export download count"""
        export = self.get_export(export_id)
        if export:
            export.download_count += 1
            export.last_downloaded_at = datetime.utcnow()
            self.session.flush()
        return export
