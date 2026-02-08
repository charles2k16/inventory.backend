# 🚀 Quick Setup Guide

## Prerequisites Check

Before starting, ensure you have:

- ✅ Node.js v18 or higher (`node --version`)
- ✅ PostgreSQL v14 or higher (`psql --version`)
- ✅ npm or yarn package manager

## Step-by-Step Setup

### 1. Database Setup (5 minutes)

```bash
# Create PostgreSQL database
createdb inventory_db

# Or using psql
psql -U postgres
CREATE DATABASE inventory_db;
\q
```

### 2. Backend Setup (10 minutes)

```bash
cd backend

# Install all dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your database credentials
nano .env  # or use any text editor
```

**Update these values in .env:**

```env
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/inventory_db?schema=public"
JWT_SECRET="your-super-secret-key-change-in-production"
```

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations (creates all tables)
npm run prisma:migrate

# Seed database with sample data from your Excel file
npm run seed

# Start backend server
npm run dev
```

✅ Backend should now be running on **<http://localhost:3001>**

### 3. Frontend Setup (5 minutes)

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# (Optional) Create .env if you changed backend port
echo "NUXT_PUBLIC_API_BASE=http://localhost:3001/api" > .env

# Start frontend development server
npm run dev
```

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -U YOUR_USERNAME -d inventory_db

# If connection fails, check:
# 1. PostgreSQL is running: sudo service postgresql status
# 2. Username/password are correct
# 3. Database exists: \l in psql
```

### Port Already in Use

```bash
# Backend (port 3001)
# Kill process: lsof -ti:3001 | xargs kill

# Frontend (port 3000)
# Kill process: lsof -ti:3000 | xargs kill
```

### Prisma Issues

```bash
cd backend

# Reset and recreate database
npm run prisma:migrate reset

# Regenerate client
npm run prisma:generate
```

## 🔒 Security Notes for Production

1. **Change default passwords immediately**
2. **Use strong JWT_SECRET** (generate with: `openssl rand -base64 32`)
3. **Enable HTTPS**
4. **Set up firewall rules**
5. **Regular database backups**
6. **Use environment variables for all secrets**

## 📞 Support

If you encounter issues:

1. Check the console for error messages
2. Verify all services are running
3. Check database connections
4. Review the main README.md

## 🎉 You're Ready

Once all checks pass, you have a fully functional inventory management system running locally!

**Time to complete setup: ~20 minutes**
