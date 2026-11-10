"""add is_system to meeting_minutes

Revision ID: 21df652557cf
Revises: d5b989626097
Create Date: 2026-11-07 21:57:14.933131

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21df652557cf'
down_revision: Union[str, None] = 'd5b989626097'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column('meeting_minutes',
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.false()))
    # mark the minutes the old code auto-created
    op.execute("""
        UPDATE meeting_minutes SET is_system = true
        WHERE topic LIKE 'Action Item - %'
          AND discussion LIKE 'Auto-created from action:%'
    """)

def downgrade():
    op.drop_column('meeting_minutes', 'is_system')
