from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.task import Task
from app.models.user import User
from app.schemas.auth import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.ai_service import (
    breakdown_task,
    generate_productivity_insights,
    generate_task_from_text,
    suggest_task_priority,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
)

# ============================================================
# APP
# ============================================================

app = FastAPI(title="TaskFlow AI")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# ROOT
# ============================================================


@app.get("/")
def root():
    return {
        "message": "TaskFlow AI API is running",
    }


# ============================================================
# AUTHENTICATION
# ============================================================


@app.post("/auth/register", response_model=TokenResponse)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    new_user = User(
        email=user_data.email,
        hashed_password=hash_password(
            user_data.password
        ),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(
        data={
            "sub": str(new_user.id),
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    user = authenticate_user(
        db,
        user_data.email,
        user_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ============================================================
# CURRENT USER
# ============================================================


@app.get(
    "/auth/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
    }


# ============================================================
# TASKS
# ============================================================


@app.get(
    "/tasks",
    response_model=list[TaskResponse],
)
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.id)
        .all()
    )

    return tasks


@app.post(
    "/tasks",
    response_model=TaskResponse,
)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_task = Task(
        title=task.title,
        description=task.description,
        priority=task.priority,
        user_id=current_user.id,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@app.get(
    "/tasks/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


@app.put(
    "/tasks/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    if task_data.title is not None:
        task.title = task_data.title

    if task_data.description is not None:
        task.description = task_data.description

    if task_data.status is not None:
        task.status = task_data.status

    if task_data.priority is not None:
        task.priority = task_data.priority

    db.commit()
    db.refresh(task)

    return task


@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully",
        "task_id": task_id,
    }


# ============================================================
# AI REQUEST MODELS
# ============================================================


class AICreateTaskRequest(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=1000,
    )


class AIBreakdownRequest(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=1000,
    )


class AIPriorityRequest(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
    )

    description: str = Field(
        default="",
        max_length=2000,
    )


class AIInsightTask(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
    )

    status: str
    priority: str


class AIProductivityInsightsRequest(BaseModel):
    tasks: list[AIInsightTask] = Field(
        default_factory=list,
        max_length=50,
    )


# ============================================================
# AI CREATE TASK
# ============================================================


@app.post("/ai/create-task")
def ai_create_task(
    request: AICreateTaskRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        task = generate_task_from_text(
            request.text
        )

        return {
            "message": "Task generated successfully",
            "task": task,
        }

    except Exception as error:
        print(
            f"AI create task error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate task with AI",
        ) from error


# ============================================================
# AI BREAKDOWN
# ============================================================


@app.post("/ai/breakdown-task")
def ai_breakdown_task(
    request: AIBreakdownRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        breakdown = breakdown_task(
            request.text
        )

        return {
            "message": "Task breakdown generated successfully",
            "breakdown": breakdown,
        }

    except Exception as error:
        print(
            f"AI breakdown error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to break down task with AI",
        ) from error


# ============================================================
# AI PRIORITY
# ============================================================


@app.post("/ai/suggest-priority")
def ai_suggest_priority(
    request: AIPriorityRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        suggestion = suggest_task_priority(
            title=request.title,
            description=request.description,
        )

        return {
            "message": "Priority suggestion generated successfully",
            "suggestion": suggestion,
        }

    except Exception as error:
        print(
            f"AI priority error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate priority suggestion",
        ) from error


# ============================================================
# AI PRODUCTIVITY INSIGHTS
# ============================================================


@app.post("/ai/productivity-insights")
def ai_productivity_insights(
    request: AIProductivityInsightsRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        tasks = [
            task.model_dump()
            for task in request.tasks
        ]

        insights = generate_productivity_insights(
            tasks
        )

        return {
            "message": "Productivity insights generated successfully",
            "insights": insights,
        }

    except Exception as error:
        print(
            f"AI productivity insights error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate productivity insights",
        ) from error