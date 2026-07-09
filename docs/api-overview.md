# API Overview

## Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

## Profile

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/profile`

## Chat

- `GET /api/v1/contacts`
- `GET /api/v1/conversations`
- `POST /api/v1/conversations`
- `GET /api/v1/conversations/:conversationId/participants`
- `GET /api/v1/conversations/:conversationId/messages`
- `GET /api/v1/conversations/:conversationId/messages/search`
- `POST /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/conversations/:conversationId/announcements`
- `PATCH /api/v1/conversations/:conversationId/messages/:messageId`
- `DELETE /api/v1/conversations/:conversationId/messages/:messageId`
- `POST /api/v1/conversations/:conversationId/read`
