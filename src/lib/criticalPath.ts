import { GanttTask, GanttTaskDependency } from '@/types/gantt';
import { differenceInDays, parseISO } from 'date-fns';

interface TaskNode {
  id: string;
  duration: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  predecessors: string[];
  successors: string[];
}

/**
 * Calculate the critical path for a set of tasks and dependencies
 * Returns the IDs of tasks that are on the critical path
 */
export function calculateCriticalPath(
  tasks: GanttTask[],
  dependencies: GanttTaskDependency[]
): string[] {
  if (tasks.length === 0) return [];

  // Build task nodes with duration and relationships
  const nodes = new Map<string, TaskNode>();
  
  for (const task of tasks) {
    const start = parseISO(task.start_date);
    const end = parseISO(task.end_date);
    const duration = differenceInDays(end, start) + 1; // Include both start and end days

    nodes.set(task.id, {
      id: task.id,
      duration: Math.max(1, duration),
      earlyStart: 0,
      earlyFinish: 0,
      lateStart: Infinity,
      lateFinish: Infinity,
      slack: 0,
      predecessors: [],
      successors: [],
    });
  }

  // Build predecessor/successor relationships (only finish-to-start for now)
  for (const dep of dependencies) {
    const predecessor = nodes.get(dep.predecessor_id);
    const successor = nodes.get(dep.successor_id);
    
    if (predecessor && successor) {
      predecessor.successors.push(dep.successor_id);
      successor.predecessors.push(dep.predecessor_id);
    }
  }

  // Topological sort for forward pass
  const sorted = topologicalSort(nodes);
  if (!sorted) {
    // Cycle detected, can't compute critical path
    return [];
  }

  // Forward pass - calculate early start and early finish
  for (const nodeId of sorted) {
    const node = nodes.get(nodeId)!;
    
    if (node.predecessors.length === 0) {
      node.earlyStart = 0;
    } else {
      node.earlyStart = Math.max(
        ...node.predecessors.map((predId) => nodes.get(predId)!.earlyFinish)
      );
    }
    node.earlyFinish = node.earlyStart + node.duration;
  }

  // Find project end time
  const projectEnd = Math.max(...Array.from(nodes.values()).map((n) => n.earlyFinish));

  // Backward pass - calculate late start and late finish
  for (let i = sorted.length - 1; i >= 0; i--) {
    const node = nodes.get(sorted[i])!;
    
    if (node.successors.length === 0) {
      node.lateFinish = projectEnd;
    } else {
      node.lateFinish = Math.min(
        ...node.successors.map((succId) => nodes.get(succId)!.lateStart)
      );
    }
    node.lateStart = node.lateFinish - node.duration;
    node.slack = node.lateStart - node.earlyStart;
  }

  // Critical path consists of tasks with zero slack
  const criticalPath = Array.from(nodes.values())
    .filter((node) => Math.abs(node.slack) < 0.001) // Float tolerance
    .map((node) => node.id);

  return criticalPath;
}

/**
 * Perform topological sort using Kahn's algorithm
 * Returns null if a cycle is detected
 */
function topologicalSort(nodes: Map<string, TaskNode>): string[] | null {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const result: string[] = [];

  // Initialize in-degrees
  for (const [id, node] of nodes) {
    inDegree.set(id, node.predecessors.length);
    if (node.predecessors.length === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    const node = nodes.get(nodeId)!;
    for (const successorId of node.successors) {
      const newInDegree = (inDegree.get(successorId) || 0) - 1;
      inDegree.set(successorId, newInDegree);
      
      if (newInDegree === 0) {
        queue.push(successorId);
      }
    }
  }

  // If result doesn't include all nodes, there's a cycle
  if (result.length !== nodes.size) {
    return null;
  }

  return result;
}

/**
 * Get statistics about the project schedule
 */
export function getScheduleStats(tasks: GanttTask[], dependencies: GanttTaskDependency[]) {
  if (tasks.length === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      notStartedTasks: 0,
      criticalPathLength: 0,
      criticalTaskCount: 0,
      projectDuration: 0,
      averageProgress: 0,
    };
  }

  const criticalPath = calculateCriticalPath(tasks, dependencies);
  
  // Calculate project duration from earliest start to latest end
  const dates = tasks.flatMap((t) => [parseISO(t.start_date), parseISO(t.end_date)]);
  const earliestStart = new Date(Math.min(...dates.map((d) => d.getTime())));
  const latestEnd = new Date(Math.max(...dates.map((d) => d.getTime())));
  const projectDuration = differenceInDays(latestEnd, earliestStart) + 1;

  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const notStartedTasks = tasks.filter((t) => t.status === 'not_started').length;
  const averageProgress = tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length;

  return {
    totalTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    notStartedTasks,
    criticalPathLength: criticalPath.length,
    criticalTaskCount: criticalPath.length,
    projectDuration,
    averageProgress: Math.round(averageProgress),
  };
}
