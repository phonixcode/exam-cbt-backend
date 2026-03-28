# JAMB CBT — Backend

Node.js + Express REST API for the JAMB CBT Simulator.

---

## Prerequisites

- Node.js v18+
- MongoDB running locally or a MongoDB Atlas connection string

---

## Setup

**1. Install dependencies**
```bash
cd backend
npm install
```

**2. Create `.env` file**

Create a `.env` file in the `backend/` directory:
```env
PORT=5005
MONGODB_URI=mongodb://localhost:27017/jamb-cbt
JWT_SECRET=your_strong_random_secret_here
JWT_EXPIRE=30d
NODE_ENV=development
ADMIN_SECRET_KEY=your_admin_secret_here
CLIENT_URL=http://localhost:3000
```

> **Important:** Use a strong, randomly generated value for `JWT_SECRET` and `ADMIN_SECRET_KEY` in production. Never commit the `.env` file.

**3. Start the development server**
```bash
npm run dev
```

The API will be available at `http://localhost:5005`.

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Start with nodemon (auto-restart on changes) |
| Production | `npm start` | Start with node |

---
### Exam Session
Tracks the state of an ongoing exam: questions, answers, timer start, and subject configuration.

---

## First-Time Setup

### Create an Admin Account
```bash
curl -X POST http://localhost:5005/api/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "phoneNumber": "08000000000",
    "pin": "1234",
    "adminSecretKey": "your_admin_secret_here"
  }'
```

> The value of `adminSecretKey` must match `ADMIN_SECRET_KEY` in your `.env`.

---

## Importing Questions (.docx Format)

Questions can be bulk-imported through the Admin panel via `.docx` upload. The parser expects this format:

```
1. What is the meaning of SYCOPHANT?
A. Flatterer
B. Dictator
C. Philosopher
D. Warrior
Answer: A
Explanation: A sycophant is someone who flatters to gain favor.
```

Supported question types:
- Multiple choice (MCQ)
- Typed/free-text answers
- Image-based questions
- Passage-based questions

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Port the server listens on (default: `5005`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `JWT_EXPIRE` | Yes | Token expiry duration (e.g. `30d`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `ADMIN_SECRET_KEY` | Yes | Secret required to register admin accounts |
| `CLIENT_URL` | Yes | Frontend origin for CORS (e.g. `http://localhost:3000`) |

---

## File Uploads

Uploaded files are stored locally in the `uploads/` directory:

| Type | Path | Size Limit |
|------|------|-----------|
| .docx question files | `uploads/docx/` | 10 MB |
| Question/explanation images | `uploads/images/` | 5 MB |

The `/uploads` directory is served as static files and accessible at `http://localhost:5005/uploads/`.
