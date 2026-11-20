import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/tasks/empty-state";
import { TaskItem } from "@/components/tasks/task-item";
import type {
  SubtaskInput,
  SubtaskUpdateInput,
  Task,
  TaskUpdateInput,
} from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  onToggleTask: (taskId: string, completed: boolean) => Promise<boolean>;
  onSaveTask: (taskId: string, input: TaskUpdateInput) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>;
  onAddSubtasks: (taskId: string, subtasks: SubtaskInput[]) => Promise<boolean>;
  onSaveSubtask: (
    taskId: string,
    subtaskId: string,
    input: SubtaskUpdateInput,
  ) => Promise<boolean>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<boolean>;
}

function TaskListSkeleton() {
  return (
    <div aria-label="Loading tasks" className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70"
        >
          <Skeleton className="size-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TaskList(props: TaskListProps) {
  if (props.loading) {
    return <TaskListSkeleton />;
  }
  if (props.tasks.length === 0) {
    return (
      <EmptyState
        hasFilters={props.hasFilters}
        onClearFilters={props.onClearFilters}
      />
    );
  }

  return (
    <ul className="space-y-3" aria-label="Tasks">
      {props.tasks.map((task) => (
        <li key={task.id}>
          <TaskItem
            task={task}
            onToggle={props.onToggleTask}
            onSave={props.onSaveTask}
            onDelete={props.onDeleteTask}
            onAddSubtasks={props.onAddSubtasks}
            onSaveSubtask={props.onSaveSubtask}
            onDeleteSubtask={props.onDeleteSubtask}
          />
        </li>
      ))}
    </ul>
  );
}
