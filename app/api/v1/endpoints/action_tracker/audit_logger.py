# app/api/v1/endpoints/action_tracker/audit_logger.py
# Backwards-compat shim. Real implementation now lives in app/services/audit.py
from app.services.audit import log_audit  # noqa: F401
