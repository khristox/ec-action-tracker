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