# app/crud/action_tracker_import.py
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime

from app.crud.action_tracker import participant
from app.services.csv_parser import CSVParserService

class CRUDParticipantImport:
    """CRUD operations for bulk importing participants"""
    
    @staticmethod
    async def preview_import(
        db: AsyncSession,
        csv_content: str
    ) -> Dict[str, Any]:
        """Preview the import without actually saving"""
        from app.schemas.action_tracker_import import BulkImportPreviewRow
        
        # Parse CSV
        rows, headers, parse_errors = CSVParserService.parse_csv_content(csv_content)
        
        preview_rows = []
        valid_count = 0
        
        for row in rows:
            is_valid = len(row['errors']) == 0
            
            # Additional validation for duplicates
            if is_valid and row['data'].get('email'):
                existing = await participant.get_by_email(db, row['data']['email'])
                if existing:
                    is_valid = False
                    row['errors'].append(f"Email '{row['data']['email']}' already exists")
            
            preview_rows.append(BulkImportPreviewRow(
                row_number=row['row_number'],
                data=row['data'],
                errors=row['errors'],
                is_valid=is_valid
            ))
            
            if is_valid:
                valid_count += 1
        
        return {
            "total_rows": len(rows),
            "valid_rows": valid_count,
            "invalid_rows": len(rows) - valid_count,
            "preview": preview_rows[:50],  # Limit preview to 50 rows
            "headers": headers,
            "errors": parse_errors
        }
    
    @staticmethod
    async def execute_import(
        db: AsyncSession,
        csv_content: str,
        created_by_id: UUID,
        skip_duplicates: bool = True,
        add_to_list_id: UUID = None
    ) -> Dict[str, Any]:
        """Execute the import and save participants"""
        from app.schemas.action_tracker_import import BulkImportResult
        
        # Parse CSV
        rows, headers, parse_errors = CSVParserService.parse_csv_content(csv_content)
        
        if parse_errors:
            return BulkImportResult(
                total_processed=0,
                successfully_imported=0,
                failed=0,
                created_participants=[],
                errors=[{"error": e} for e in parse_errors]
            )
        
        created_participants = []
        errors = []
        successful = 0
        
        for row in rows:
            # Skip rows with validation errors
            if row['errors']:
                errors.append({
                    "row": row['row_number'],
                    "errors": row['errors'],
                    "data": row['data']
                })
                continue
            
            # Check for duplicate email
            if row['data'].get('email'):
                existing = await participant.get_by_email(db, row['data']['email'])
                if existing:
                    if skip_duplicates:
                        errors.append({
                            "row": row['row_number'],
                            "error": f"Email '{row['data']['email']}' already exists - skipped",
                            "data": row['data']
                        })
                        continue
                    else:
                        # Update existing instead of creating new
                        updated = await participant.update(
                            db,
                            id=existing.id,
                            obj_in=row['data'],
                            updated_by_id=created_by_id
                        )
                        created_participants.append(updated)
                        successful += 1
                        continue
            
            # Create new participant
            try:
                new_participant = await participant.create(
                    db,
                    obj_in=row['data'],
                    created_by_id=created_by_id
                )
                created_participants.append(new_participant)
                successful += 1
                
                # Add to list if specified
                if add_to_list_id and new_participant:
                    from app.crud.action_tracker import participant_list
                    await participant_list.add_participants_to_list_batch(
                        db, add_to_list_id, [new_participant.id], created_by_id
                    )
                    
            except Exception as e:
                errors.append({
                    "row": row['row_number'],
                    "error": str(e),
                    "data": row['data']
                })
        
        await db.commit()
        
        return {
            "total_processed": len(rows),
            "successfully_imported": successful,
            "failed": len(errors),
            "created_participants": [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "email": p.email
                } for p in created_participants
            ],
            "errors": errors
        }

# Create instance
participant_import = CRUDParticipantImport()