# CATCHPASS Linked Prototype

사장님용 `/owner`와 체험단용 `/reviewer`가 같은 가상 서버 API(`/api/catchpass`)를 바라보는 Next.js 프로토타입입니다.

## Local

```powershell
npm install
npm run dev
```

Open:

- Owner: `http://localhost:3000/owner`
- Reviewer: `http://localhost:3000/reviewer`

## Linked Flow

1. 사장님용에서 캠페인을 생성합니다.
2. 체험단용 캠페인 목록에 즉시 노출됩니다.
3. 체험단이 참여 신청 후 리뷰 URL을 완료 제출합니다.
4. 사장님용 완료 확인 목록에 해당 제출 건이 표시됩니다.

The API uses `CATCHPASS_BLOB_URL` when it is present, so Vercel deployments can share a small JSONBlob-backed virtual server. Without that env var it falls back to in-memory state for local prototype review. For a production build, replace `src/lib/catchpass-store.mjs` with a durable database adapter.
