"""migrate action statuses from attributes to action_statuses

Revision ID: 2c5f642e3d08
Revises: fd4120b7930b
Create Date: 2026-11-11 13:29:41.723313

Migrates the Action Tracker status architecture from the legacy
dynamic `attributes` table to the dedicated `action_statuses` table.

The migration is intentionally data-preserving:
- Existing attributes are not deleted.
- Existing action_statuses rows are preserved.
- Existing meeting action/status-history references are translated.
- Production UUIDs are not replaced with local UUIDs.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2c5f642e3d08"
down_revision: Union[str, None] = "fd4120b7930b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Canonical Action Tracker statuses
#
# These match the current local architecture.
#
# NOTE:
#   UUIDs are deliberately generated on the target database. We must not
#   copy local UUIDs into production.
# ---------------------------------------------------------------------------

CANONICAL_STATUSES = [
    {
        "code": "NOT_STARTED",
        "name": "Pending",
        "short_name": "PENDING",
        "description": "Action has not yet started.",
        "color": "#9e9e9e",
        "sort_order": 1,
        "is_active": False,
    },
    {
        "code": "IN_PROGRESS",
        "name": "In Progress",
        "short_name": "IN PROGRESS",
        "description": "Action is currently being implemented.",
        "color": "#2196f3",
        "sort_order": 2,
        "is_active": True,
    },
    {
        "code": "ON_HOLD",
        "name": "On Hold",
        "short_name": "ON HOLD",
        "description": "Action is temporarily on hold.",
        "color": "#ff9800",
        "sort_order": 3,
        "is_active": False,
    },
    {
        "code": "COMPLETED",
        "name": "Completed",
        "short_name": "COMPLETED",
        "description": "Action has been completed.",
        "color": "#4caf50",
        "sort_order": 4,
        "is_active": True,
    },
    {
        "code": "CANCELLED",
        "name": "Cancelled",
        "short_name": "CANCELLED",
        "description": "Action has been cancelled.",
        "color": "#f44336",
        "sort_order": 5,
        "is_active": True,
    },
]

# Legacy dynamic-attribute code -> canonical action_statuses code.
#
# These are the mappings that are safe according to the current application
# architecture and the local database.
LEGACY_TO_CANONICAL = {
    "ACTION_STATUS_PENDING": "NOT_STARTED",
    "ACTION_STATUS_IN_PROGRESS": "IN_PROGRESS",
    "ACTION_STATUS_COMPLETED": "COMPLETED",
    "ACTION_STATUS_CANCELLED": "CANCELLED",
    "ACTION_STATUS_BLOCKED": "ON_HOLD",
}


def _constraint_exists(connection, table_name: str, constraint_name: str) -> bool:
    inspector = sa.inspect(connection)

    return any(
        fk["name"] == constraint_name
        for fk in inspector.get_foreign_keys(table_name)
        if fk.get("name")
    )


def _drop_fk_if_exists(
    connection,
    table_name: str,
    constraint_name: str,
) -> None:
    if _constraint_exists(connection, table_name, constraint_name):
        op.drop_constraint(
            constraint_name,
            table_name,
            type_="foreignkey",
        )


def _ensure_action_statuses_table(connection) -> None:
    inspector = sa.inspect(connection)

    if "action_statuses" not in inspector.get_table_names():
        op.create_table(
            "action_statuses",

            sa.Column(
                "id",
                sa.UUID(),
                nullable=False,
            ),

            sa.Column(
                "code",
                sa.String(length=50),
                nullable=False,
            ),

            sa.Column(
                "name",
                sa.String(length=100),
                nullable=False,
            ),

            sa.Column(
                "short_name",
                sa.String(length=20),
                nullable=True,
            ),

            sa.Column(
                "description",
                sa.Text(),
                nullable=True,
            ),

            sa.Column(
                "color",
                sa.String(length=20),
                nullable=True,
            ),

            sa.Column(
                "sort_order",
                sa.Integer(),
                nullable=False,
            ),

            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
            ),

            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),

            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),

            sa.Column(
                "created_by_id",
                sa.UUID(),
                nullable=True,
            ),

            sa.Column(
                "updated_by_id",
                sa.UUID(),
                nullable=True,
            ),

            sa.PrimaryKeyConstraint(
                "id",
                name="action_statuses_pkey",
            ),
        )

    # These indexes/constraints are part of the local architecture.
    inspector = sa.inspect(connection)

    unique_constraints = inspector.get_unique_constraints(
        "action_statuses"
    )

    indexes = inspector.get_indexes("action_statuses")

    unique_codes = {
        constraint.get("name")
        for constraint in unique_constraints
        if constraint.get("column_names") == ["code"]
    }

    if "uq_action_statuses_code" not in unique_codes:
        # Only create the unique constraint if no equivalent constraint exists.
        existing_code_unique = any(
            constraint.get("column_names") == ["code"]
            for constraint in unique_constraints
        )

        if not existing_code_unique:
            op.create_unique_constraint(
                "uq_action_statuses_code",
                "action_statuses",
                ["code"],
            )

    existing_index_names = {
        index.get("name")
        for index in indexes
    }

    if "ix_action_statuses_code" not in existing_index_names:
        op.create_index(
            "ix_action_statuses_code",
            "action_statuses",
            ["code"],
        )

    if "ix_action_statuses_is_active" not in existing_index_names:
        op.create_index(
            "ix_action_statuses_is_active",
            "action_statuses",
            ["is_active"],
        )

    if "ix_action_statuses_sort_order" not in existing_index_names:
        op.create_index(
            "ix_action_statuses_sort_order",
            "action_statuses",
            ["sort_order"],
        )

    # Add the user foreign keys if the users table exists.
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    if "users" in tables:
        fk_names = {
            fk.get("name")
            for fk in inspector.get_foreign_keys("action_statuses")
        }

        if "action_statuses_created_by_id_fkey" not in fk_names:
            op.create_foreign_key(
                "action_statuses_created_by_id_fkey",
                "action_statuses",
                "users",
                ["created_by_id"],
                ["id"],
                ondelete="SET NULL",
            )

        if "action_statuses_updated_by_id_fkey" not in fk_names:
            op.create_foreign_key(
                "action_statuses_updated_by_id_fkey",
                "action_statuses",
                "users",
                ["updated_by_id"],
                ["id"],
                ondelete="SET NULL",
            )


def _ensure_canonical_statuses(connection) -> None:
    """
    Make action_statuses match the current canonical Action Tracker
    reference data.

    Existing production status rows are reused where possible rather than
    creating duplicate status rows.

    Known legacy action_statuses codes:
        pending      -> NOT_STARTED
        in_progress  -> IN_PROGRESS
        completed    -> COMPLETED
        blocked      -> ON_HOLD

    Unused legacy/reference statuses such as review and deferred are
    preserved but disabled.
    """

    # ------------------------------------------------------------------
    # First normalize known legacy action_statuses codes.
    #
    # This is different from the legacy `attributes` migration below.
    # Production already has an action_statuses table, but its reference
    # data was created using the older lowercase codes.
    # ------------------------------------------------------------------

    legacy_action_status_codes = {
        "pending": "NOT_STARTED",
        "in_progress": "IN_PROGRESS",
        "completed": "COMPLETED",
        "blocked": "ON_HOLD",
    }

    for legacy_code, canonical_code in legacy_action_status_codes.items():
        # If the canonical code already exists, we do not rename another
        # row into it because that could violate the unique(code) constraint.
        canonical_exists = connection.execute(
            sa.text(
                """
                SELECT id
                FROM action_statuses
                WHERE code = :canonical_code
                LIMIT 1
                """
            ),
            {"canonical_code": canonical_code},
        ).first()

        if canonical_exists:
            continue

        connection.execute(
            sa.text(
                """
                UPDATE action_statuses
                SET code = :canonical_code,
                    updated_at = now()
                WHERE LOWER(code) = :legacy_code
                """
            ),
            {
                "legacy_code": legacy_code,
                "canonical_code": canonical_code,
            },
        )

    # ------------------------------------------------------------------
    # Preserve unused legacy statuses but remove them from the active
    # Action Tracker status list.
    #
    # They are not referenced by current meeting_actions or
    # action_status_history according to the production data inspection.
    # ------------------------------------------------------------------

    connection.execute(
        sa.text(
            """
            UPDATE action_statuses
            SET is_active = FALSE,
                updated_at = now()
            WHERE LOWER(code) IN ('review', 'deferred')
            """
        )
    )

    # ------------------------------------------------------------------
    # Ensure all five canonical statuses exist and match local exactly.
    # ------------------------------------------------------------------

    for status in CANONICAL_STATUSES:
        result = connection.execute(
            sa.text(
                """
                SELECT id
                FROM action_statuses
                WHERE code = :code
                LIMIT 1
                """
            ),
            {"code": status["code"]},
        ).first()

        if result:
            connection.execute(
                sa.text(
                    """
                    UPDATE action_statuses
                    SET
                        code = :code,
                        name = :name,
                        short_name = :short_name,
                        description = :description,
                        color = :color,
                        sort_order = :sort_order,
                        is_active = :is_active,
                        updated_at = now()
                    WHERE id = :id
                    """
                ),
                {
                    "id": result[0],
                    **status,
                },
            )
        else:
            connection.execute(
                sa.text(
                    """
                    INSERT INTO action_statuses (
                        id,
                        code,
                        name,
                        short_name,
                        description,
                        color,
                        sort_order,
                        is_active,
                        created_at
                    )
                    VALUES (
                        gen_random_uuid(),
                        :code,
                        :name,
                        :short_name,
                        :description,
                        :color,
                        :sort_order,
                        :is_active,
                        now()
                    )
                    """
                ),
                status,
            )


def _migrate_meeting_action_statuses(connection) -> None:
    """Translate legacy attribute IDs to action_statuses IDs."""

    inspector = sa.inspect(connection)

    if "meeting_actions" not in inspector.get_table_names():
        return

    columns = {
        column["name"]
        for column in inspector.get_columns("meeting_actions")
    }

    if "overall_status_id" not in columns:
        return

    # Remove the old FK first. The column must temporarily be allowed to
    # contain the new action_statuses IDs.
    _drop_fk_if_exists(
        connection,
        "meeting_actions",
        "meeting_actions_overall_status_id_fkey",
    )

    # Translate only known legacy Action Tracker attributes.
    #
    # We do NOT blindly map arbitrary attributes based on their display name.
    # Unknown status values are intentionally left alone and will be checked
    # below.
    for legacy_code, canonical_code in LEGACY_TO_CANONICAL.items():
        connection.execute(
            sa.text(
                """
                UPDATE meeting_actions AS ma
                SET overall_status_id = s.id,
                    overall_status_name = s.name
                FROM attributes AS a
                JOIN action_statuses AS s
                  ON s.code = :canonical_code
                WHERE ma.overall_status_id = a.id
                  AND UPPER(a.code) = :legacy_code
                """
            ),
            {
                "legacy_code": legacy_code.upper(),
                "canonical_code": canonical_code,
            },
        )

    # Existing rows may already contain action_statuses IDs.
    # Leave those untouched.

    # Add the new FK.
    op.create_foreign_key(
        "meeting_actions_overall_status_id_fkey",
        "meeting_actions",
        "action_statuses",
        ["overall_status_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Validate every non-null reference.
    invalid = connection.execute(
        sa.text(
            """
            SELECT ma.id, ma.overall_status_id
            FROM meeting_actions AS ma
            LEFT JOIN action_statuses AS s
              ON s.id = ma.overall_status_id
            WHERE ma.overall_status_id IS NOT NULL
              AND s.id IS NULL
            LIMIT 20
            """
        )
    ).fetchall()

    if invalid:
        raise RuntimeError(
            "Migration aborted: meeting_actions contains status IDs "
            "that are neither valid action_statuses IDs nor recognized "
            f"legacy attributes. Sample rows: {invalid}"
        )


def _migrate_action_status_history(connection) -> None:
    """Translate legacy status-history attribute IDs if necessary."""

    inspector = sa.inspect(connection)

    if "action_status_history" not in inspector.get_table_names():
        return

    columns = {
        column["name"]
        for column in inspector.get_columns("action_status_history")
    }

    if "individual_status_id" not in columns:
        return

    _drop_fk_if_exists(
        connection,
        "action_status_history",
        "action_status_history_individual_status_id_fkey",
    )

    for legacy_code, canonical_code in LEGACY_TO_CANONICAL.items():
        connection.execute(
            sa.text(
                """
                UPDATE action_status_history AS ash
                SET individual_status_id = s.id
                FROM attributes AS a
                JOIN action_statuses AS s
                  ON s.code = :canonical_code
                WHERE ash.individual_status_id = a.id
                  AND UPPER(a.code) = :legacy_code
                """
            ),
            {
                "legacy_code": legacy_code.upper(),
                "canonical_code": canonical_code,
            },
        )

    op.create_foreign_key(
        "action_status_history_individual_status_id_fkey",
        "action_status_history",
        "action_statuses",
        ["individual_status_id"],
        ["id"],
        ondelete="SET NULL",
    )

    invalid = connection.execute(
        sa.text(
            """
            SELECT ash.id, ash.individual_status_id
            FROM action_status_history AS ash
            LEFT JOIN action_statuses AS s
              ON s.id = ash.individual_status_id
            WHERE ash.individual_status_id IS NOT NULL
              AND s.id IS NULL
            LIMIT 20
            """
        )
    ).fetchall()

    if invalid:
        raise RuntimeError(
            "Migration aborted: action_status_history contains status IDs "
            "that are neither valid action_statuses IDs nor recognized "
            f"legacy attributes. Sample rows: {invalid}"
        )


def upgrade() -> None:
    connection = op.get_bind()

    # 1. Ensure the dedicated status table exists and has the local schema.
    _ensure_action_statuses_table(connection)

    # 2. Ensure the canonical status reference data exists.
    _ensure_canonical_statuses(connection)

    # 3. Move meeting action status references.
    _migrate_meeting_action_statuses(connection)

    # 4. Move status-history references.
    _migrate_action_status_history(connection)

     # 5. Final integrity validation.
    invalid_actions = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM meeting_actions ma
            LEFT JOIN action_statuses s
                ON s.id = ma.overall_status_id
            WHERE ma.overall_status_id IS NOT NULL
            AND s.id IS NULL
            """
        )
    ).scalar_one()

    if invalid_actions:
        raise RuntimeError(
            f"Migration validation failed: {invalid_actions} "
            "meeting_actions contain invalid status references."
        )

    invalid_history = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM action_status_history ash
            LEFT JOIN action_statuses s
                ON s.id = ash.individual_status_id
            WHERE ash.individual_status_id IS NOT NULL
            AND s.id IS NULL
            """
        )
    ).scalar_one()

    if invalid_history:
        raise RuntimeError(
            f"Migration validation failed: {invalid_history} "
            "action_status_history rows contain invalid status references."
        )


def downgrade() -> None:
    connection = op.get_bind()

    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()

    if "action_statuses" not in tables:
        return

    # -----------------------------------------------------------------------
    # Reverse meeting_actions first.
    # -----------------------------------------------------------------------

    if "meeting_actions" in tables:
        columns = {
            column["name"]
            for column in inspector.get_columns("meeting_actions")
        }

        if "overall_status_id" in columns:
            _drop_fk_if_exists(
                connection,
                "meeting_actions",
                "meeting_actions_overall_status_id_fkey",
            )

            for canonical_code, legacy_code in {
                "NOT_STARTED": "ACTION_STATUS_PENDING",
                "IN_PROGRESS": "ACTION_STATUS_IN_PROGRESS",
                "COMPLETED": "ACTION_STATUS_COMPLETED",
                "CANCELLED": "ACTION_STATUS_CANCELLED",
                "ON_HOLD": "ACTION_STATUS_BLOCKED",
            }.items():
                connection.execute(
                    sa.text(
                        """
                        UPDATE meeting_actions AS ma
                        SET
                            overall_status_id = a.id,
                            overall_status_name = a.name
                        FROM action_statuses AS s
                        JOIN attributes AS a
                          ON UPPER(a.code) = :legacy_code
                        WHERE ma.overall_status_id = s.id
                          AND UPPER(s.code) = :canonical_code
                        """
                    ),
                    {
                        "canonical_code": canonical_code,
                        "legacy_code": legacy_code,
                    },
                )

            op.create_foreign_key(
                "meeting_actions_overall_status_id_fkey",
                "meeting_actions",
                "attributes",
                ["overall_status_id"],
                ["id"],
                ondelete="SET NULL",
            )

    # -----------------------------------------------------------------------
    # Reverse action_status_history.
    # -----------------------------------------------------------------------

    if "action_status_history" in tables:
        columns = {
            column["name"]
            for column in inspector.get_columns("action_status_history")
        }

        if "individual_status_id" in columns:
            _drop_fk_if_exists(
                connection,
                "action_status_history",
                "action_status_history_individual_status_id_fkey",
            )

            for canonical_code, legacy_code in {
                "NOT_STARTED": "ACTION_STATUS_PENDING",
                "IN_PROGRESS": "ACTION_STATUS_IN_PROGRESS",
                "COMPLETED": "ACTION_STATUS_COMPLETED",
                "CANCELLED": "ACTION_STATUS_CANCELLED",
                "ON_HOLD": "ACTION_STATUS_BLOCKED",
            }.items():
                connection.execute(
                    sa.text(
                        """
                        UPDATE action_status_history AS ash
                        SET individual_status_id = a.id
                        FROM action_statuses AS s
                        JOIN attributes AS a
                          ON UPPER(a.code) = :legacy_code
                        WHERE ash.individual_status_id = s.id
                          AND UPPER(s.code) = :canonical_code
                        """
                    ),
                    {
                        "canonical_code": canonical_code,
                        "legacy_code": legacy_code,
                    },
                )

            op.create_foreign_key(
                "action_status_history_individual_status_id_fkey",
                "action_status_history",
                "attributes",
                ["individual_status_id"],
                ["id"],
                ondelete="SET NULL",
            )

    # -----------------------------------------------------------------------
    # We deliberately do NOT drop action_statuses.
    #
    # A downgrade should not destroy application data/reference rows that
    # might have been created after this migration.
    # -----------------------------------------------------------------------