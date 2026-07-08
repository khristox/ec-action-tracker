from asyncio.log import logger
import base64
from pathlib import Path
from typing import Optional
import mimetypes

class LogoService:
    @staticmethod
    def get_logo_as_base64(file_path: str) -> Optional[str]:
        """Convert image to base64 data URL for embedding in emails."""
        try:
            path = Path(file_path)
            if not path.exists():
                return None
            
            with open(path, 'rb') as f:
                image_data = f.read()
            
            mime_type = mimetypes.guess_type(file_path)[0] or 'image/png'
            base64_data = base64.b64encode(image_data).decode('utf-8')
            
            return f"data:{mime_type};base64,{base64_data}"
        except Exception as e:
            logger.error(f"Error converting logo to base64: {e}")
            return None
    
    @staticmethod
    def get_logo_url(logo_path: str, use_base64: bool = False) -> Optional[str]:
        """Get logo URL or base64 encoded image."""
        if use_base64:
            return LogoService.get_logo_as_base64(logo_path)
        return logo_path