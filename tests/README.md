# Tests

Current coverage:

- `unit/`: pure utility tests that do not need infrastructure
- `integration/`: smoke tests against the formal stack `MySQL + Redis + MinIO`

Commands:

- `npm test`: run unit tests
- `npm run test:integration`: run stack smoke tests

Integration test notes:

- Start the stack first, for example `docker compose up -d`
- Seed demo accounts with `npm run db:seed`
- Override the target API with `CHAT_TEST_BASE_URL`
- Override login credentials with `CHAT_TEST_USER_ID` and `CHAT_TEST_PASSWORD`
