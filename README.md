# Smokeshop — فروشگاه تخصصی دخانیات، اکسسوری و مشاور سلامت دیجیتال

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](VERSION)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

> **⚠️ هشدار حقوقی:** فروش اینترنتی محصولات دخانی در ایران مطابق ماده ۱۰ آیین‌نامه قانون جامع کنترل دخانیات ممنوع است. این پلتفرم صرفاً برای اکسسوری مجاز و کاتالوگ کنترل‌شده طراحی شده است.

---

## معرفی

**Smokeshop** یک پلتفرم تخصصی شامل دو بخش مستقل است:

### ۱. فروشگاه اکسسوری و سازگاری قطعات
فروشگاهی با محوریت «پیدا کردن کالای سازگار در کمتر از یک دقیقه» برای:
- اکسسوری قلیان (شلنگ، سری، واشر، توری، …)
- اکسسوری پیپ (فیلتر ۹mm/۶mm، تمپر، پاک‌کن، …)
- اکسسوری دستگاه‌های الکترونیکی (کارتریج، کویل، شارژر، …)
- فندک، ست هدیه و کالاهای مجاز متفرقه
- **کاتالوگ محدودشده**: نمایش اطلاعات فنی بدون امکان خرید آنلاین

### ۲. دستیار هوشمند سلامت (Health AI Agent)
مشاور دیجیتال ترک مصرف بر پایه:
- پروتکل بالینی **5As** (Ask, Advise, Assess, Assist, Arrange)
- مصاحبه انگیزشی **OARS**
- آزمون وابستگی **فاگرشتروم (FTND)**
- ارجاع سیستماتیک به **سامانه ۴۰۳۰** وزارت بهداشت

---

## معماری فنی

| لایه | فناوری |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | Django + Django REST Framework |
| Database | PostgreSQL + pgvector (HNSW) |
| Search | Meilisearch (MVP) → OpenSearch (تولید) |
| Cache/Queue | Redis + Celery |
| AI Orchestration | LangGraph (Multi-Agent) |
| Guardrails | NVIDIA NeMo Guardrails |
| Object Storage | MinIO / S3-compatible |
| Auth | JWT کوتاه‌عمر + 2FA ادمین |
| Observability | Prometheus + Grafana + Loki + Sentry |
| Infra | Docker Compose (MVP) → Orchestration |

---

## پیش‌نیاز نصب

- Python ≥ 3.12
- Node.js ≥ 20
- Docker & Docker Compose ≥ 2.x
- PostgreSQL ≥ 16 (با ماژول pgvector)
- Redis ≥ 7

---

## نصب و راه‌اندازی (محیط توسعه)

### ۱. کلون مخزن

```bash
git clone <repo-url>
cd smokeshop
```

### ۲. متغیرهای محیطی

```bash
cp config/config.example.env .env
# فایل .env را با مقادیر واقعی ویرایش کنید
```

### ۳. راه‌اندازی زیرساخت با Docker

```bash
docker compose up -d postgres redis minio
```

### ۴. Backend (Django)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### ۵. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### ۶. Worker (Celery)

```bash
cd backend
celery -A config worker -l info
```

---

## ماژول‌های اصلی

| ماژول | توضیح |
|---|---|
| `Catalog/PIM` | مدیریت محصول، برند، مدل، مشخصات |
| `Compatibility Engine` | موتور سازگاری قطعات (گراف DAG) |
| `Legal Policy Engine` | طبقه‌بندی حقوقی SKU، Feature Flag |
| `Inventory` | چند انبار/شعبه، Stock Ledger |
| `Cart/Checkout` | فقط برای `APPROVED_ONLINE` |
| `Health AI Agent` | دستیار ترک با LangGraph |
| `RAG Pipeline` | Hybrid Search (Dense + BM25 + RRF + Cross-Encoder) |
| `Audit/Reporting` | لاگ تغییرات رمزنگاری‌شده |

---

## وضعیت حقوقی SKU

| وضعیت | توضیح |
|---|---|
| `APPROVED_ONLINE` | سبد خرید + پرداخت مجاز |
| `CATALOG_ONLY` | نمایش فنی بدون خرید |
| `IN_PERSON_ONLY` | فقط معرفی شعبه |
| `REVIEW_REQUIRED` | **پیش‌فرض** — بلوک تا تأیید حقوقی |
| `BLOCKED` | حذف از تمام مسیرها |

---

## اجرای تست‌ها

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run test

# E2E
npm run test:e2e
```

---

## مستندات

- [معماری جامع](Comprehensive%20Architecture.txt)
- [طرح جامع فروشگاه](Online%20Store%20for%20Tobacco%20and%20Accessories.md)
- [تصمیمات پروژه](PROJECT_DECISIONS.md)
- [راهنمای AI](AI/EXECUTION_GUIDE.md)
- [راهنمای نگهداری](docs/MAINTENANCE.md)
- [فهرست مستندات](docs/README.md)

---

## مشارکت

مشارکت در توسعه مطابق [AGENTS.md](AGENTS.md) و [SKILLS/SKILL.md](SKILLS/SKILL.md) انجام می‌شود.

---

## هشدار سلامت

> این پلتفرم هیچ‌گاه مصرف دخانیات را تشویق نمی‌کند. بخش مشاوره سلامت صرفاً آگاهی‌بخشی عمومی است و جایگزین مشاوره پزشکی نیست. در صورت نیاز به کمک برای ترک: **سامانه ۴۰۳۰، داخلی ۵** (رایگان، وزارت بهداشت).
