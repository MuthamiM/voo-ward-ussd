#!/bin/bash
# Production Deployment Script for Render
# This script runs after deployment to seed initial users

echo "🚀 Starting post-deployment tasks..."

# Seed users collection with admin and PA accounts
echo "📋 Seeding users collection..."
node scripts/seed-users.js

echo "✅ Post-deployment tasks completed!"
