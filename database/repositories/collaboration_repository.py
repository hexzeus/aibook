"""
Collaboration Repository for managing book collaborators and comments
"""
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from database.models import BookCollaborator, Comment
import uuid
from datetime import datetime
import secrets


class CollaborationRepository:
    def __init__(self, db: Session):
        self.db = db

    # ====================
    # COLLABORATOR METHODS
    # ====================

    def add_collaborator(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        invited_by: uuid.UUID,
        role: str = 'viewer',
        **permissions
    ) -> BookCollaborator:
        """Add a collaborator to a book"""

        # Set default permissions based on role
        role_permissions = self._get_role_permissions(role)
        role_permissions.update(permissions)

        collaborator = BookCollaborator(
            book_id=book_id,
            user_id=user_id,
            invited_by=invited_by,
            role=role,
            status='active',
            invitation_accepted_at=datetime.utcnow(),
            **role_permissions
        )

        self.db.add(collaborator)
        self.db.commit()
        self.db.refresh(collaborator)

        return collaborator

    def create_invitation(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        invited_by: uuid.UUID,
        role: str = 'viewer'
    ) -> BookCollaborator:
        """Create a pending collaboration invitation"""

        role_permissions = self._get_role_permissions(role)

        # Generate secure invitation token
        invitation_token = secrets.token_urlsafe(32)

        collaborator = BookCollaborator(
            book_id=book_id,
            user_id=user_id,
            invited_by=invited_by,
            role=role,
            status='pending',
            invitation_token=invitation_token,
            invitation_sent_at=datetime.utcnow(),
            **role_permissions
        )

        self.db.add(collaborator)
        self.db.commit()
        self.db.refresh(collaborator)

        return collaborator

    def accept_invitation(
        self,
        invitation_token: str,
        user_id: uuid.UUID
    ) -> Optional[BookCollaborator]:
        """Accept a collaboration invitation"""

        collaborator = self.db.query(BookCollaborator).filter(
            BookCollaborator.invitation_token == invitation_token,
            BookCollaborator.user_id == user_id,
            BookCollaborator.status == 'pending'
        ).first()

        if not collaborator:
            return None

        collaborator.status = 'active'
        collaborator.invitation_accepted_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(collaborator)

        return collaborator

    def get_book_collaborators(
        self,
        book_id: uuid.UUID,
        include_pending: bool = False
    ) -> List[BookCollaborator]:
        """Get all collaborators for a book"""

        query = self.db.query(BookCollaborator).filter(
            BookCollaborator.book_id == book_id
        )

        if not include_pending:
            query = query.filter(BookCollaborator.status == 'active')

        return query.all()

    def get_user_books_with_access(
        self,
        user_id: uuid.UUID
    ) -> List[BookCollaborator]:
        """Get all books the user has access to as a collaborator"""

        return self.db.query(BookCollaborator).filter(
            BookCollaborator.user_id == user_id,
            BookCollaborator.status == 'active'
        ).all()

    def check_user_permission(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        permission: str
    ) -> bool:
        """Check if user has a specific permission on a book"""

        collaborator = self.db.query(BookCollaborator).filter(
            BookCollaborator.book_id == book_id,
            BookCollaborator.user_id == user_id,
            BookCollaborator.status == 'active'
        ).first()

        if not collaborator:
            return False

        # Check permission
        if permission == 'edit':
            return collaborator.can_edit
        elif permission == 'comment':
            return collaborator.can_comment
        elif permission == 'generate':
            return collaborator.can_generate
        elif permission == 'export':
            return collaborator.can_export
        elif permission == 'invite':
            return collaborator.can_invite

        return False

    def update_collaborator_role(
        self,
        collaborator_id: uuid.UUID,
        role: str
    ) -> Optional[BookCollaborator]:
        """Update a collaborator's role and permissions"""

        collaborator = self.db.query(BookCollaborator).filter(
            BookCollaborator.collaborator_id == collaborator_id
        ).first()

        if not collaborator:
            return None

        role_permissions = self._get_role_permissions(role)

        collaborator.role = role
        for key, value in role_permissions.items():
            setattr(collaborator, key, value)

        collaborator.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(collaborator)

        return collaborator

    def remove_collaborator(
        self,
        collaborator_id: uuid.UUID
    ) -> bool:
        """Remove a collaborator from a book"""

        collaborator = self.db.query(BookCollaborator).filter(
            BookCollaborator.collaborator_id == collaborator_id
        ).first()

        if not collaborator:
            return False

        self.db.delete(collaborator)
        self.db.commit()

        return True

    def _get_role_permissions(self, role: str) -> Dict:
        """Get default permissions for a role"""

        permissions = {
            'owner': {
                'can_edit': True,
                'can_comment': True,
                'can_generate': True,
                'can_export': True,
                'can_invite': True
            },
            'editor': {
                'can_edit': True,
                'can_comment': True,
                'can_generate': True,
                'can_export': True,
                'can_invite': False
            },
            'commenter': {
                'can_edit': False,
                'can_comment': True,
                'can_generate': False,
                'can_export': False,
                'can_invite': False
            },
            'viewer': {
                'can_edit': False,
                'can_comment': False,
                'can_generate': False,
                'can_export': False,
                'can_invite': False
            }
        }

        return permissions.get(role, permissions['viewer'])

    # ====================
    # COMMENT METHODS
    # ====================

    def create_comment(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str,
        page_id: Optional[uuid.UUID] = None,
        comment_type: str = 'general',
        parent_comment_id: Optional[uuid.UUID] = None,
        selected_text: Optional[str] = None,
        selection_start: Optional[int] = None,
        selection_end: Optional[int] = None
    ) -> Comment:
        """Create a new comment"""

        # If it's a reply, get the thread_id from parent
        thread_id = None
        if parent_comment_id:
            parent = self.db.query(Comment).filter(
                Comment.comment_id == parent_comment_id
            ).first()

            if parent:
                thread_id = parent.thread_id or parent.comment_id

        comment = Comment(
            book_id=book_id,
            page_id=page_id,
            user_id=user_id,
            content=content,
            comment_type=comment_type,
            parent_comment_id=parent_comment_id,
            thread_id=thread_id,
            selected_text=selected_text,
            selection_start=selection_start,
            selection_end=selection_end
        )

        # If it's a root comment, set thread_id to itself after creation
        if not parent_comment_id:
            self.db.add(comment)
            self.db.flush()
            comment.thread_id = comment.comment_id

        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)

        return comment

    def get_page_comments(
        self,
        page_id: uuid.UUID,
        include_resolved: bool = True,
        include_deleted: bool = False
    ) -> List[Comment]:
        """Get all comments for a page"""

        query = self.db.query(Comment).filter(
            Comment.page_id == page_id
        )

        if not include_resolved:
            query = query.filter(Comment.is_resolved == False)

        if not include_deleted:
            query = query.filter(Comment.is_deleted == False)

        return query.order_by(Comment.created_at).all()

    def get_book_comments(
        self,
        book_id: uuid.UUID,
        include_resolved: bool = True,
        include_deleted: bool = False
    ) -> List[Comment]:
        """Get all comments for a book"""

        query = self.db.query(Comment).filter(
            Comment.book_id == book_id
        )

        if not include_resolved:
            query = query.filter(Comment.is_resolved == False)

        if not include_deleted:
            query = query.filter(Comment.is_deleted == False)

        return query.order_by(Comment.created_at.desc()).all()

    def get_comment_thread(
        self,
        thread_id: uuid.UUID
    ) -> List[Comment]:
        """Get all comments in a thread"""

        return self.db.query(Comment).filter(
            Comment.thread_id == thread_id,
            Comment.is_deleted == False
        ).order_by(Comment.created_at).all()

    def update_comment(
        self,
        comment_id: uuid.UUID,
        user_id: uuid.UUID,
        content: str
    ) -> Optional[Comment]:
        """Update a comment's content"""

        comment = self.db.query(Comment).filter(
            Comment.comment_id == comment_id,
            Comment.user_id == user_id,
            Comment.is_deleted == False
        ).first()

        if not comment:
            return None

        comment.content = content
        comment.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(comment)

        return comment

    def resolve_comment(
        self,
        comment_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Optional[Comment]:
        """Mark a comment as resolved"""

        comment = self.db.query(Comment).filter(
            Comment.comment_id == comment_id,
            Comment.is_deleted == False
        ).first()

        if not comment:
            return None

        comment.is_resolved = True
        comment.resolved_by = user_id
        comment.resolved_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(comment)

        return comment

    def delete_comment(
        self,
        comment_id: uuid.UUID,
        user_id: uuid.UUID,
        soft_delete: bool = True
    ) -> bool:
        """Delete a comment"""

        comment = self.db.query(Comment).filter(
            Comment.comment_id == comment_id,
            Comment.user_id == user_id,
            Comment.is_deleted == False
        ).first()

        if not comment:
            return False

        if soft_delete:
            comment.is_deleted = True
            comment.deleted_at = datetime.utcnow()
            self.db.commit()
        else:
            self.db.delete(comment)
            self.db.commit()

        return True

    def get_unresolved_count(
        self,
        book_id: uuid.UUID,
        page_id: Optional[uuid.UUID] = None
    ) -> int:
        """Get count of unresolved comments"""

        query = self.db.query(Comment).filter(
            Comment.book_id == book_id,
            Comment.is_resolved == False,
            Comment.is_deleted == False
        )

        if page_id:
            query = query.filter(Comment.page_id == page_id)

        return query.count()
