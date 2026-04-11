# app/services/csv_parser.py
import csv
import io
from typing import List, Dict, Any, Tuple
from pydantic import ValidationError

class CSVParserService:
    """Service for parsing CSV files"""
    
    REQUIRED_HEADERS = ['name']
    OPTIONAL_HEADERS = ['email', 'telephone', 'title', 'organization', 'notes']
    ALL_HEADERS = REQUIRED_HEADERS + OPTIONAL_HEADERS
    
    @classmethod
    def parse_csv_content(cls, csv_content: str) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
        """
        Parse CSV content and return rows, headers, and errors.
        Returns (rows, headers, errors)
        """
        rows = []
        errors = []
        
        try:
            csv_reader = csv.DictReader(io.StringIO(csv_content))
            headers = csv_reader.fieldnames or []
            
            # Validate headers
            missing_headers = [h for h in cls.REQUIRED_HEADERS if h not in headers]
            if missing_headers:
                errors.append(f"Missing required headers: {', '.join(missing_headers)}")
                return [], headers, errors
            
            # Parse rows
            for row_num, row in enumerate(csv_reader, start=2):
                # Clean row data
                cleaned_row = {}
                row_errors = []
                
                # Check required fields
                if not row.get('name') or not row['name'].strip():
                    row_errors.append(f"Row {row_num}: Name is required")
                else:
                    cleaned_row['name'] = row['name'].strip()
                
                # Optional fields
                for field in cls.OPTIONAL_HEADERS:
                    value = row.get(field, '').strip()
                    cleaned_row[field] = value if value else None
                
                rows.append({
                    'row_number': row_num,
                    'data': cleaned_row,
                    'errors': row_errors
                })
            
            return rows, headers, errors
            
        except Exception as e:
            errors.append(f"Error parsing CSV: {str(e)}")
            return [], [], errors
    
    @classmethod
    def generate_template_csv(cls) -> str:
        """Generate a template CSV file as string"""
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=cls.ALL_HEADERS)
        writer.writeheader()
        
        # Add example row
        writer.writerow({
            'name': 'John Doe',
            'email': 'john.doe@example.com',
            'telephone': '+256712345678',
            'title': 'Project Manager',
            'organization': 'Electoral Commission',
            'notes': 'Key stakeholder for the project'
        })
        
        return output.getvalue()