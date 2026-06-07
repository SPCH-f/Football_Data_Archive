# 🚀 Groq Integration Guide

## ทำไมควรใช้ Groq?

- ✅ **ฟรี** — ไม่มีค่าใช้จ่าย (ยกเว้น rate limit บางตัว)
- ⚡ **เร็วมาก** — Inference ที่เร็วสุดในตลาด (~200ms response time)
- 🔄 **ใช้ได้กับ OpenAI API format** — ใช้ได้ทันทีกับ existing code
- 📊 **โมเดลคุณภาพสูง** — Mixtral-8x7b, Llama, etc.

---

## ขั้นตอนติดตั้ง

### 1️⃣ สร้าง Groq API Key

1. ไปที่ https://console.groq.com/keys
2. เข้าสู่ระบบหรือสมัครสมาชิก (ฟรี)
3. คลิก **"Create API Key"**
4. Copy key ของคุณ

### 2️⃣ อัปเดต .env

```bash
# 1. Copy default config
cp .env.example .env

# 2. แก้ไข .env
nano .env
# หรือใช้ editor ที่ชอบ
```

ตั้งค่าค่านี้:

```env
# ← เปลี่ยนเป็น Groq
LLM_PROVIDER=groq

# ← Paste key ของคุณ
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# (ตัวเลือก) เปลี่ยนโมเดล
GROQ_MODEL=mixtral-8x7b-32768
```

### 3️⃣ Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4️⃣ ทดสอบการเชื่อมต่อ

```bash
# Start Docker services (PostgreSQL + Redis)
docker compose up -d postgres redis

# รันทดสอบ
docker compose up backend
```

ตรวจสอบ logs ว่าเชื่อมต่อกับ Groq สำเร็จ:

```
✅ Backend ready — all systems go!
```

---

## โมเดล Groq ที่ใช้ได้

| โมเดล | Tokens/min | ความดี | หมายเหตุ |
|--------|---------|-------|---------|
| **mixtral-8x7b-32768** | ~30k | ⭐⭐⭐⭐⭐ | แนะนำ — balanced |
| llama3-8b-8192 | ~30k | ⭐⭐⭐⭐ | เล็ก + เร็ว |
| llama3-70b-8192 | ~30k | ⭐⭐⭐⭐⭐ | ใหญ่ + แม่นยำ |
| gemma-7b-it | ~30k | ⭐⭐⭐ | เบา + เร็ว |

เปลี่ยนในไฟล์ `.env`:

```env
GROQ_MODEL=llama3-70b-8192
```

---

## ตัวอย่างการใช้งาน

### ใช้ผ่าน API

```bash
# Chat
curl -X POST "http://localhost:8000/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"query": "Manchester City รหัสอยู่ตรงไหนในตารางคะแนน?"}'
```

### ตัวอย่าง Python

```python
from core.config import settings
from services.rag_service import rag_service

# ตั้งค่า .env ให้ LLM_PROVIDER=groq

# ใช้งาน
async for token in rag_service.generate_stream(
    query="ใครเป็นผู้เล่นรายได้สูงสุด?",
):
    print(token, end="", flush=True)
```

---

## ปัญหาทั่วไป

### ❌ "GROQ_API_KEY is not configured"

✅ ตรวจสอบ:
1. ไฟล์ `.env` มี `GROQ_API_KEY` ไหม?
2. API key ถูกต้องไหม?
3. รันใหม่: `docker compose restart backend`

### ❌ "Rate limit exceeded"

✅ Groq มี rate limit ~30k tokens/min
- ลองใช้โมเดลเล็กกว่า (llama3-8b)
- รอไป 1 นาที

### ❌ "Connection timeout"

✅ Groq API อาจติด:
1. ตรวจสอบ internet connection
2. ลอง: `curl https://api.groq.com/` 
3. ดู status: https://status.groq.com

---

## 🎯 Performance Tips

1. **ใช้ Mixtral** — ดุลยพินิจที่ดีที่สุด
2. **ลด `max_tokens`** — ระบุจำนวนสูงสุดของ tokens ในการตอบกลับ
3. **ใช้ caching** — Redis จะจดจำคำถามที่ซ้ำ

---

## ลิงก์ที่เป็นประโยชน์

- 📖 Groq Docs: https://console.groq.com/docs
- 🔑 API Keys: https://console.groq.com/keys
- 📊 Status: https://status.groq.com

---

**Happy Chatting!** 🚀⚽
