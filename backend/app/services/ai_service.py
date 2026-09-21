import json
import re

from ollama import chat

MODEL_NAME = "llama3.2:3b"


def _clean_json_response(content: str) -> dict:
    """Clean an LLM response and convert it into a Python dictionary."""
    content = content.strip()

    content = re.sub(r"^```json\s*", "", content, flags=re.IGNORECASE)
    content = re.sub(r"^```\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", content, re.DOTALL)

    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as error:
            raise ValueError(
                f"Unable to parse AI response as JSON: {error}"
            ) from error

    raise ValueError("AI did not return valid JSON.")


def _chat_json(prompt: str) -> dict:
    response = chat(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
        options={
            "temperature": 0,
            "seed": 42,
        },
    )

    return _clean_json_response(response["message"]["content"])


# ============================================================
# AI TASK CREATION
# ============================================================


def generate_task_from_text(text: str) -> dict:
    prompt = f"""
You are an AI task management assistant.

Convert the user's description into a structured task.

USER INPUT:
{text}

Return ONLY valid JSON.

Use exactly this structure:

{{
  "title": "Short clear task title",
  "description": "Useful task description",
  "priority": "low | medium | high"
}}

Rules:
- Create a concise and meaningful title.
- Create a useful description.
- Detect urgency or priority from the user's wording.
- If the user explicitly says high priority, use high.
- If the user explicitly says low priority, use low.
- Otherwise choose the most appropriate priority.
- Do not add any fields.
- Do not use markdown.
- Return JSON only.
"""

    result = _chat_json(prompt)

    title = result.get("title")
    description = result.get("description")
    priority = result.get("priority")

    if not isinstance(title, str) or not title.strip():
        raise ValueError("AI did not return a valid task title.")

    if description is not None and not isinstance(description, str):
        description = str(description)

    if priority not in {"low", "medium", "high"}:
        priority = "medium"

    return {
        "title": title.strip(),
        "description": (
            description.strip()
            if isinstance(description, str)
            else None
        ),
        "priority": priority,
    }


# ============================================================
# AI TASK BREAKDOWN
# ============================================================


def breakdown_task(text: str) -> dict:
    prompt = f"""
You are an AI productivity assistant.

Break the following task into smaller, practical, actionable subtasks.

TASK:
{text}

Return ONLY valid JSON.

Use exactly this structure:

{{
  "title": "Short task title",
  "subtasks": [
    "Actionable subtask 1",
    "Actionable subtask 2",
    "Actionable subtask 3",
    "Actionable subtask 4"
  ]
}}

Rules:
- Generate between 4 and 8 subtasks.
- Each subtask must be actionable.
- Each subtask should represent a meaningful step.
- Keep the subtasks concise.
- Arrange them in a logical order when possible.
- Do not add unnecessary information.
- Do not use markdown.
- Do not include anything outside the JSON.
"""

    result = _chat_json(prompt)

    title = result.get("title")
    subtasks = result.get("subtasks")

    if not isinstance(title, str) or not title.strip():
        title = text.strip()

    if not isinstance(subtasks, list):
        raise ValueError("AI did not return a valid subtask list.")

    cleaned_subtasks = [
        item.strip()
        for item in subtasks
        if isinstance(item, str) and item.strip()
    ]

    if not cleaned_subtasks:
        raise ValueError("AI did not generate any valid subtasks.")

    return {
        "title": title.strip(),
        "subtasks": cleaned_subtasks,
    }


# ============================================================
# AI PRIORITY SUGGESTION
# ============================================================


def suggest_task_priority(title: str, description: str) -> dict:
    prompt = f"""
You are an AI task-priority analysis system.

Analyze the following task carefully.

TASK TITLE:
{title}

TASK DESCRIPTION:
{description}

Evaluate the task using exactly these five factors:

1. urgency
2. importance
3. deadline
4. consequences
5. blocking_impact

Give each factor a score from 1 to 10.

Scoring guide:
1 = very low
2 = very low
3 = low
4 = somewhat low
5 = moderate
6 = moderate
7 = somewhat high
8 = high
9 = very high
10 = extremely high

Important rules:
- Only evaluate the information provided in the task.
- Do not invent deadlines.
- Do not invent consequences.
- If no deadline is mentioned, give deadline a low score.
- If the task blocks other important work, increase blocking_impact.
- If there is no evidence that it blocks other work, keep blocking_impact lower.
- Consider importance separately from urgency.
- Consider consequences separately from importance.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not include any explanation outside the JSON.
- Do NOT return a priority field.
- The backend will calculate the final priority from your scores.

Return exactly this structure:

{{
  "reason": "A short explanation of the analysis.",
  "analysis": {{
    "urgency": 1,
    "importance": 1,
    "deadline": 1,
    "consequences": 1,
    "blocking_impact": 1
  }}
}}
"""

    result = _chat_json(prompt)
    analysis = result.get("analysis", {})

    if not isinstance(analysis, dict):
        analysis = {}

    factor_names = [
        "urgency",
        "importance",
        "deadline",
        "consequences",
        "blocking_impact",
    ]

    cleaned_analysis = {}

    for factor in factor_names:
        try:
            value = int(analysis.get(factor, 1))
        except (TypeError, ValueError):
            value = 1

        cleaned_analysis[factor] = max(1, min(10, value))

    average_score = sum(cleaned_analysis.values()) / len(
        cleaned_analysis
    )

    if average_score >= 7:
        priority = "high"
    elif average_score >= 4:
        priority = "medium"
    else:
        priority = "low"

    reason = result.get("reason")

    if not isinstance(reason, str) or not reason.strip():
        reason = (
            "Priority was calculated from the AI analysis of urgency, "
            "importance, deadline, consequences, and blocking impact."
        )

    return {
        "priority": priority,
        "reason": reason.strip(),
        "analysis": cleaned_analysis,
    }


# ============================================================
# AI PRODUCTIVITY INSIGHTS
# ============================================================


def generate_productivity_insights(tasks: list[dict]) -> dict:
    """
    Generate AI-powered productivity insights from the current task list.

    Numeric metrics are calculated by the backend so the AI cannot invent
    them. The model is responsible only for interpreting the supplied data.
    """

    total_tasks = len(tasks)
    completed_tasks = sum(
        1 for task in tasks if task.get("status") == "completed"
    )
    pending_tasks = sum(
        1 for task in tasks if task.get("status") == "pending"
    )
    in_progress_tasks = sum(
        1
        for task in tasks
        if task.get("status") == "in_progress"
    )

    high_priority_tasks = sum(
        1 for task in tasks if task.get("priority") == "high"
    )
    medium_priority_tasks = sum(
        1 for task in tasks if task.get("priority") == "medium"
    )
    low_priority_tasks = sum(
        1 for task in tasks if task.get("priority") == "low"
    )

    completion_rate = (
        round((completed_tasks / total_tasks) * 100, 1)
        if total_tasks
        else 0
    )

    task_context = [
        {
            "title": str(task.get("title", ""))[:200],
            "status": task.get("status", "pending"),
            "priority": task.get("priority", "medium"),
        }
        for task in tasks[:50]
    ]

    prompt = f"""
You are an AI productivity coach inside a task management application.

Analyze the supplied task metrics and task list.

METRICS:
- Total tasks: {total_tasks}
- Completed tasks: {completed_tasks}
- Pending tasks: {pending_tasks}
- In-progress tasks: {in_progress_tasks}
- Completion rate: {completion_rate}%
- High priority tasks: {high_priority_tasks}
- Medium priority tasks: {medium_priority_tasks}
- Low priority tasks: {low_priority_tasks}

TASK LIST:
{json.dumps(task_context, ensure_ascii=False)}

Return ONLY valid JSON using exactly this structure:

{{
  "summary": "2 short sentences summarizing the current workload.",
  "focus": "One concrete thing the user should focus on next.",
  "strengths": [
    "Positive observation supported by the data",
    "Another positive observation supported by the data"
  ],
  "suggestions": [
    "Practical next step",
    "Practical next step",
    "Practical next step"
  ]
}}

Rules:
- Base every observation on the supplied metrics or task list.
- Do not invent deadlines.
- Do not claim productivity has improved unless the data contains historical evidence.
- Do not make health or psychological claims.
- Keep the language concise and professional.
- Generate 2 strengths.
- Generate 3 practical suggestions.
- Return JSON only.
"""

    result = _chat_json(prompt)

    def clean_string_list(value, fallback):
        if not isinstance(value, list):
            return fallback

        cleaned = [
            item.strip()
            for item in value
            if isinstance(item, str) and item.strip()
        ]

        return cleaned or fallback

    summary = result.get("summary")
    focus = result.get("focus")

    if not isinstance(summary, str) or not summary.strip():
        summary = (
            f"You currently have {total_tasks} tasks, with "
            f"{completed_tasks} completed and "
            f"{in_progress_tasks} in progress."
        )

    if not isinstance(focus, str) or not focus.strip():
        focus = (
            "Focus on completing the highest-priority unfinished task "
            "before adding more work."
        )

    strengths = clean_string_list(
        result.get("strengths"),
        [
            f"You have completed {completed_tasks} of {total_tasks} tasks.",
            (
                f"Your current workload contains "
                f"{high_priority_tasks} high-priority tasks."
            ),
        ],
    )[:3]

    suggestions = clean_string_list(
        result.get("suggestions"),
        [
            "Review your high-priority unfinished tasks first.",
            "Move one active task toward completion before starting another.",
            "Break down complex tasks into smaller actionable steps when needed.",
        ],
    )[:4]

    return {
        "summary": summary.strip(),
        "focus": focus.strip(),
        "strengths": strengths,
        "suggestions": suggestions,
        "metrics": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "in_progress_tasks": in_progress_tasks,
            "completion_rate": completion_rate,
            "high_priority_tasks": high_priority_tasks,
            "medium_priority_tasks": medium_priority_tasks,
            "low_priority_tasks": low_priority_tasks,
        },
    }