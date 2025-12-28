"""
Character Repository for managing book characters
"""
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from database.models import Character
import uuid
from datetime import datetime


class CharacterRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_character(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        name: str,
        role: Optional[str] = None,
        description: Optional[str] = None,
        **kwargs
    ) -> Character:
        """Create a new character"""
        character = Character(
            book_id=book_id,
            user_id=user_id,
            name=name,
            role=role,
            description=description,
            **kwargs
        )

        self.db.add(character)
        self.db.commit()
        self.db.refresh(character)

        return character

    def get_character(
        self,
        character_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Optional[Character]:
        """Get a single character by ID"""
        return self.db.query(Character).filter(
            Character.character_id == character_id,
            Character.user_id == user_id,
            Character.is_deleted == False
        ).first()

    def get_book_characters(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        include_deleted: bool = False
    ) -> List[Character]:
        """Get all characters for a book"""
        query = self.db.query(Character).filter(
            Character.book_id == book_id,
            Character.user_id == user_id
        )

        if not include_deleted:
            query = query.filter(Character.is_deleted == False)

        return query.order_by(Character.importance_level.desc(), Character.created_at).all()

    def update_character(
        self,
        character_id: uuid.UUID,
        user_id: uuid.UUID,
        **updates
    ) -> Optional[Character]:
        """Update character fields"""
        character = self.get_character(character_id, user_id)

        if not character:
            return None

        for field, value in updates.items():
            if hasattr(character, field):
                setattr(character, field, value)

        character.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(character)

        return character

    def delete_character(
        self,
        character_id: uuid.UUID,
        user_id: uuid.UUID,
        soft_delete: bool = True
    ) -> bool:
        """Delete a character (soft or hard delete)"""
        character = self.get_character(character_id, user_id)

        if not character:
            return False

        if soft_delete:
            character.is_deleted = True
            character.deleted_at = datetime.utcnow()
            self.db.commit()
        else:
            self.db.delete(character)
            self.db.commit()

        return True

    def get_characters_by_role(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str
    ) -> List[Character]:
        """Get all characters with a specific role"""
        return self.db.query(Character).filter(
            Character.book_id == book_id,
            Character.user_id == user_id,
            Character.role == role,
            Character.is_deleted == False
        ).all()

    def get_major_characters(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID,
        min_importance: int = 7
    ) -> List[Character]:
        """Get major characters (high importance level)"""
        return self.db.query(Character).filter(
            Character.book_id == book_id,
            Character.user_id == user_id,
            Character.importance_level >= min_importance,
            Character.is_deleted == False
        ).order_by(Character.importance_level.desc()).all()

    def generate_character_context(
        self,
        book_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> str:
        """Generate a context string for AI with all character information"""
        characters = self.get_book_characters(book_id, user_id)

        if not characters:
            return ""

        context_parts = ["CHARACTER PROFILES:"]

        for char in characters:
            char_info = [f"\n{char.name} ({char.role or 'character'})"]

            if char.description:
                char_info.append(f"  Description: {char.description}")

            if char.personality:
                char_info.append(f"  Personality: {char.personality}")

            if char.goal:
                char_info.append(f"  Goal: {char.goal}")

            if char.motivation:
                char_info.append(f"  Motivation: {char.motivation}")

            if char.speech_patterns:
                char_info.append(f"  Speech: {char.speech_patterns}")

            if char.traits:
                traits_str = ", ".join([f"{k}: {', '.join(v)}" for k, v in char.traits.items() if v])
                if traits_str:
                    char_info.append(f"  Traits: {traits_str}")

            context_parts.append("\n".join(char_info))

        return "\n".join(context_parts)
