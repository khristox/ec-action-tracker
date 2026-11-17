ADMIN_ROLE_CODES = {"admin", "super_admin"}


def is_admin_user(user) -> bool:
    """Superuser flag, is_admin flag, or an admin role."""
    if bool(getattr(user, "is_superuser", None)) or bool(getattr(user, "is_admin", None)):
        return True
    try:
        return any(getattr(r, "code", None) in ADMIN_ROLE_CODES for r in (user.roles or []))
    except Exception:
        return False