# ⚽ Football RAG Chatbot

แชตบอตวิเคราะห์ฟุตบอลที่ขับเคลื่อนด้วย **Retrieval-Augmented Generation (RAG)** ใช้เพื่อถาม-ตอบเกี่ยวกับทีม ผู้เล่น ประวัติ ตารางคะแนน และข้อมูลแมตช์ โดยอ้างอิงข้อมูลจริงจากระบบและบริการภายนอก

## 🏗️ สถาปัตยกรรม

```text
┌────────────────────────────────────────────────────┐
│                Frontend (React + Vite)            │
│      TailwindCSS · React Query · TypeScript       │
│                      :3000                         │
└──────────────────────────┬───────────────────────┘
                           │ SSE / REST
┌──────────────────────────▼───────────────────────┐
│                 Backend (FastAPI)                 │
│   RAG pipeline · LangChain · APScheduler · pgvector │
│                      :8000                         │
├──────────────┬───────────────┬────────────────────┤
│ Redis        │ PostgreSQL   │ External APIs      │
│ Cache        │ + pgvector   │ football-data.org  │
│ :6379        │ :5432        │ API-Football       │
└──────────────┴───────────────┴────────────────────┘
```

## 🚀 วิธีเริ่มต้นใช้งาน

### สิ่งที่ต้องมี

- Docker และ Docker Compose
- API key สำหรับ [football-data.org](https://www.football-data.org/) และ [API-Football](https://www.api-football.com/)
- API key ของ OpenAI หรือ Anthropic (ตามตัวเลือกที่ใช้งาน)

### ขั้นตอนตั้งค่า

```bash
# 1. สร้างไฟล์คอนฟิกจากตัวอย่าง
cp .env.example .env

# 2. ใส่ค่า API keys และค่าต่าง ๆ ให้ถูกต้องในไฟล์ .env

# 3. สั่งรันบริการทั้งหมด
docker compose up -d

# 4. ตรวจสอบสถานะบริการ
docker compose ps

# 5. ดู log ของ backend ได้ถ้าต้องการ debug
docker compose logs -f backend
```

### เข้าถึงบริการ

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/docs
- pgAdmin: http://localhost:5050

## 📁 โครงสร้างโปรเจกต์

```text
RAG-football/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── main.py
│   ├── api/
│   │   ├── routes/
│   │   └── dependencies.py
│   ├── core/
│   ├── models/
│   ├── services/
│   └── scheduler/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   └── init_db.py
└── README.md
```

## 🔑 ตัวแปรสิ่งแวดล้อม

ดูรายละเอียดใน [.env.example](.env.example)

ตัวแปรหลักที่ควรตั้งค่า:

| ตัวแปร | คำอธิบาย |
| --- | --- |
| `LLM_PROVIDER` | ระบุ provider ที่ใช้ เช่น `openai` หรือ `anthropic` |
| `OPENAI_API_KEY` | API key ของ OpenAI |
| `FOOTBALL_DATA_API_KEY` | API key ของ football-data.org |
| `API_FOOTBALL_KEY` | API key ของ API-Football |
| `TRACKED_COMPETITIONS` | รหัสลีกที่ต้องติดตามแบบคั่นด้วย comma |

## 📡 Endpoint สำคัญ

| วิธี | Endpoint | คำอธิบาย |
| --- | --- | --- |
| POST | `/api/chat/stream` | ส่งคำถามแบบสตรีมข้อมูลตอบกลับ |
| POST | `/api/chat/sessions` | สร้างเซสชันแชตใหม่ |
| GET | `/api/chat/sessions/{id}` | ดึงประวัติการสนทนา | 
| GET | `/api/matches/upcoming` | ดึงแมตช์ที่กำลังจะมาถึง 10 นัด |
| GET | `/api/standings/{comp}` | ดึงตารางคะแนนของลีก |
| POST | `/api/admin/sync` | เรียกการซิงก์ข้อมูลด้วยตนเอง |

## 📋 สถานะงาน

- [x] Phase 1 — โครงสร้าง Docker และ infrastructure
- [ ] Phase 2 — โมเดลฐานข้อมูลและ Alembic
- [ ] Phase 3 — API clients และ cache layer
- [ ] Phase 4 — Ingestion และ scheduler
- [ ] Phase 5 — RAG service (embeddings + LangChain)
- [ ] Phase 6 — FastAPI routes
- [ ] Phase 7 — React frontend
- [ ] Phase 8 — ระบบทดสอบ end-to-end

## 📜 License

MIT
