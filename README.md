# 쏠 타로 하우스 (가제)

쏠 웰니스 하우스의 세 번째 웰니스 테스트 — `tarot.ssolwellnesshouse.com`.
작업 규칙과 결정 기록은 [CLAUDE.md](CLAUDE.md), 기획 원본은 [docs/](docs/)(마스터 스펙·디자인 가이드·AI 프롬프트).

```
npm install
npm run dev      # http://localhost:3200
npm test         # 패키지 원본 테스트 40개 + 추가 테스트
npm run lint && npm run build
```

DB 테이블은 `supabase/migrations/`의 SQL을 Supabase SQL Editor에서 실행해 만듭니다.
