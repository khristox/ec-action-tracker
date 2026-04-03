# app/core/logging.py
import logging
import sys
from typing import Optional
from pathlib import Path

# Define log format
DEFAULT_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s"
DEFAULT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

class CustomFormatter(logging.Formatter):
    """Custom formatter with colors for console output"""
    
    # ANSI color codes
    GREY = "\x1b[38;21m"
    BLUE = "\x1b[38;5;39m"
    YELLOW = "\x1b[38;5;226m"
    RED = "\x1b[38;5;196m"
    BOLD_RED = "\x1b[31;1m"
    RESET = "\x1b[0m"
    
    def __init__(self, fmt: str, datefmt: str, use_colors: bool = True):
        super().__init__(fmt, datefmt)
        self.use_colors = use_colors
    
    def format(self, record):
        # Save original levelname
        orig_levelname = record.levelname
        orig_msg = record.msg
        
        if self.use_colors:
            # Add colors based on log level
            if record.levelno == logging.DEBUG:
                record.levelname = f"{self.GREY}{record.levelname}{self.RESET}"
                record.msg = f"{self.GREY}{record.msg}{self.RESET}"
            elif record.levelno == logging.INFO:
                record.levelname = f"{self.BLUE}{record.levelname}{self.RESET}"
            elif record.levelno == logging.WARNING:
                record.levelname = f"{self.YELLOW}{record.levelname}{self.RESET}"
                record.msg = f"{self.YELLOW}{record.msg}{self.RESET}"
            elif record.levelno == logging.ERROR:
                record.levelname = f"{self.RED}{record.levelname}{self.RESET}"
                record.msg = f"{self.RED}{record.msg}{self.RESET}"
            elif record.levelno == logging.CRITICAL:
                record.levelname = f"{self.BOLD_RED}{record.levelname}{self.RESET}"
                record.msg = f"{self.BOLD_RED}{record.msg}{self.RESET}"
        
        # Format the message
        result = super().format(record)
        
        # Restore original values
        record.levelname = orig_levelname
        record.msg = orig_msg
        
        return result

def setup_logging(
    level: Optional[str] = None,
    log_file: Optional[Path] = None,
    use_colors: bool = True
) -> None:
    """
    Setup logging configuration for the application.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path to write logs
        use_colors: Whether to use colored output in console
    """
    # Set default level from environment or use INFO
    log_level = level or "INFO"
    
    # Convert string level to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    console_formatter = CustomFormatter(
        DEFAULT_LOG_FORMAT,
        DEFAULT_DATE_FORMAT,
        use_colors=use_colors
    )
    
    file_formatter = logging.Formatter(
        DEFAULT_LOG_FORMAT,
        DEFAULT_DATE_FORMAT
    )
    
    # Console handler (always add)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(numeric_level)
    root_logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        # Create log directory if it doesn't exist
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(numeric_level)
        root_logger.addHandler(file_handler)
    
    # Set levels for third-party loggers to reduce noise
    third_party_loggers = [
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "sqlalchemy.engine",
        "sqlalchemy.pool",
        "alembic",
        "asyncio",
        "httpx",
        "httpcore",
        "multipart",
    ]
    
    for logger_name in third_party_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)
    
    # Log the configuration
    logging.info(f"✅ Logging configured - Level: {log_level}, Colors: {use_colors}")
    if log_file:
        logging.info(f"📝 Log file: {log_file}")

def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name.
    
    Args:
        name: Usually __name__ from the calling module
        
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)

class LoggerMixin:
    """Mixin class to add logging capability to any class"""
    
    @property
    def logger(self) -> logging.Logger:
        """Get logger for this class"""
        if not hasattr(self, '_logger'):
            self._logger = get_logger(self.__class__.__name__)
        return self._logger