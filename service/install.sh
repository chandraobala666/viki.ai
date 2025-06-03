#!/bin/bash

# Installing Flyway CLI
brew install flyway

# Starting SQLite database
sqlite3 service/db/sqllite/data/viki_ai.db

# Python virtual environment setup
cd service
uv init viki_ai
uv run -m viki_ai
