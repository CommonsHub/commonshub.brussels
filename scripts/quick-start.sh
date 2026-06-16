#!/bin/bash

# Quick Start Script for Commons Hub Brussels
# This script helps you set up and run the website quickly.
#
# Note: the website only READS pre-generated data from ./data. Populating
# ./data is a separate concern handled by the chb pipeline (run elsewhere).

set -e

echo "================================================"
echo "Commons Hub Brussels - Quick Start"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo ""
    echo -e "${YELLOW}Please edit .env and add your API keys before continuing!${NC}"
    echo "Press any key to continue once you've configured .env..."
    read -n 1 -s
    echo ""
fi

# Check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
    echo "Creating docker-compose.yml from example..."
    cp docker-compose.yml.example docker-compose.yml
    echo -e "${GREEN}✓ docker-compose.yml created${NC}"
    echo ""
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker and try again."
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Warn if ./data looks empty — the site has nothing to show without it.
if [ ! -d ./data ] || [ -z "$(ls -A ./data 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠ ./data is empty${NC}"
    echo "The website reads pre-generated data from ./data. Populate it with the"
    echo "chb pipeline (run separately) before the site will show content."
    echo ""
fi

# Ask what to do
echo "What would you like to do?"
echo "1) Build and start the website (fresh build)"
echo "2) Start existing container"
echo "3) Stop and remove containers"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "Building and starting the website..."
        docker compose -f docker-compose.yml up -d --build
        echo ""
        echo -e "${GREEN}✓ Website built and started${NC}"
        echo "Access the website at: http://localhost:3000"
        ;;
    2)
        echo ""
        echo "Starting existing container..."
        docker compose -f docker-compose.yml up -d
        echo ""
        echo -e "${GREEN}✓ Website started${NC}"
        echo "Access the website at: http://localhost:3000"
        ;;
    3)
        echo ""
        echo "Stopping and removing containers..."
        docker compose -f docker-compose.yml down
        echo ""
        echo -e "${GREEN}✓ Containers stopped and removed${NC}"
        ;;
    *)
        echo ""
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "Useful commands:"
echo "  - View logs:        docker compose -f docker-compose.yml logs -f web"
echo "  - Enter web shell:  docker exec -it commonshub-web sh"
echo "  - Stop:             docker compose -f docker-compose.yml down"
echo ""
echo "================================================"
echo "For more information, see docs/deployment.md"
echo "================================================"
