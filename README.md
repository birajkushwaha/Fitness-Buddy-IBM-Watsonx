# 🏋️ FitBuddy AI — IBM Granite-Powered Personal Trainer

A full-stack AI fitness web application built with **Python Flask** and **IBM watsonx.ai** (IBM Granite models). FitBuddy provides personalized workout plans, nutrition advice, BMI/calorie/water calculators, progress tracking, and a real-time AI chat coach.

---

## ✨ Features

| Category | Details |
|---|---|
| 🤖 **AI Coach** | Real-time chat with IBM Granite — workout plans, meal advice, motivation |
| 🏋️ **Workout Planner** | 7-day personalized plans by goal, level, time & equipment |
| 🥗 **Nutrition** | Daily meal plans with macros, calorie targets & diet preferences |
| 📊 **Calculators** | BMI, TDEE/Calories (Mifflin-St Jeor), Water Intake |
| 📈 **Progress Tracking** | Log workouts, weight, notes; streak tracker; achievements |
| 👤 **User Profile** | Persistent profile used to personalize every AI response |
| 🌙 **Dark Mode** | Full dark/light toggle with smooth transitions |
| 📱 **Responsive** | Mobile-first Bootstrap 5 layout |

---

## 🗂️ Project Structure

```
fitness-buddy/
├── app.py                  # Flask backend + IBM watsonx.ai integration
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your credentials (never commit!)
├── templates/
│   └── index.html          # Single-page app HTML
└── static/
    ├── css/
    │   └── style.css       # All styles, dark mode, animations
    └── js/
        └── app.js          # All frontend logic
```

---

## 🚀 Quick Start

### 1. Clone / download the project

```bash
cd fitness-buddy
```

### 2. Create a Python virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure your IBM credentials

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
IBM_API_KEY=<your IBM Cloud API key>
WATSONX_PROJECT_ID=<your watsonx.ai project ID>
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=<generate a random secret>
FLASK_ENV=development
```

> **Where to get credentials:**
> 1. **IBM Cloud API Key** → [cloud.ibm.com](https://cloud.ibm.com) → Manage → Access → API Keys → Create
> 2. **watsonx.ai Project ID** → [dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com) → Your Project → Manage → General → Project ID

### 5. Run the application

```bash
python app.py
```

Open your browser at **http://localhost:5000** 🎉

---

## 🤖 Customizing the AI Agent

The `AGENT_INSTRUCTIONS` section is at the **top of `app.py`** (lines 8–50). You can modify:

| Section | What to change |
|---|---|
| **TONE & PERSONALITY** | Adjust the coach's communication style |
| **WORKOUT SPECIALIZATION** | Change default exercises, splits, warm-up rules |
| **SAFETY RULES** | Add/remove safety guardrails |
| **FITNESS PREFERENCES** | Default cardio targets, hydration rules, meal philosophy |
| **RESPONSE FORMAT** | How workout/meal plans are structured |

The `SYSTEM_PROMPT` variable (below `AGENT_INSTRUCTIONS`) is what gets sent to IBM Granite. Edit it to further tune behaviour.

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serve the SPA |
| `/api/chat` | POST | AI chat with IBM Granite |
| `/api/workout-plan` | POST | Generate 7-day workout plan |
| `/api/meal-plan` | POST | Generate personalized meal plan |
| `/api/calculate-bmi` | POST | BMI + category + advice |
| `/api/calculate-calories` | POST | TDEE, macros (Mifflin-St Jeor) |
| `/api/calculate-water` | POST | Daily water intake recommendation |
| `/api/motivation` | GET | Random motivational quote from AI |
| `/api/health` | GET | Health check + AI status |

### Example: Chat request

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a 30-minute home workout for weight loss",
    "profile": {"weight": 80, "height": 175, "age": 30, "gender": "male", "goal": "weight_loss"},
    "history": []
  }'
```

---

## 🌐 Deployment

### Option A — Gunicorn (Linux/macOS production)

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option B — Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t fitbuddy-ai .
docker run -p 5000:5000 --env-file .env fitbuddy-ai
```

### Option C — IBM Code Engine

```bash
# Build and push image
ibmcloud ce project select --name my-project
ibmcloud ce app create \
  --name fitbuddy-ai \
  --image icr.io/<namespace>/fitbuddy-ai \
  --port 5000 \
  --env-from-secret fitbuddy-secrets
```

### Option D — Render / Railway / Fly.io

Set environment variables in the platform dashboard (copy from `.env.example`), then connect your repository. Make sure the start command is:

```
gunicorn -w 2 -b 0.0.0.0:$PORT app:app
```

---

## 🔒 Security Notes

- Never commit your `.env` file — it's in `.gitignore`
- Rotate your IBM Cloud API Key regularly
- Set a strong `FLASK_SECRET_KEY` in production
- Set `FLASK_ENV=production` in production deployments

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| Flask | 3.0.3 | Web framework |
| Flask-CORS | 4.0.1 | Cross-origin resource sharing |
| python-dotenv | 1.0.1 | Load `.env` file |
| ibm-watsonx-ai | 1.1.2 | IBM watsonx.ai SDK |
| requests | 2.32.3 | HTTP client |
| gunicorn | 22.0.0 | Production WSGI server |

Frontend uses Bootstrap 5.3 and Bootstrap Icons (CDN, no install required).

---

## 🧠 IBM Granite Model

Default model: **`ibm/granite-3-3-8b-instruct`**

To switch models, change `MODEL_ID` in `app.py`:

```python
MODEL_ID = "ibm/granite-3-3-8b-instruct"    # default
# MODEL_ID = "ibm/granite-3-8b-instruct"    # alternative
# MODEL_ID = "ibm/granite-13b-chat-v2"      # larger model
```

Generation parameters (temperature, top_p, max tokens) are in the `GENERATION_PARAMS` dict.

---

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| `⚠️ Demo Mode` in chat | Fill in `.env` with real IBM credentials |
| `401 Unauthorized` | Check your IBM Cloud API Key is valid and not expired |
| `404 Project not found` | Verify `WATSONX_PROJECT_ID` matches your project |
| Port already in use | Run with `PORT=5001 python app.py` |
| CORS errors | Flask-CORS is already configured; check your browser's console |

---

## 📄 License

MIT — free to use, modify, and deploy.

---

*Built with ❤️ using IBM watsonx.ai + IBM Granite Models*
