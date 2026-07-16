# Action Tracker (RMS)

A comprehensive Action Tracker for managing properties, tenants, leases, and payments with multi-currency support.

## 🚀 Features

- **Property Management**: Manage structures, units, and amenities
- **Tenant Management**: Track tenant information, documents, and history
- **Lease Management**: Create and manage lease agreements
- **Payment Processing**: Handle rent payments with multi-currency support
- **Email Notifications**: Automated email verification and notifications
- **Role-Based Access**: Admin, property manager, tenant roles
- **Audit Logging**: Track all system activities
- **RESTful API**: Well-documented API with Swagger

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for caching)

## 🛠️ Installation

### Clone the repository
```bash
git clone https://github.com/yourusername/rms.git
cd rms




# Switch to Docker environment
./switch-env.sh docker

# Build and start containers
docker-compose up -d --build

# Check logs
docker-compose logs -f app

# Switch back to local development
./switch-env.sh local

# Run local development
python app/main.py



# RUn Monop
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /home/chris/Chr/Apps/ECATMIS/minio-data:/data \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"





## 🔑 Tab Permissions Overview

| Tab            | Icon | Access Level       | Required Permission(s)         | Description                                                                 |
|----------------|------|-------------------|--------------------------------|-----------------------------------------------------------------------------|
| **Minutes**    | 📝   | Simple View        | `VIEW_MINUTES`                 | Allows users to view meeting minutes relevant to them.                      |
| **Actions**    | 📋   | Simple View        | `VIEW_OWN_ACTIONS`             | Users can view and manage action items assigned to them.                    |
| **Participants** | 👥 | Simple View        | `VIEW_PARTICIPANTS`            | Displays participants in meetings/projects relevant to the user.            |
| **Documents**  | 📄   | Full Access        | `UPLOAD_DOCUMENTS`, `DELETE_DOCUMENTS` | All users can view/download documents. Upload/delete restricted by role. |
| **History**    | 📜   | Full Access        | None (Public)                  | Shows past meetings and actions. May be restricted for sensitive data.       |
| **Audit**      | 🔍   | Restricted         | `VIEW_AUDIT_LOGS`              | Admin‑only access to system activity logs and critical changes.             |
| **Recordings** | 🎥   | Restricted         | `VIEW_RECORDER`                | Grants access to meeting recordings and transcripts (special role only).    |





# Permissions Documentation

## Overview

This document provides comprehensive documentation for all permissions available in the Action Tracker (RMS) system. Permissions are used to control access to various features, modules, and actions within the application.

## Permission Structure

Permissions follow a consistent naming convention: `{module}:{action}`

- **Module**: The functional area (e.g., meeting, action, payment)
- **Action**: The specific operation (e.g., create, read, update, delete)

## Module Categories

1. **Meeting Management** - Meeting lifecycle management
2. **Actions Management** - Action item tracking and assignment
3. **Minutes Management** - Meeting minutes and documentation
4. **Notifications** - System notifications and alerts
5. **Participants** - Meeting participant management
6. **Reports** - Analytics and reporting
7. **Dashboard** - Dashboard widgets and customization
8. **Administration** - System administration and configuration
9. **Structure Management** - Organizational structure
10. **User Management** - User account management
11. **Profile Management** - User profile settings
12. **Role Management** - Role and permission assignment
13. **Payment Management** - Financial transactions
14. **Lease Management** - Lease agreements
15. **Tenant Management** - Tenant records and history

---

## 1. Meeting Management Permissions

### DELETE_MEETING
- **Permission**: `meeting:delete`
- **Description**: Allows users to permanently delete meetings from the system
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### UPDATE_MEETING
- **Permission**: `meeting:update`
- **Description**: Allows users to edit and modify existing meeting details
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### CREATE_MEETING
- **Permission**: `meeting:create`
- **Description**: Allows users to schedule and create new meetings
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager, Team Lead

### VIEW_ALL_MEETINGS
- **Permission**: `meeting:view_all`
- **Description**: Allows users to view all meetings across the organization
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_OWN_MEETINGS
- **Permission**: `meeting:view`
- **Description**: Allows users to view meetings they are invited to or created
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### CHANGE_STATUS
- **Permission**: `meeting:status_change`
- **Description**: Allows users to change meeting status (Scheduled, Ongoing, Completed, Cancelled)
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### RECORD_MEETING
- **Permission**: `meeting:record`
- **Description**: Allows users to start and stop meeting recordings
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_RECORDER
- **Permission**: `meeting:view_recorder`
- **Description**: Allows users to access meeting recordings and transcripts
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager, Team Lead

---

## 2. Minutes Management Permissions

### ADD_MINUTES
- **Permission**: `minutes:add`
- **Description**: Allows users to add minutes to meetings
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager, Team Lead

### EDIT_MINUTES
- **Permission**: `minutes:edit`
- **Description**: Allows users to edit existing meeting minutes
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### DELETE_MINUTES
- **Permission**: `minutes:delete`
- **Description**: Allows users to delete meeting minutes
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### APPROVE_MINUTES
- **Permission**: `minutes:approve`
- **Description**: Allows users to approve meeting minutes
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### SIGN_MINUTES
- **Permission**: `minutes:sign`
- **Description**: Allows users to digitally sign meeting minutes
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### VIEW_MINUTES
- **Permission**: `minutes:view`
- **Description**: Allows users to view meeting minutes
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### EXPORT_MINUTES
- **Permission**: `minutes:export`
- **Description**: Allows users to export meeting minutes in various formats
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

---

## 3. Actions Management Permissions

### CREATE_ACTIONS
- **Permission**: `action:create`
- **Description**: Allows users to create new action items
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### UPDATE_ACTIONS
- **Permission**: `action:update`
- **Description**: Allows users to update existing action items
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### DELETE_ACTIONS
- **Permission**: `action:delete`
- **Description**: Allows users to delete action items
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### ASSIGN_ACTIONS
- **Permission**: `action:assign`
- **Description**: Allows users to assign action items to team members
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager, Team Lead

### COMMENT_ACTIONS
- **Permission**: `action:comment`
- **Description**: Allows users to add comments to action items
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### UPDATE_ACTION_STATUS
- **Permission**: `action:status_update`
- **Description**: Allows users to update action item status (Pending, In Progress, Done, Cancelled)
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### UPDATE_ACTION_PRIORITY
- **Permission**: `action:priority_update`
- **Description**: Allows users to update action item priority (Low, Medium, High, Critical)
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_ALL_ACTIONS
- **Permission**: `action:view_all`
- **Description**: Allows users to view all action items in the system
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_OWN_ACTIONS
- **Permission**: `action:view_own`
- **Description**: Allows users to view action items assigned to them
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### ADD_ACTION_ATTACHMENTS
- **Permission**: `action:attachment`
- **Description**: Allows users to attach files to action items
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### ACTION_REPORTS
- **Permission**: `report:action`
- **Description**: Allows users to generate reports on action items
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

---

## 4. Notifications Permissions

### SEND_NOTIFICATIONS
- **Permission**: `notification:send`
- **Description**: Allows users to send system notifications
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### SEND_EMAIL_NOTIFICATIONS
- **Permission**: `notification:email`
- **Description**: Allows users to send email notifications
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### VIEW_NOTIFICATIONS
- **Permission**: `notification:view`
- **Description**: Allows users to view notifications
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### MANAGE_NOTIFICATION_TEMPLATES
- **Permission**: `notification:manage_templates`
- **Description**: Allows users to create and manage notification templates
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

---

## 5. Participants Permissions

### ADD_PARTICIPANTS
- **Permission**: `participant:add`
- **Description**: Allows users to add participants to meetings
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager, Team Lead

### REMOVE_PARTICIPANTS
- **Permission**: `participant:remove`
- **Description**: Allows users to remove participants from meetings
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_PARTICIPANTS
- **Permission**: `participant:view`
- **Description**: Allows users to view meeting participants
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### MANAGE_PARTICIPANT_LISTS
- **Permission**: `participant:manage_lists`
- **Description**: Allows users to manage participant lists and groups
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

---

## 6. Reports Permissions

### EXPORT_REPORTS
- **Permission**: `report:export`
- **Description**: Allows users to export reports in various formats
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_REPORTS
- **Permission**: `report:view`
- **Description**: Allows users to view reports
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### MEETING_REPORTS
- **Permission**: `report:meeting`
- **Description**: Allows users to generate meeting reports
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### PARTICIPANT_REPORTS
- **Permission**: `report:participant`
- **Description**: Allows users to generate participant reports
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### VIEW_FINANCIAL_REPORTS
- **Permission**: `report:financial`
- **Description**: Allows users to view financial reports
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

---

## 7. Dashboard Permissions

### VIEW_DASHBOARD
- **Permission**: `dashboard:view`
- **Description**: Allows users to view the dashboard
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### CUSTOMIZE_DASHBOARD
- **Permission**: `dashboard:customize`
- **Description**: Allows users to customize their dashboard layout
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### DASHBOARD_OVERVIEW
- **Permission**: `dashboard:overview`
- **Description**: Allows users to view dashboard overview widgets
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### UPCOMING_MEETINGS_WIDGET
- **Permission**: `dashboard:upcoming_meetings`
- **Description**: Allows users to view upcoming meetings widget
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### RECENT_MEETINGS_WIDGET
- **Permission**: `dashboard:recent_meetings`
- **Description**: Allows users to view recent meetings widget
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### PENDING_ACTIONS_WIDGET
- **Permission**: `dashboard:pending_actions`
- **Description**: Allows users to view pending actions widget
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### OVERDUE_ACTIONS_WIDGET
- **Permission**: `dashboard:overdue_actions`
- **Description**: Allows users to view overdue actions widget
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### NOTIFICATIONS_WIDGET
- **Permission**: `dashboard:notifications`
- **Description**: Allows users to view notifications widget
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

---

## 8. Administration Permissions

### VIEW_AUDIT_LOGS
- **Permission**: `admin:view_audit`
- **Description**: Allows users to view system audit logs
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### MANAGE_LOCATIONS
- **Permission**: `admin:manage_locations`
- **Description**: Allows users to manage locations and venues
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### MANAGE_ADMIN_STRUCTURES
- **Permission**: `admin:manage_structures`
- **Description**: Allows users to manage organizational structures
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### MANAGE_USERS
- **Permission**: `admin:manage_users`
- **Description**: Allows users to manage user accounts
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### MANAGE_ROLES
- **Permission**: `admin:manage_roles`
- **Description**: Allows users to manage roles and permissions
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### MANAGE_MENU_ASSIGNMENT
- **Permission**: `admin:manage_menu_assignment`
- **Description**: Allows users to manage menu assignments
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

---

## 9. Structure Management Permissions

### CREATE_STRUCTURE
- **Permission**: `structure:create`
- **Description**: Allows users to create organizational structures
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### UPDATE_STRUCTURE
- **Permission**: `structure:update`
- **Description**: Allows users to update organizational structures
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### DELETE_STRUCTURE
- **Permission**: `structure:delete`
- **Description**: Allows users to delete organizational structures
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### READ_STRUCTURE
- **Permission**: `structure:read`
- **Description**: Allows users to view organizational structures
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

---

## 10. User Management Permissions

### CREATE_USER
- **Permission**: `user:create`
- **Description**: Allows users to create new user accounts
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### UPDATE_USER
- **Permission**: `user:update`
- **Description**: Allows users to update user accounts
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### DELETE_USER
- **Permission**: `user:delete`
- **Description**: Allows users to delete user accounts
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### READ_USER
- **Permission**: `user:read`
- **Description**: Allows users to view user accounts
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

---

## 11. Profile Management Permissions

### VIEW_OTHERS_PROFILES
- **Permission**: `profile:view_others`
- **Description**: Allows users to view other users' profiles
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### UPDATE_PROFILE
- **Permission**: `profile:update`
- **Description**: Allows users to update their own profile
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### READ_PROFILE
- **Permission**: `profile:read`
- **Description**: Allows users to read their own profile
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### VIEW_PROFILE
- **Permission**: `profile:view`
- **Description**: Allows users to view their own profile
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

### CHANGE_PASSWORD
- **Permission**: `profile:change_password`
- **Description**: Allows users to change their password
- **Access Level**: Simple
- **Typical Roles**: All authenticated users

---

## 12. Role Management Permissions

### MANAGE_ROLES
- **Permission**: `admin:manage_roles`
- **Description**: Allows users to create, update, and delete roles
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

### ASSIGN_ROLE
- **Permission**: `role:assign`
- **Description**: Allows users to assign roles to users
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

---

## 13. Payment Management Permissions

### CREATE_PAYMENT
- **Permission**: `payment:create`
- **Description**: Allows users to create payment transactions
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Accountant

### READ_PAYMENT
- **Permission**: `payment:read`
- **Description**: Allows users to view payment transactions
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Accountant

### UPDATE_PAYMENT
- **Permission**: `payment:update`
- **Description**: Allows users to update payment transactions
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Accountant

### PROCESS_PAYMENT
- **Permission**: `payment:process`
- **Description**: Allows users to process payments
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Accountant

---

## 14. Lease Management Permissions

### CREATE_LEASE
- **Permission**: `lease:create`
- **Description**: Allows users to create lease agreements
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### READ_LEASE
- **Permission**: `lease:read`
- **Description**: Allows users to view lease agreements
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### UPDATE_LEASE
- **Permission**: `lease:update`
- **Description**: Allows users to update lease agreements
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### TERMINATE_LEASE
- **Permission**: `lease:terminate`
- **Description**: Allows users to terminate lease agreements
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

---

## 15. Tenant Management Permissions

### CREATE_TENANT
- **Permission**: `tenant:create`
- **Description**: Allows users to create tenant records
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### READ_TENANT
- **Permission**: `tenant:read`
- **Description**: Allows users to view tenant records
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### UPDATE_TENANT
- **Permission**: `tenant:update`
- **Description**: Allows users to update tenant records
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin, Manager

### DELETE_TENANT
- **Permission**: `tenant:delete`
- **Description**: Allows users to delete tenant records
- **Access Level**: Restricted
- **Typical Roles**: Super Admin, Admin

---

## Permission Levels Summary

| Level | Description | Examples |
|-------|-------------|----------|
| **Simple** | Available to all authenticated users | VIEW_OWN_ACTIONS, VIEW_MINUTES, COMMENT_ACTIONS |
| **Restricted** | Requires specific permission grants | CREATE_MEETING, UPDATE_USER, PROCESS_PAYMENT |

## Access Levels by Role

| Role | Simple Permissions | Restricted Permissions |
|------|-------------------|----------------------|
| **Super Admin** | ✅ All | ✅ All |
| **Admin** | ✅ All | ✅ Most |
| **Manager** | ✅ All | ✅ Department-specific |
| **Team Lead** | ✅ All | ✅ Team-specific |
| **Member** | ✅ All | ❌ None |
| **Viewer** | ✅ View-only | ❌ None |

## Permission Usage in Code

```javascript
// Check if user has a specific permission
const hasPermission = (user, permission) => {
  return user.permissions?.includes(permission) || 
         user.roles?.some(role => role.permissions.includes(permission));
};

// Check for multiple permissions
const hasAllPermissions = (user, permissions) => {
  return permissions.every(p => hasPermission(user, p));
};

// Usage in components
if (hasPermission(currentUser, PERMISSIONS.CREATE_MEETING)) {
  // Show create meeting button
}