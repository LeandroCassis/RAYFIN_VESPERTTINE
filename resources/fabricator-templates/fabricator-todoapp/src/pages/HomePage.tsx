import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import {
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
  type TodoItem,
} from '@/services/todos';

export function HomePage() {
  const { signOut, user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTodos = useCallback(async () => {
    const data = await getTodos();
    setTodos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodoTitle.trim();
    if (!title) return;
    setNewTodoTitle('');
    await createTodo(title);
    await fetchTodos();
  };

  const handleToggle = async (id: string, isCompleted: boolean) => {
    await updateTodo(id, { isCompleted: !isCompleted });
    await fetchTodos();
  };

  const handleDelete = async (id: string) => {
    await deleteTodo(id);
    await fetchTodos();
  };

  const pending = todos.filter((t) => !t.isCompleted);
  const completed = todos.filter((t) => t.isCompleted);
  const progress = todos.length
    ? Math.round((completed.length / todos.length) * 100)
    : 0;
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <CheckIcon className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">Todo</span>
          </div>
          <div className="flex items-center gap-3">
            {user?.email && (
              <span
                className="hidden text-sm text-slate-500 sm:inline"
                title={user.email}
              >
                {user.email}
              </span>
            )}
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
              title={user?.email}
            >
              {initial}
            </span>
            <button
              onClick={() => void signOut()}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Your tasks</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todos.length === 0
              ? 'Add your first task to get started.'
              : `${completed.length} of ${todos.length} done`}
          </p>
          {todos.length > 0 && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => void handleAddTodo(e)}
          className="mb-8 flex gap-2.5"
        >
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            type="submit"
            disabled={!newTodoTitle.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
          </button>
        </form>

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[58px] animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : todos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {pending.length > 0 && (
              <TodoSection
                label="To do"
                count={pending.length}
                todos={pending}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            )}
            {completed.length > 0 && (
              <TodoSection
                label="Completed"
                count={completed.length}
                todos={completed}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

type RowHandlers = {
  onToggle: (id: string, isCompleted: boolean) => void;
  onDelete: (id: string) => void;
};

function TodoSection({
  label,
  count,
  todos,
  onToggle,
  onDelete,
}: RowHandlers & { label: string; count: number; todos: TodoItem[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          {count}
        </span>
      </h2>
      <ul className="space-y-2">
        {todos.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: RowHandlers & { todo: TodoItem }) {
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
      <button
        onClick={() => onToggle(todo.id, todo.isCompleted)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          todo.isCompleted
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-slate-300 hover:border-indigo-500'
        }`}
        aria-label={todo.isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.isCompleted && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span
        className={`flex-1 text-sm ${
          todo.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
        }`}
      >
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="rounded-md p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
        aria-label="Delete todo"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">
        Nothing here yet
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Add your first task above to get started.
      </p>
    </div>
  );
}

function CheckIcon({
  className,
  strokeWidth = 2.5,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={strokeWidth}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
