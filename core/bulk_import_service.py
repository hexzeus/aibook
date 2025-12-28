"""
Bulk Import Service for CSV and batch operations
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from database.models import BulkImportJob, Book
from database.repositories import BookRepository, UserRepository, UsageRepository
import uuid
from datetime import datetime
import csv
import io
import asyncio


class BulkImportService:
    def __init__(self, db: Session):
        self.db = db

    def create_job(
        self,
        user_id: uuid.UUID,
        job_type: str,
        config: Dict,
        estimated_credits: int = 0
    ) -> BulkImportJob:
        """Create a new bulk import job"""

        job = BulkImportJob(
            user_id=user_id,
            job_type=job_type,
            status='pending',
            config=config,
            estimated_credits=estimated_credits
        )

        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)

        return job

    def get_job(self, job_id: uuid.UUID) -> Optional[BulkImportJob]:
        """Get a job by ID"""
        return self.db.query(BulkImportJob).filter(
            BulkImportJob.job_id == job_id
        ).first()

    def get_user_jobs(
        self,
        user_id: uuid.UUID,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[BulkImportJob]:
        """Get all jobs for a user"""

        query = self.db.query(BulkImportJob).filter(
            BulkImportJob.user_id == user_id
        )

        if status:
            query = query.filter(BulkImportJob.status == status)

        return query.order_by(BulkImportJob.created_at.desc()).limit(limit).all()

    def update_job_progress(
        self,
        job_id: uuid.UUID,
        processed_items: int,
        failed_items: int = 0,
        status: Optional[str] = None
    ) -> BulkImportJob:
        """Update job progress"""

        job = self.get_job(job_id)

        if not job:
            raise ValueError("Job not found")

        job.processed_items = processed_items
        job.failed_items = failed_items

        if job.total_items > 0:
            job.progress_percentage = int((processed_items / job.total_items) * 100)

        if status:
            job.status = status

            if status == 'processing' and not job.started_at:
                job.started_at = datetime.utcnow()
            elif status in ['completed', 'failed']:
                job.completed_at = datetime.utcnow()

        job.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(job)

        return job

    def parse_csv(self, csv_content: str) -> List[Dict]:
        """Parse CSV content into list of dictionaries"""

        reader = csv.DictReader(io.StringIO(csv_content))
        rows = []

        for row in reader:
            rows.append(row)

        return rows

    def validate_csv_structure(self, rows: List[Dict]) -> Dict:
        """Validate CSV structure for book import"""

        if not rows:
            return {"valid": False, "error": "CSV is empty"}

        # Check required columns
        required_cols = ['title', 'genre', 'target_pages']
        first_row = rows[0]

        missing_cols = [col for col in required_cols if col not in first_row]

        if missing_cols:
            return {
                "valid": False,
                "error": f"Missing required columns: {', '.join(missing_cols)}"
            }

        # Validate data
        errors = []

        for i, row in enumerate(rows):
            row_num = i + 2  # +2 for header and 1-indexing

            if not row.get('title'):
                errors.append(f"Row {row_num}: Missing title")

            try:
                pages = int(row.get('target_pages', 0))
                if pages < 1 or pages > 1000:
                    errors.append(f"Row {row_num}: target_pages must be 1-1000")
            except ValueError:
                errors.append(f"Row {row_num}: Invalid target_pages")

        if errors:
            return {
                "valid": False,
                "error": "; ".join(errors[:5])  # First 5 errors
            }

        return {"valid": True, "row_count": len(rows)}

    async def process_csv_import(
        self,
        job_id: uuid.UUID,
        csv_content: str,
        user_id: uuid.UUID
    ) -> BulkImportJob:
        """Process CSV import asynchronously"""

        job = self.get_job(job_id)

        if not job:
            raise ValueError("Job not found")

        try:
            # Update status
            self.update_job_progress(job_id, 0, status='processing')

            # Parse CSV
            rows = self.parse_csv(csv_content)
            job.total_items = len(rows)
            self.db.commit()

            # Process each row
            book_repo = BookRepository(self.db)
            usage_repo = UsageRepository(self.db)
            created_books = []
            errors = []

            for i, row in enumerate(rows):
                try:
                    # Create book
                    book_data = {
                        'title': row.get('title'),
                        'genre': row.get('genre'),
                        'target_pages': int(row.get('target_pages', 10)),
                        'age_range': row.get('age_range'),
                        'themes': row.get('themes', '').split(',') if row.get('themes') else None,
                        'tone': row.get('tone'),
                        'writing_style': row.get('writing_style')
                    }

                    # Create book structure
                    book = book_repo.create_book(
                        user_id=user_id,
                        **book_data
                    )

                    created_books.append(str(book.book_id))

                    # Log usage (1 credit per book creation)
                    usage_repo.log_action(
                        user_id=user_id,
                        action_type='csv_import_book',
                        book_id=book.book_id,
                        credits_consumed=1
                    )

                    job.credits_consumed += 1

                except Exception as e:
                    errors.append({
                        "row": i + 2,
                        "title": row.get('title'),
                        "error": str(e)
                    })

                # Update progress
                self.update_job_progress(job_id, i + 1, len(errors))

            # Complete job
            job.created_book_ids = created_books
            job.error_details = errors
            job.status = 'completed'
            job.completed_at = datetime.utcnow()

            self.db.commit()

            return job

        except Exception as e:
            # Mark job as failed
            job.status = 'failed'
            job.error_details = [{"error": str(e)}]
            job.completed_at = datetime.utcnow()
            self.db.commit()

            raise

    def estimate_credits(self, job_type: str, item_count: int) -> int:
        """Estimate credits needed for a bulk job"""

        credits_per_item = {
            'csv_import': 1,  # 1 credit per book creation
            'batch_generate': 10,  # 10 credits per book generation
            'bulk_translate': 5,  # 5 credits per translation
            'bulk_export': 0  # Free
        }

        return credits_per_item.get(job_type, 1) * item_count

    def cancel_job(self, job_id: uuid.UUID) -> bool:
        """Cancel a pending or processing job"""

        job = self.get_job(job_id)

        if not job or job.status in ['completed', 'failed', 'cancelled']:
            return False

        job.status = 'cancelled'
        job.completed_at = datetime.utcnow()

        self.db.commit()

        return True

    def delete_job(self, job_id: uuid.UUID) -> bool:
        """Delete a job record"""

        job = self.get_job(job_id)

        if not job:
            return False

        self.db.delete(job)
        self.db.commit()

        return True

    def get_job_summary(self, user_id: uuid.UUID) -> Dict:
        """Get summary of user's bulk jobs"""

        jobs = self.get_user_jobs(user_id, limit=100)

        total_jobs = len(jobs)
        completed_jobs = sum(1 for job in jobs if job.status == 'completed')
        failed_jobs = sum(1 for job in jobs if job.status == 'failed')
        total_items_processed = sum(job.processed_items for job in jobs)
        total_credits_consumed = sum(job.credits_consumed for job in jobs)

        return {
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "pending_jobs": total_jobs - completed_jobs - failed_jobs,
            "total_items_processed": total_items_processed,
            "total_credits_consumed": total_credits_consumed
        }
