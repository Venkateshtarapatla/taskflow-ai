import { useEffect, useState } from "react";
import "./App.css";
import {
  aiBreakdownTask,
  aiCreateTask,
  aiProductivityInsights,
  aiSuggestPriority,
  createTask,
  deleteTask as deleteTaskApi,
  getTasks,
  updateTask,
} from "./api";

type Status = "pending" | "in_progress" | "completed";
type Priority = "low" | "medium" | "high";
type SortOption =
  | "newest"
  | "oldest"
  | "priority_high"
  | "priority_low"
  | "title_az";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

interface TaskForm {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
}

interface AICreatedTask {
  title: string;
  description: string;
  priority: Priority;
}

interface BreakdownResult {
  title: string;
  subtasks: string[];
}

interface PrioritySuggestion {
  priority: Priority;
  reason: string;
  analysis?: {
    urgency: number;
    importance: number;
    deadline: number;
    consequences: number;
    blocking_impact: number;
  };
}

interface ProductivityInsights {
  summary: string;
  focus: string;
  strengths: string[];
  suggestions: string[];
  metrics: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completion_rate: number;
    high_priority_tasks: number;
    medium_priority_tasks: number;
    low_priority_tasks: number;
  };
}

const emptyForm: TaskForm = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
};

function App() {
  // ============================================================
  // TASK STATE
  // ============================================================

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // NORMAL TASK MODAL
  // ============================================================

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // ============================================================
  // FILTER
  // ============================================================

  const [filter, setFilter] = useState<"all" | Status>("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | Priority
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // ============================================================
  // AI CREATE TASK
  // ============================================================

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiText, setAIText] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState("");

  // ============================================================
  // AI BREAKDOWN
  // ============================================================

  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");

  const [breakdownTaskData, setBreakdownTaskData] =
    useState<Task | null>(null);

  const [breakdownResult, setBreakdownResult] =
    useState<BreakdownResult | null>(null);

  const [selectedSubtasks, setSelectedSubtasks] =
    useState<string[]>([]);

  const [creatingSubtasks, setCreatingSubtasks] =
    useState(false);

  // ============================================================
  // AI PRIORITY
  // ============================================================

  const [showPriorityModal, setShowPriorityModal] =
    useState(false);

  const [priorityTask, setPriorityTask] =
    useState<Task | null>(null);

  const [prioritySuggestion, setPrioritySuggestion] =
    useState<PrioritySuggestion | null>(null);

  const [priorityLoading, setPriorityLoading] =
    useState(false);

  const [priorityError, setPriorityError] =
    useState("");

  const [applyingPriority, setApplyingPriority] =
    useState(false);

  // ============================================================
  // AI PRODUCTIVITY INSIGHTS
  // ============================================================

  const [showInsightsModal, setShowInsightsModal] =
    useState(false);

  const [insightsLoading, setInsightsLoading] =
    useState(false);

  const [insightsError, setInsightsError] =
    useState("");

  const [productivityInsights, setProductivityInsights] =
    useState<ProductivityInsights | null>(null);

  // ============================================================
  // FETCH TASKS
  // ============================================================

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTasks();

      setTasks(data);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load tasks. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // ============================================================
  // AUTHENTICATION / SESSION HANDLING
  // ============================================================

  const logout = () => {
    localStorage.removeItem("taskflow_token");
    window.location.reload();
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      sessionStorage.setItem(
        "taskflow_session_expired",
        "true",
      );
      window.location.reload();
    };

    window.addEventListener(
      "taskflow:unauthorized",
      handleUnauthorized,
    );

    return () => {
      window.removeEventListener(
        "taskflow:unauthorized",
        handleUnauthorized,
      );
    };
  }, []);

  // ============================================================
  // LOCK BACKGROUND SCROLL WHEN A MODAL IS OPEN
  // ============================================================

  useEffect(() => {
    const modalOpen =
      showModal ||
      showAIModal ||
      showBreakdownModal ||
      showPriorityModal ||
      showInsightsModal;

    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [
    showModal,
    showAIModal,
    showBreakdownModal,
    showPriorityModal,
    showInsightsModal,
  ]);

  // ============================================================
  // NORMAL TASK MODAL
  // ============================================================

  const openAddModal = () => {
    setEditingTask(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);

    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingTask(null);
    setForm(emptyForm);
  };

  const updateForm = (
    field: keyof TaskForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // ============================================================
  // CREATE / UPDATE TASK
  // ============================================================

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingTask) {
        await updateTask(editingTask.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
          priority: form.priority,
        });
      } else {
        await createTask({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
        });
      }

      closeModal();

      await fetchTasks();
    } catch (err) {
      console.error(err);

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CHANGE STATUS
  // ============================================================

  const changeTaskStatus = async (
    task: Task,
    newStatus: Status
  ) => {
    try {
      setError("");

      await updateTask(task.id, {
        title: task.title,
        description: task.description,
        status: newStatus,
        priority: task.priority,
      });

      await fetchTasks();
    } catch (err) {
      console.error(err);

      setError(
        "Unable to update task status."
      );
    }
  };

  // ============================================================
  // DELETE TASK
  // ============================================================

  const deleteTask = async (task: Task) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteTaskApi(task.id);

      await fetchTasks();
    } catch (err) {
      console.error(err);

      setError(
        "Unable to delete the task."
      );
    }
  };

  // ============================================================
  // AI CREATE TASK
  // ============================================================

  const openAIModal = () => {
    setAIText("");
    setAIError("");
    setShowAIModal(true);
  };

  const closeAIModal = () => {
    if (aiLoading) return;

    setShowAIModal(false);
    setAIText("");
    setAIError("");
  };

  const generateAITask = async () => {
    if (!aiText.trim()) return;

    try {
      setAILoading(true);
      setAIError("");

      const data = await aiCreateTask<{
        task: AICreatedTask;
      }>(aiText.trim());

      const generatedTask: AICreatedTask =
        data.task;

      await createTask({
        title: generatedTask.title,
        description: generatedTask.description,
        priority: generatedTask.priority,
      });

      closeAIModal();

      await fetchTasks();
    } catch (err) {
      console.error(err);

      setAIError(
        "Unable to generate the task. Make sure Ollama is running and try again."
      );
    } finally {
      setAILoading(false);
    }
  };

  // ============================================================
  // AI BREAKDOWN
  // ============================================================

  const openBreakdownModal = async (
    task: Task
  ) => {
    setBreakdownTaskData(task);
    setBreakdownResult(null);
    setSelectedSubtasks([]);
    setBreakdownError("");
    setShowBreakdownModal(true);
    setBreakdownLoading(true);

    try {
      const data = await aiBreakdownTask<{
        breakdown: BreakdownResult;
      }>(task.title);

      const result: BreakdownResult =
        data.breakdown;

      setBreakdownResult(result);

      setSelectedSubtasks(
        result.subtasks
      );
    } catch (err) {
      console.error(err);

      setBreakdownError(
        "Unable to break down this task. Make sure Ollama is running and try again."
      );
    } finally {
      setBreakdownLoading(false);
    }
  };

  const closeBreakdownModal = () => {
    if (creatingSubtasks) return;

    setShowBreakdownModal(false);
    setBreakdownTaskData(null);
    setBreakdownResult(null);
    setSelectedSubtasks([]);
    setBreakdownError("");
  };

  const toggleSubtask = (
    subtask: string
  ) => {
    setSelectedSubtasks((current) => {
      if (current.includes(subtask)) {
        return current.filter(
          (item) => item !== subtask
        );
      }

      return [...current, subtask];
    });
  };

  const selectAllSubtasks = () => {
    if (!breakdownResult) return;

    setSelectedSubtasks(
      breakdownResult.subtasks
    );
  };

  const clearAllSubtasks = () => {
    setSelectedSubtasks([]);
  };

  // ============================================================
  // CREATE SELECTED SUBTASKS
  // ============================================================

  const createSelectedSubtasks = async () => {
    if (
      !breakdownTaskData ||
      selectedSubtasks.length === 0
    ) {
      return;
    }

    try {
      setCreatingSubtasks(true);
      setBreakdownError("");

      for (const subtask of selectedSubtasks) {
        await createTask({
          title: subtask,
          description: `Subtask of: ${breakdownTaskData.title}`,
          priority: breakdownTaskData.priority,
        });
      }

      closeBreakdownModal();

      await fetchTasks();
    } catch (err) {
      console.error(err);

      setBreakdownError(
        "Unable to create the selected subtasks."
      );
    } finally {
      setCreatingSubtasks(false);
    }
  };

  // ============================================================
  // AI PRIORITY SUGGESTION
  // ============================================================

  const openPriorityModal = async (
    task: Task
  ) => {
    setPriorityTask(task);
    setPrioritySuggestion(null);
    setPriorityError("");
    setShowPriorityModal(true);
    setPriorityLoading(true);

    try {
      const data = await aiSuggestPriority<{
        suggestion: PrioritySuggestion;
      }>(
        task.title,
        task.description || ""
      );

      const suggestion: PrioritySuggestion =
        data.suggestion;

      setPrioritySuggestion(suggestion);
    } catch (err) {
      console.error(err);

      setPriorityError(
        "Unable to generate a priority suggestion. Make sure Ollama is running and try again."
      );
    } finally {
      setPriorityLoading(false);
    }
  };

  const closePriorityModal = () => {
    if (applyingPriority) return;

    setShowPriorityModal(false);
    setPriorityTask(null);
    setPrioritySuggestion(null);
    setPriorityError("");
  };

  // ============================================================
  // APPLY AI PRIORITY
  // ============================================================

  const applySuggestedPriority = async () => {
    if (
      !priorityTask ||
      !prioritySuggestion
    ) {
      return;
    }

    try {
      setApplyingPriority(true);
      setPriorityError("");

      await updateTask(priorityTask.id, {
        title: priorityTask.title,
        description: priorityTask.description,
        status: priorityTask.status,
        priority: prioritySuggestion.priority,
      });

      closePriorityModal();

      await fetchTasks();
    } catch (err) {
      console.error(err);

      setPriorityError(
        "Unable to apply the suggested priority."
      );
    } finally {
      setApplyingPriority(false);
    }
  };

  // ============================================================
  // AI PRODUCTIVITY INSIGHTS
  // ============================================================

  const openInsightsModal = async () => {
    setShowInsightsModal(true);
    setInsightsLoading(true);
    setInsightsError("");
    setProductivityInsights(null);

    try {
      const data = await aiProductivityInsights<{
        insights: ProductivityInsights;
      }>(tasks);

      setProductivityInsights(data.insights);
    } catch (err) {
      console.error(err);

      setInsightsError(
        "Unable to generate productivity insights. Make sure Ollama is running and try again."
      );
    } finally {
      setInsightsLoading(false);
    }
  };

  const closeInsightsModal = () => {
    if (insightsLoading) return;

    setShowInsightsModal(false);
    setInsightsError("");
    setProductivityInsights(null);
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const priorityRank: Record<Priority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredTasks = [...tasks]
    .filter((task) => {
      if (filter !== "all" && task.status !== filter) {
        return false;
      }

      if (
        priorityFilter !== "all" &&
        task.priority !== priorityFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        task.title.toLowerCase().includes(normalizedSearch) ||
        (task.description || "")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );

        case "priority_high":
          return (
            priorityRank[b.priority] -
            priorityRank[a.priority]
          );

        case "priority_low":
          return (
            priorityRank[a.priority] -
            priorityRank[b.priority]
          );

        case "title_az":
          return a.title.localeCompare(b.title);

        case "newest":
        default:
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
      }
    });

  // ============================================================
  // STATISTICS
  // ============================================================

  const totalTasks = tasks.length;

  const pendingTasks = tasks.filter(
    (task) =>
      task.status === "pending"
  ).length;

  const inProgressTasks = tasks.filter(
    (task) =>
      task.status === "in_progress"
  ).length;

  const completedTasks = tasks.filter(
    (task) =>
      task.status === "completed"
  ).length;

  // ============================================================
  // PRIORITY LABEL
  // ============================================================

  const getPriorityLabel = (
    priority: Priority
  ) => {
    return priority.toUpperCase();
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="header">

        <div>
          <h1>TaskFlow AI</h1>

          <p>
            AI-powered task management
          </p>
        </div>

        <div className="header-actions">

          <button
            className="ai-create-button"
            onClick={openAIModal}
          >
            ✨ Create with AI
          </button>

          <button
            className="add-button"
            onClick={openAddModal}
          >
            + Add Task
          </button>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </header>

      <main className="dashboard">

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="error-message">

            <span>{error}</span>

            <button
              onClick={fetchTasks}
            >
              Try Again
            </button>

          </div>
        )}

        {/* ====================================================
            STATS
        ==================================================== */}

        <section className="stats">

          <div className="stat-card">
            <span>Total Tasks</span>
            <strong>
              {totalTasks}
            </strong>
          </div>

          <div className="stat-card">
            <span>To Do</span>
            <strong>
              {pendingTasks}
            </strong>
          </div>

          <div className="stat-card">
            <span>In Progress</span>
            <strong>
              {inProgressTasks}
            </strong>
          </div>

          <div className="stat-card">
            <span>Completed</span>
            <strong>
              {completedTasks}
            </strong>
          </div>

        </section>

        {/* ====================================================
            TASK SECTION
        ==================================================== */}

        <section className="tasks-section">

          <div className="section-header">

            <div>
              <h2>My Tasks</h2>

              <p>
                {filteredTasks.length}{" "}
                {filteredTasks.length === 1
                  ? "task"
                  : "tasks"}
              </p>
            </div>

            <div className="section-header-actions">
              <button
                type="button"
                className="insights-button"
                onClick={openInsightsModal}
                disabled={tasks.length === 0 || insightsLoading}
              >
                ✨ AI Insights
              </button>
            </div>

          </div>

          <div className="task-controls">
            <div className="task-search-wrapper">
              <span className="task-search-icon">⌕</span>

              <input
                type="search"
                className="task-search-input"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search tasks..."
                aria-label="Search tasks"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="task-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear task search"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <select
              className="filter-select"
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value as
                    | "all"
                    | Status
                )
              }
              aria-label="Filter by status"
            >
              <option value="all">Status: All</option>
              <option value="pending">Status: To Do</option>
              <option value="in_progress">
                Status: In Progress
              </option>
              <option value="completed">
                Status: Completed
              </option>
            </select>

            <select
              className="filter-select"
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value as
                    | "all"
                    | Priority
                )
              }
              aria-label="Filter by priority"
            >
              <option value="all">Priority: All</option>
              <option value="high">Priority: High</option>
              <option value="medium">
                Priority: Medium
              </option>
              <option value="low">Priority: Low</option>
            </select>

            <select
              className="filter-select"
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target.value as SortOption
                )
              }
              aria-label="Sort tasks"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority_high">
                Priority: High to Low
              </option>
              <option value="priority_low">
                Priority: Low to High
              </option>
              <option value="title_az">
                Title: A to Z
              </option>
            </select>
          </div>

          {/* ==================================================
              LOADING
          ================================================== */}

          {loading ? (

            <div className="empty-state">

              <div className="spinner"></div>

              <p>
                Loading tasks...
              </p>

            </div>

          ) : filteredTasks.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                ✓
              </div>

              <h3>
                {tasks.length === 0
                  ? "No tasks yet"
                  : "No tasks found"}
              </h3>

              <p>
                {tasks.length === 0
                  ? "Create your first task to get started."
                  : "Try changing your search, filters, or sort options."}
              </p>

              {tasks.length === 0 && (
                <button
                  className="add-button"
                  onClick={openAddModal}
                >
                  + Create Task
                </button>
              )}

              {tasks.length > 0 &&
                filteredTasks.length === 0 && (
                  <button
                    type="button"
                    className="add-button"
                    onClick={() => {
                      setSearchQuery("");
                      setFilter("all");
                      setPriorityFilter("all");
                      setSortBy("newest");
                    }}
                  >
                    Clear Filters
                  </button>
                )}

            </div>

          ) : (

            <div className="task-list">

              {filteredTasks.map(
                (task) => (

                  <article
                    className="task-card"
                    key={task.id}
                  >

                    <div className="task-content">

                      <div className="task-title-row">

                        <div className="task-heading">

                          <h3>
                            {task.title}
                          </h3>

                          <span
                            className={`priority-badge ${task.priority}`}
                          >
                            {getPriorityLabel(
                              task.priority
                            )}
                          </span>

                        </div>

                      </div>

                      {task.description && (
                        <p className="task-description">
                          {task.description}
                        </p>
                      )}

                      <div className="task-meta">

                        <select
                          className={`status-select ${task.status}`}
                          value={task.status}
                          onChange={(event) =>
                            changeTaskStatus(
                              task,
                              event.target.value as Status
                            )
                          }
                        >
                          <option value="pending">
                            To Do
                          </option>

                          <option value="in_progress">
                            In Progress
                          </option>

                          <option value="completed">
                            Completed
                          </option>
                        </select>

                        <span className="task-date">
                          Created{" "}
                          {new Date(
                            task.created_at
                          ).toLocaleDateString()}
                        </span>

                      </div>

                    </div>

                    {/* ==================================================
                        TASK ACTIONS
                    ================================================== */}

                    <div className="task-actions">

                      <div className="task-ai-actions">

                        <button
                          className="ai-priority-button"
                          onClick={() =>
                            openPriorityModal(task)
                          }
                          disabled={
                            priorityLoading &&
                            priorityTask?.id === task.id
                          }
                        >
                          ✨ AI Priority
                        </button>

                        <button
                          className="breakdown-button"
                          onClick={() =>
                            openBreakdownModal(task)
                          }
                        >
                          ✨ Break Down
                        </button>

                      </div>

                      <div className="task-standard-actions">

                        <button
                          className="edit-button"
                          onClick={() =>
                            openEditModal(task)
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteTask(task)
                          }
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

      </main>

      {/* ========================================================
          AI PRODUCTIVITY INSIGHTS MODAL
      ======================================================== */}

      {showInsightsModal && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeInsightsModal();
            }
          }}
        >

          <div className="modal insights-modal">

            <div className="modal-header">
              <div>
                <h2>
                  ✨ AI Productivity Insights
                </h2>

                <p>
                  Understand your workload and decide what to focus on next.
                </p>
              </div>

              <button
                className="close-button"
                onClick={closeInsightsModal}
                disabled={insightsLoading}
              >
                ×
              </button>
            </div>

            {insightsLoading ? (

              <div className="ai-loading-state">
                <div className="spinner"></div>

                <h3>
                  AI is analyzing your productivity...
                </h3>

                <p>
                  Llama is reviewing your task workload and completion patterns.
                </p>
              </div>

            ) : insightsError ? (

              <div className="ai-breakdown-error">
                {insightsError}
              </div>

            ) : productivityInsights ? (

              <>
                <div className="insights-content">

                  <div className="insights-summary-card">
                    <div className="insights-icon">✨</div>

                    <div>
                      <span>AI SUMMARY</span>
                      <p>{productivityInsights.summary}</p>
                    </div>
                  </div>

                  <div className="insights-focus-card">
                    <div>
                      <span>RECOMMENDED FOCUS</span>
                      <h3>{productivityInsights.focus}</h3>
                    </div>
                  </div>

                  <div className="insights-metrics">
                    <div className="insight-metric">
                      <span>Completion</span>
                      <strong>
                        {productivityInsights.metrics.completion_rate}%
                      </strong>
                    </div>

                    <div className="insight-metric">
                      <span>Total Tasks</span>
                      <strong>
                        {productivityInsights.metrics.total_tasks}
                      </strong>
                    </div>

                    <div className="insight-metric">
                      <span>High Priority</span>
                      <strong>
                        {productivityInsights.metrics.high_priority_tasks}
                      </strong>
                    </div>

                    <div className="insight-metric">
                      <span>In Progress</span>
                      <strong>
                        {productivityInsights.metrics.in_progress_tasks}
                      </strong>
                    </div>
                  </div>

                  <div className="insight-columns">
                    <div className="insight-list-card">
                      <div className="insight-list-title">
                        <span>WHAT'S GOING WELL</span>
                      </div>

                      <ul>
                        {productivityInsights.strengths.map(
                          (item, index) => (
                            <li key={`${item}-${index}`}>
                              <span className="insight-check">✓</span>
                              <span>{item}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div className="insight-list-card">
                      <div className="insight-list-title">
                        <span>NEXT STEPS</span>
                      </div>

                      <ul>
                        {productivityInsights.suggestions.map(
                          (item, index) => (
                            <li key={`${item}-${index}`}>
                              <span className="insight-arrow">→</span>
                              <span>{item}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>

                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={closeInsightsModal}
                  >
                    Close
                  </button>
                </div>
              </>

            ) : null}

          </div>

        </div>
      )}

      {/* ========================================================
          NORMAL CREATE / EDIT MODAL
      ======================================================== */}

      {showModal && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }

          }}
        >

          <div className="modal">

            <div className="modal-header">

              <div>

                <h2>
                  {editingTask
                    ? "Edit Task"
                    : "Create Task"}
                </h2>

                <p>
                  {editingTask
                    ? "Update your task details."
                    : "Add a new task to your workflow."}
                </p>

              </div>

              <button
                className="close-button"
                onClick={closeModal}
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
            >

              <div className="form-group">

                <label htmlFor="title">
                  Task title
                </label>

                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Complete frontend"
                  value={form.title}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value
                    )
                  }
                  maxLength={200}
                  required
                />

              </div>

              <div className="form-group">

                <label htmlFor="description">
                  Description
                </label>

                <textarea
                  id="description"
                  placeholder="Describe the task..."
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value
                    )
                  }
                  maxLength={2000}
                  rows={4}
                />

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label htmlFor="status">
                    Status
                  </label>

                  <select
                    id="status"
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                  >

                    <option value="pending">
                      To Do
                    </option>

                    <option value="in_progress">
                      In Progress
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                  </select>

                </div>

                <div className="form-group">

                  <label htmlFor="priority">
                    Priority
                  </label>

                  <select
                    id="priority"
                    value={form.priority}
                    onChange={(event) =>
                      updateForm(
                        "priority",
                        event.target.value
                      )
                    }
                  >

                    <option value="low">
                      Low
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="high">
                      High
                    </option>

                  </select>

                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={
                    saving ||
                    !form.title.trim()
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingTask
                    ? "Save Changes"
                    : "Create Task"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ========================================================
          AI CREATE TASK MODAL
      ======================================================== */}

      {showAIModal && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeAIModal();
            }

          }}
        >

          <div className="modal ai-modal">

            <div className="modal-header">

              <div>

                <h2>
                  ✨ Create with AI
                </h2>

                <p>
                  Describe what you need to do in
                  natural language.
                </p>

              </div>

              <button
                className="close-button"
                onClick={closeAIModal}
              >
                ×
              </button>

            </div>

            <div className="ai-content">

              <div className="ai-info-card">

                <div className="ai-info-icon">
                  ✨
                </div>

                <div>

                  <strong>
                    Let AI organize your task
                  </strong>

                  <p>
                    Include deadlines, urgency,
                    or priority if relevant.
                  </p>

                </div>

              </div>

              <div className="form-group">

                <label htmlFor="ai-task">
                  What do you need to do?
                </label>

                <textarea
                  id="ai-task"
                  placeholder="e.g. Finish my project by Friday and make it high priority"
                  value={aiText}
                  onChange={(event) =>
                    setAIText(
                      event.target.value
                    )
                  }
                  maxLength={1000}
                  rows={5}
                />

                <div className="character-count">
                  {aiText.length}/1000
                </div>

              </div>

              {aiError && (

                <div className="ai-error">
                  {aiError}
                </div>

              )}

              <div className="ai-examples">

                <span>Try:</span>

                <button
                  type="button"
                  onClick={() =>
                    setAIText(
                      "Finish my internship CV by tomorrow"
                    )
                  }
                >
                  Internship CV by tomorrow
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setAIText(
                      "Study Python this evening"
                    )
                  }
                >
                  Study Python this evening
                </button>

              </div>

            </div>

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={closeAIModal}
                disabled={aiLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ai-generate-button"
                onClick={generateAITask}
                disabled={
                  aiLoading ||
                  !aiText.trim()
                }
              >
                {aiLoading
                  ? "✨ Generating..."
                  : "✨ Generate Task"}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ========================================================
          AI BREAKDOWN MODAL
      ======================================================== */}

      {showBreakdownModal && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeBreakdownModal();
            }

          }}
        >

          <div className="modal breakdown-modal">

            <div className="modal-header">

              <div>

                <h2>
                  ✨ AI Task Breakdown
                </h2>

                <p>
                  Turn a complex task into
                  actionable subtasks.
                </p>

              </div>

              <button
                className="close-button"
                onClick={
                  closeBreakdownModal
                }
              >
                ×
              </button>

            </div>

            {breakdownLoading ? (

              <div className="ai-loading-state">

                <div className="spinner"></div>

                <h3>
                  AI is breaking down your task...
                </h3>

                <p>
                  Llama is generating actionable
                  subtasks.
                </p>

              </div>

            ) : breakdownError ? (

              <div className="ai-breakdown-error">
                {breakdownError}
              </div>

            ) : breakdownResult ? (

              <>

                <div className="breakdown-content">

                  <div className="breakdown-ai-card">

                    <div className="ai-info-icon">
                      ✨
                    </div>

                    <div>

                      <strong>
                        Breaking down:
                      </strong>

                      <p>
                        {breakdownTaskData?.title}
                      </p>

                    </div>

                  </div>

                  <div className="breakdown-main-card">

                    <div className="breakdown-main-header">

                      <span>
                        MAIN TASK
                      </span>

                      <strong>
                        {
                          breakdownResult
                            .subtasks
                            .length
                        }{" "}
                        SUBTASKS
                      </strong>

                    </div>

                    <h3>
                      {breakdownResult.title}
                    </h3>

                    <p>
                      Select the subtasks you
                      want to add to TaskFlow.
                    </p>

                  </div>

                  <div className="subtask-controls">

                    <button
                      type="button"
                      onClick={
                        selectAllSubtasks
                      }
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={
                        clearAllSubtasks
                      }
                    >
                      Clear All
                    </button>

                  </div>

                  <div className="subtask-list">

                    {breakdownResult.subtasks.map(
                      (subtask, index) => (

                        <label
                          className={`subtask-item ${
                            selectedSubtasks.includes(
                              subtask
                            )
                              ? "selected"
                              : ""
                          }`}
                          key={`${subtask}-${index}`}
                        >

                          <input
                            type="checkbox"
                            checked={selectedSubtasks.includes(
                              subtask
                            )}
                            onChange={() =>
                              toggleSubtask(
                                subtask
                              )
                            }
                          />

                          <span>
                            {subtask}
                          </span>

                        </label>

                      )
                    )}

                  </div>

                </div>

                <div className="modal-actions">

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={
                      closeBreakdownModal
                    }
                    disabled={
                      creatingSubtasks
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="create-subtasks-button"
                    onClick={
                      createSelectedSubtasks
                    }
                    disabled={
                      creatingSubtasks ||
                      selectedSubtasks.length ===
                        0
                    }
                  >
                    {creatingSubtasks
                      ? "Creating..."
                      : `✓ Create Selected Tasks${
                          selectedSubtasks.length > 0
                            ? ` (${selectedSubtasks.length})`
                            : ""
                        }`}
                  </button>

                </div>

              </>

            ) : null}

          </div>

        </div>

      )}

      {/* ========================================================
          AI PRIORITY MODAL
      ======================================================== */}

      {showPriorityModal && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closePriorityModal();
            }

          }}
        >

          <div className="modal priority-modal">

            <div className="modal-header">

              <div>

                <h2>
                  ✨ AI Priority Suggestion
                </h2>

                <p>
                  Let AI analyze the urgency
                  and importance of this task.
                </p>

              </div>

              <button
                className="close-button"
                onClick={
                  closePriorityModal
                }
              >
                ×
              </button>

            </div>

            {priorityLoading ? (

              <div className="ai-loading-state">

                <div className="spinner"></div>

                <h3>
                  AI is analyzing your task...
                </h3>

                <p>
                  Llama is evaluating urgency,
                  deadlines, and importance.
                </p>

              </div>

            ) : priorityError ? (

              <div className="ai-breakdown-error">
                {priorityError}
              </div>

            ) : prioritySuggestion &&
              priorityTask ? (

              <>

                <div className="priority-content">

                  {/* Task being analyzed */}

                  <div className="priority-task-card">

                    <span>
                      TASK
                    </span>

                    <h3>
                      {priorityTask.title}
                    </h3>

                    {priorityTask.description && (
                      <p>
                        {
                          priorityTask.description
                        }
                      </p>
                    )}

                  </div>

                  {/* AI suggestion */}

                  <div className="priority-suggestion-card">

                    <div className="priority-suggestion-header">

                      <div className="ai-info-icon">
                        ✨
                      </div>

                      <div>

                        <strong>
                          AI Suggested Priority
                        </strong>

                        <p>
                          Based on the task
                          details
                        </p>

                      </div>

                    </div>

                    <div
                      className={`ai-priority-value ${prioritySuggestion.priority}`}
                    >
                      {prioritySuggestion.priority.toUpperCase()}
                    </div>

                    <div className="priority-reason">

                      <span>
                        Why?
                      </span>

                      <p>
                        {
                          prioritySuggestion.reason
                        }
                      </p>

                    </div>

                    {prioritySuggestion.analysis && (
                      <div className="priority-analysis">

                        <div className="priority-analysis-header">
                          <div>
                            <span className="priority-analysis-label">
                              AI Analysis
                            </span>
                            <p>
                              Explainable scoring based on your task details
                            </p>
                          </div>
                        </div>

                        {[
                          {
                            label: "Urgency",
                            value: prioritySuggestion.analysis.urgency,
                          },
                          {
                            label: "Importance",
                            value: prioritySuggestion.analysis.importance,
                          },
                          {
                            label: "Deadline",
                            value: prioritySuggestion.analysis.deadline,
                          },
                          {
                            label: "Consequences",
                            value: prioritySuggestion.analysis.consequences,
                          },
                          {
                            label: "Blocking Impact",
                            value: prioritySuggestion.analysis.blocking_impact,
                          },
                        ].map((item) => (
                          <div
                            className="priority-score"
                            key={item.label}
                          >
                            <div className="priority-score-header">
                              <span>{item.label}</span>
                              <strong>{item.value}/10</strong>
                            </div>

                            <div className="priority-score-track">
                              <div
                                className="priority-score-fill"
                                style={{
                                  width: `${Math.min(
                                    10,
                                    Math.max(0, item.value)
                                  ) * 10}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}

                      </div>
                    )}

                  </div>

                  {/* Current priority */}

                  <div className="current-priority">

                    <span>
                      Current priority
                    </span>

                    <strong
                      className={`current-priority-value ${priorityTask.priority}`}
                    >
                      {priorityTask.priority.toUpperCase()}
                    </strong>

                  </div>

                </div>

                <div className="modal-actions">

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={
                      closePriorityModal
                    }
                    disabled={
                      applyingPriority
                    }
                  >
                    Keep Current
                  </button>

                  <button
                    type="button"
                    className="apply-priority-button"
                    onClick={
                      applySuggestedPriority
                    }
                    disabled={
                      applyingPriority ||
                      prioritySuggestion.priority ===
                        priorityTask.priority
                    }
                  >
                    {applyingPriority
                      ? "Applying..."
                      : `Apply ${prioritySuggestion.priority.toUpperCase()}`}
                  </button>

                </div>

              </>

            ) : null}

          </div>

        </div>

      )}

    </div>
  );
}

export default App;