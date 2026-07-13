# Linksee Chat Release Process

## Purpose

This document explains how Linksee Chat desktop releases move from source code to the update server.

The current release system has two channels:

- `staging`: pre-release builds used for internal verification
- `stable`: formal releases used by end users

## Core Concepts

- `commit`: saves a code snapshot into Git history
- `push`: uploads commits to GitHub
- `tag`: marks a specific commit as a release version
- `workflow`: GitHub Actions automation that builds and publishes the release
- `latest.yml`: desktop updater metadata read by `electron-updater`
- `release-manifest.json`: internal release audit file with checksums and build metadata

## Versioning

The project follows semantic versioning:

- `major`: breaking changes
- `minor`: new features
- `patch`: fixes and small improvements

Examples:

- `0.4.11`
- `0.4.12-rc.1`

Rules:

- pre-release testing uses `-rc.N`
- formal release removes the `-rc.N` suffix
- every packaged client release should increment the version

## Release Channels

Desktop clients read updates from:

- `http://186.241.89.102/updates/desktop/win/staging`
- `http://186.241.89.102/updates/desktop/win/stable`

Server filesystem targets:

- `/home/linksee-chat/updates/desktop/win/staging`
- `/home/linksee-chat/updates/desktop/win/stable`

## GitHub Secrets

The release workflow needs these repository secrets:

- `UPDATE_SSH_HOST`
- `UPDATE_SSH_USER`
- `UPDATE_SSH_PORT`
- `UPDATE_SSH_TARGET`
- `UPDATE_SSH_KEY_B64`

`UPDATE_SSH_KEY_B64` stores the SSH private key as Base64, not raw multiline text.

PowerShell command to set it from the local key file:

```powershell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("$env:USERPROFILE\.ssh\id_ed25519")) | gh secret set UPDATE_SSH_KEY_B64
```

## CI Workflows

### Continuous Integration

File:

- `.github/workflows/ci.yml`

Purpose:

- install dependencies
- generate Prisma client
- run unit tests
- build the web frontend
- check desktop and server source syntax

### Desktop Release

File:

- `.github/workflows/release-desktop.yml`

Purpose:

- resolve release channel from the tag
- install dependencies
- set package version from the tag
- build the installer
- generate `latest.yml`
- generate `release-manifest.json`
- verify artifacts
- upload artifacts to GitHub
- publish artifacts to the update server through SSH

## Standard Release Flow

### 1. Update Code

```powershell
git add .
git commit -m "feat: your change"
git push
```

### 2. Publish a Staging Build

```powershell
git tag v0.4.12-rc.1
git push origin v0.4.12-rc.1
```

Expected result:

- GitHub Actions builds and uploads the installer
- files appear in `/updates/desktop/win/staging`

### 3. Publish a Stable Build

```powershell
git tag v0.4.12
git push origin v0.4.12
```

Expected result:

- GitHub Actions builds and uploads the installer
- files appear in `/updates/desktop/win/stable`

## Validation Checklist

After a successful release:

- GitHub Actions shows a green `Release Desktop` run
- `latest.yml` exists on the server
- installer exists on the server
- `.blockmap` exists on the server
- `release-manifest.json` exists on the server

Useful checks:

```bash
ls -lh /home/linksee-chat/updates/desktop/win/stable
ls -lh /home/linksee-chat/updates/desktop/win/staging
```

Browser checks:

- `http://186.241.89.102/updates/desktop/win/stable/latest.yml`
- `http://186.241.89.102/updates/desktop/win/staging/latest.yml`

## Server Update Commands

When backend or nginx source changes:

```bash
cd /home/linksee-chat
git pull
docker compose up -d --build app nginx
```

Do not use:

```bash
docker compose down -v
```

That may remove persisted database volumes.

## Current Notes

- release artifact generation is now explicit and does not depend on implicit `electron-builder` behavior for `latest.yml`
- SSH publishing now uses a Base64-encoded private key secret to avoid multiline formatting issues in GitHub Secrets
