"""add is_system to meeting_minutes

Revision ID: fd4120b7930b
Revises: 21df652557cf
Create Date: 2026-11-07 21:59:04.247313

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd4120b7930b'
down_revision: Union[str, None] = '21df652557cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
