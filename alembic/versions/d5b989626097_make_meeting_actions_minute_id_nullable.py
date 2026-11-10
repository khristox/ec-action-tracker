"""make meeting_actions.minute_id nullable

Revision ID: d5b989626097
Revises: f38bb934bd2e
Create Date: 2026-11-07 12:17:18.020800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5b989626097'
down_revision: Union[str, None] = 'f38bb934bd2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.alter_column('meeting_actions', 'minute_id', nullable=True)


def downgrade():
    op.alter_column('meeting_actions', 'minute_id', nullable=False)
