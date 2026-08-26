# ⚽ Football RAG Chatbot

แชตบอตวิเคราะห์ฟุตบอลที่ขับเคลื่อนด้วย **Retrieval-Augmented Generation (RAG)** ใช้เพื่อถาม-ตอบเกี่ยวกับทีม ผู้เล่น ประวัติ ตารางคะแนน และข้อมูลแมตช์ โดยอ้างอิงข้อมูลจริงจากระบบและบริการภายนอก

## 💻 Tech Stack

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</div>
<br>
<div align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</div>

## 🏗️ สถาปัตยกรรม

```text
┌─────────────────────────────────────────────────────┐
│                Frontend (React + Vite)              │
│      TailwindCSS · React Query · TypeScript         │
│                      :3000                          │
└──────────────────────────┬──────────────────────────┘
                           │ SSE / REST
┌──────────────────────────▼──────────────────────────┐
│                 Backend (FastAPI)                   │
│   RAG pipeline · LangChain · APScheduler · pgvector │
│                      :8000                          │
├──────────────┬───────────────┬──────────────────────┤
│ Redis        │ PostgreSQL    │ External APIs        │
│ Cache        │ + pgvector    │ football-data.org    │
│ :6379        │ :5432         │ API-Football         │
└──────────────┴───────────────┴──────────────────────┘
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

## 🧠 ระบบ RAG ทำงานอย่างไร?

1. **Data Ingestion:** ระบบ `APScheduler` จะดึงข้อมูลจาก API ฟุตบอลอัตโนมัติทุกๆ 6-24 ชั่วโมง
2. **Chunking & Embedding:** ข้อมูลฟุตบอลจะถูกย่อยเป็นข้อความ (Chunks) และแปลงเป็น Vector ด้วยโมเดล Local ก่อนนำไปเก็บลงในฐานข้อมูล **PostgreSQL (pgvector)**
3. **Retrieval:** เมื่อผู้ใช้ถามคำถาม ระบบจะแปลงคำถามเป็น Vector และใช้ Cosine Similarity ดึงเอกสาร 10 อันดับแรก (Top K=10) ที่เกี่ยวข้องกันมากที่สุดออกมา
4. **Generation:** นำข้อมูลที่ดึงมาได้ ส่งให้ LLM สรุปและตอบกลับผู้ใช้เป็นภาษาไทย พร้อมแสดงแหล่งที่มาของข้อมูล


## 👨‍💻 การพัฒนาต่อยอด (Local Development)

**รัน Database และ Redis ด้วย Docker:**
```bash
docker compose up -d db redis
```

**รัน Backend (FastAPI):**
```bash
cd backend
python -m venv venv
source venv\Scripts\activate  
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**รัน Frontend (React/Vite):**
```bash
cd frontend
npm install
npm run dev
```
