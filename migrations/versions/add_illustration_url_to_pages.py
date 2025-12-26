"""add illustration_url to pages

Revision ID: add_illustration_url
Revises:
Create Date: 2025-12-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_illustration_url'
down_revision = None  # Set this to your latest migration ID if you have one
branch_labels = None
depends_on = None


def upgrade():
    # Add illustration_url column to pages table
    op.add_column('pages', sa.Column('illustration_url', sa.String(length=1000), nullable=True))


def downgrade():
    # Remove illustration_url column from pages table
    op.drop_column('pages', 'illustration_url')
