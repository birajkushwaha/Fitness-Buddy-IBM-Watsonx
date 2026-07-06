"""
╔══════════════════════════════════════════════════════════════════╗
║              AI FITNESS BUDDY  —  Flask + IBM watsonx.ai         ║
║              Powered by IBM Granite Models                        ║
╚══════════════════════════════════════════════════════════════════╝

AGENT_INSTRUCTIONS
==================
Customize the AI agent behaviour here. These instructions are
injected as the system prompt for every conversation.

TONE & PERSONALITY
------------------
- Be encouraging, positive, and motivating — like a friendly personal trainer.
- Use clear, simple language. Avoid overly technical jargon unless asked.
- Keep responses concise but complete. Use bullet points and numbered lists
  for workout plans and meal suggestions.

WORKOUT SPECIALIZATION
----------------------
- Prioritize compound movements for strength training.
- Always offer modifications for beginners and advanced users.
- For home workouts, rely only on bodyweight and common household items.
- Include warm-up and cool-down guidance in every workout plan.

SAFETY RULES  (NEVER violate these)
------------------------------------
1. Always recommend consulting a doctor before starting any new fitness program,
   especially for users with health conditions.
2. Never prescribe specific medical treatments or diagnose conditions.
3. Advise users to stop any exercise that causes sharp pain.
4. For weight-loss goals, never recommend caloric deficits greater than 500 kcal/day.
5. For users under 16, only suggest age-appropriate, low-impact activities.

FITNESS PREFERENCES
-------------------
- Default workout split:  Push / Pull / Legs / Rest / Full-body / Cardio / Rest
- Default cardio recommendation: 150 min moderate-intensity per week (WHO guideline).
- Hydration rule: ~35 ml per kg of body weight per day (adjust for activity level).
- Meal philosophy: whole foods first, balanced macros, flexible dieting approach.
- Motivation style: data-driven encouragement (celebrate streaks, PRs, milestones).

RESPONSE FORMAT GUIDELINES
---------------------------
- For workout plans use:  Day X: <name>  →  Exercise list with sets × reps
- For meal plans use:    Meal X: <name>  →  Ingredients + approx. calories
- End every reply with one short motivational quote (italicised).
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.foundation_models.schema import TextGenParameters

# ─── load environment variables ───────────────────────────────────────────────
load_dotenv()

# ─── Flask setup ──────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-prod")
CORS(app)

# ─── IBM watsonx.ai setup ─────────────────────────────────────────────────────
IBM_API_KEY        = os.getenv("IBM_API_KEY", "")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "")
# Default to Sydney (au-syd) — override via WATSONX_URL in .env for other regions
WATSONX_URL        = os.getenv("WATSONX_URL", "https://au-syd.ml.cloud.ibm.com")

# ─── Model configuration ──────────────────────────────────────────────────────
# ibm/granite-3-3-8b-instruct is not available in au-syd; use the best
# instruct model that IS deployed in this region's project.
MODEL_ID = "meta-llama/llama-3-3-70b-instruct"

GENERATION_PARAMS = TextGenParameters(
    temperature=0.7,
    top_p=0.9,
    top_k=50,
    repetition_penalty=1.1,
)

# ─── System prompt (built from AGENT_INSTRUCTIONS above) ─────────────────────
SYSTEM_PROMPT = """You are Fitness Buddy, an expert AI personal trainer and nutritionist powered by IBM watsonx.ai.
You specialize in creating personalized fitness plans, nutrition advice, and healthy lifestyle coaching.

PERSONALITY & TONE:
- Be encouraging, positive, and motivating like a friendly personal trainer
- Use clear, simple language with bullet points and numbered lists for plans
- Keep responses concise but complete

WORKOUT EXPERTISE:
- Prioritize compound movements for strength training
- Always offer beginner and advanced modifications
- For home workouts, use bodyweight and common household items only
- Always include warm-up and cool-down guidance

SAFETY RULES (strictly follow):
1. Always recommend consulting a doctor before starting a new fitness program
2. Never prescribe medical treatments or diagnose conditions
3. Advise users to stop any exercise causing sharp pain
4. Never recommend caloric deficits greater than 500 kcal/day for weight loss
5. For users under 16, suggest only age-appropriate, low-impact activities

FITNESS DEFAULTS:
- Workout split: Push/Pull/Legs/Rest/Full-body/Cardio/Rest
- Cardio: 150 min moderate-intensity per week (WHO guideline)
- Hydration: ~35 ml per kg body weight per day
- Meal philosophy: whole foods, balanced macros, flexible dieting

RESPONSE FORMAT:
- Workout plans: "Day X: <name> → Exercise list with sets × reps"
- Meal plans: "Meal X: <name> → Ingredients + approx. calories"
- End every reply with one short motivational quote in italics

Always personalize advice using the user's profile data when available."""


def _init_watsonx_model() -> ModelInference | None:
    """
    Build a single ModelInference instance at startup.
    Returns None (Demo Mode) when credentials are absent or invalid.
    """
    if not IBM_API_KEY or not WATSONX_PROJECT_ID:
        return None
    try:
        credentials = Credentials(
            url=WATSONX_URL,
            api_key=IBM_API_KEY,
        )
        return ModelInference(
            model_id=MODEL_ID,
            credentials=credentials,
            project_id=WATSONX_PROJECT_ID,
            params=GENERATION_PARAMS,
        )
    except Exception as exc:
        # Log at startup so the operator sees the exact error immediately.
        import logging
        logging.getLogger(__name__).error(
            "watsonx.ai init failed — running in Demo Mode. Error: %s", exc
        )
        return None


# Module-level singleton: created once, reused across all requests.
_watsonx_model: ModelInference | None = _init_watsonx_model()


def build_user_context(profile: dict) -> str:
    """Build a descriptive user context string from the profile dict."""
    if not profile:
        return ""
    parts = []
    if profile.get("name"):
        parts.append(f"Name: {profile['name']}")
    if profile.get("age"):
        parts.append(f"Age: {profile['age']} years")
    if profile.get("gender"):
        parts.append(f"Gender: {profile['gender']}")
    if profile.get("height"):
        parts.append(f"Height: {profile['height']} cm")
    if profile.get("weight"):
        parts.append(f"Weight: {profile['weight']} kg")
    if profile.get("goal"):
        parts.append(f"Fitness Goal: {profile['goal']}")
    if profile.get("activity_level"):
        parts.append(f"Activity Level: {profile['activity_level']}")
    if profile.get("workout_time"):
        parts.append(f"Available Workout Time: {profile['workout_time']} min/day")
    if profile.get("equipment"):
        parts.append(f"Available Equipment: {profile['equipment']}")
    if profile.get("health_conditions"):
        parts.append(f"Health Conditions/Notes: {profile['health_conditions']}")
    return "\n".join(parts)


def chat_with_granite(user_message: str, conversation_history: list, profile: dict) -> str:
    """Send a message to IBM Granite and return the response."""
    model = _watsonx_model

    if model is None:
        return (
            "⚠️ **Demo Mode** — IBM watsonx.ai credentials are not configured.\n\n"
            "To activate the AI, copy `.env.example` to `.env` and fill in your "
            "IBM Cloud API Key and watsonx.ai Project ID.\n\n"
            "_You can still explore the dashboard, calculators, and workout planner!_"
        )

    user_ctx = build_user_context(profile)
    system_with_ctx = SYSTEM_PROMPT
    if user_ctx:
        system_with_ctx += f"\n\nCURRENT USER PROFILE:\n{user_ctx}"

    # Build the prompt using Granite chat format
    messages = [{"role": "system", "content": system_with_ctx}]
    for turn in conversation_history[-10:]:          # keep last 10 turns for context
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        response = model.chat(messages=messages)
        return response["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        app.logger.error("Granite inference error: %s", exc)
        return (
            "I encountered an issue reaching the AI service. "
            "Please check your credentials and try again. "
            f"Error: {exc}"
        )


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main single-page application."""
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Handle chat messages and return AI responses."""
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "Message cannot be empty"}), 400

    profile = data.get("profile", {})
    history = data.get("history", [])

    response_text = chat_with_granite(user_message, history, profile)
    return jsonify({
        "response": response_text,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/api/workout-plan", methods=["POST"])
def generate_workout_plan():
    """Generate a personalized weekly workout plan."""
    data = request.get_json(silent=True) or {}
    profile = data.get("profile", {})

    goal        = profile.get("goal", "general fitness")
    level       = profile.get("activity_level", "beginner")
    time_avail  = profile.get("workout_time", 45)
    equipment   = profile.get("equipment", "none")

    prompt = (
        f"Generate a complete 7-day personalized workout plan for a {level} "
        f"with the goal of {goal}. "
        f"Available time: {time_avail} minutes per session. "
        f"Equipment: {equipment}. "
        "Format each day clearly with Day number, workout name, and exercises "
        "with sets × reps. Include warm-up and cool-down."
    )

    plan = chat_with_granite(prompt, [], profile)
    return jsonify({"plan": plan, "timestamp": datetime.now().isoformat()})


@app.route("/api/meal-plan", methods=["POST"])
def generate_meal_plan():
    """Generate a personalized daily meal plan."""
    data    = request.get_json(silent=True) or {}
    profile = data.get("profile", {})
    calories = data.get("target_calories", 2000)

    prompt = (
        f"Create a detailed, nutritious daily meal plan targeting {calories} calories. "
        f"User goal: {profile.get('goal', 'general health')}. "
        "Include breakfast, mid-morning snack, lunch, afternoon snack, and dinner. "
        "For each meal provide: name, ingredients, preparation (brief), and calories. "
        "Prioritize whole foods and balanced macronutrients."
    )

    plan = chat_with_granite(prompt, [], profile)
    return jsonify({"plan": plan, "timestamp": datetime.now().isoformat()})


@app.route("/api/calculate-bmi", methods=["POST"])
def calculate_bmi():
    """Calculate BMI and return category + advice."""
    data   = request.get_json(silent=True) or {}
    weight = float(data.get("weight", 0))   # kg
    height = float(data.get("height", 0))   # cm

    if weight <= 0 or height <= 0:
        return jsonify({"error": "Invalid weight or height"}), 400

    height_m = height / 100
    bmi      = round(weight / (height_m ** 2), 1)

    if bmi < 18.5:
        category, color = "Underweight", "#3b82f6"
        advice = "Consider a calorie-surplus diet with strength training to build muscle mass."
    elif bmi < 25:
        category, color = "Normal weight", "#22c55e"
        advice = "Great! Maintain your healthy weight with balanced nutrition and regular exercise."
    elif bmi < 30:
        category, color = "Overweight", "#f59e0b"
        advice = "Focus on a moderate calorie deficit, cardio, and strength training."
    else:
        category, color = "Obese", "#ef4444"
        advice = "Consult a healthcare provider. Start with low-impact activities and balanced nutrition."

    return jsonify({
        "bmi": bmi,
        "category": category,
        "color": color,
        "advice": advice,
    })


@app.route("/api/calculate-calories", methods=["POST"])
def calculate_calories():
    """Calculate TDEE and macro split using Mifflin-St Jeor equation."""
    data     = request.get_json(silent=True) or {}
    weight   = float(data.get("weight", 70))    # kg
    height   = float(data.get("height", 170))   # cm
    age      = int(data.get("age", 25))
    gender   = data.get("gender", "male").lower()
    activity = data.get("activity_level", "moderate")
    goal     = data.get("goal", "maintain")

    # Mifflin-St Jeor BMR
    if gender == "female":
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age + 5

    activity_multipliers = {
        "sedentary":    1.2,
        "light":        1.375,
        "moderate":     1.55,
        "active":       1.725,
        "very_active":  1.9,
    }
    multiplier = activity_multipliers.get(activity, 1.55)
    tdee       = round(bmr * multiplier)

    goal_adjustments = {
        "weight_loss":   -500,
        "mild_loss":     -250,
        "maintain":       0,
        "mild_gain":     +250,
        "muscle_gain":   +500,
    }
    adjustment   = goal_adjustments.get(goal, 0)
    target_cals  = tdee + adjustment

    # Macro split (protein-first approach)
    protein_g = round(weight * 2.0)          # 2 g / kg
    fat_g     = round(target_cals * 0.25 / 9)
    carbs_g   = round((target_cals - protein_g * 4 - fat_g * 9) / 4)

    return jsonify({
        "bmr":         round(bmr),
        "tdee":        tdee,
        "target":      target_cals,
        "adjustment":  adjustment,
        "macros": {
            "protein_g": protein_g,
            "carbs_g":   max(carbs_g, 0),
            "fat_g":     fat_g,
            "protein_pct": round(protein_g * 4 / target_cals * 100),
            "carbs_pct":   round(max(carbs_g, 0) * 4 / target_cals * 100),
            "fat_pct":     round(fat_g * 9 / target_cals * 100),
        },
    })


@app.route("/api/calculate-water", methods=["POST"])
def calculate_water():
    """Calculate daily water intake recommendation."""
    data           = request.get_json(silent=True) or {}
    weight         = float(data.get("weight", 70))     # kg
    activity_level = data.get("activity_level", "moderate")
    climate        = data.get("climate", "temperate")

    base_ml = weight * 35   # 35 ml / kg baseline

    activity_bonus = {
        "sedentary":   0,
        "light":       300,
        "moderate":    500,
        "active":      700,
        "very_active": 1000,
    }.get(activity_level, 500)

    climate_bonus = {
        "cold":     -200,
        "temperate":  0,
        "hot":       400,
        "very_hot":  700,
    }.get(climate, 0)

    total_ml    = round(base_ml + activity_bonus + climate_bonus)
    total_liters = round(total_ml / 1000, 1)
    glasses_8oz  = round(total_ml / 237)   # 8 oz ≈ 237 ml

    return jsonify({
        "total_ml":     total_ml,
        "total_liters": total_liters,
        "glasses_8oz":  glasses_8oz,
        "breakdown": {
            "base_ml":        round(base_ml),
            "activity_bonus": activity_bonus,
            "climate_bonus":  climate_bonus,
        },
    })


@app.route("/api/motivation", methods=["GET"])
def get_motivation():
    """Return a random motivational fitness quote from Granite."""
    profile = {}
    prompt  = (
        "Give me ONE short, powerful motivational fitness quote (max 20 words). "
        "Make it original, energizing, and action-oriented. "
        "Return only the quote, no attribution, no extra text."
    )
    quote = chat_with_granite(prompt, [], profile)
    # strip any surrounding quotes
    quote = quote.strip('"\'').strip()
    return jsonify({"quote": quote, "timestamp": datetime.now().isoformat()})


@app.route("/api/health", methods=["GET"])
def health_check():
    """Simple health-check endpoint."""
    return jsonify({
        "status":    "ok",
        "model":     MODEL_ID,
        "ai_ready":  _watsonx_model is not None,
        "region":    WATSONX_URL,
        "timestamp": datetime.now().isoformat(),
    })


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    print(f"\n🏋️  AI Fitness Buddy is running at http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
