import { GanttTask, GanttMilestone } from '@/types/gantt';
import { format, parseISO } from 'date-fns';

/**
 * Generate an ICS (iCalendar) file content from tasks and milestones
 */
export function generateICS(
  tasks: GanttTask[],
  milestones: GanttMilestone[],
  projectName: string
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Solar Pro//Gantt Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(projectName)} Schedule`,
  ];

  // Add tasks as events
  for (const task of tasks) {
    const uid = `task-${task.id}@solarpro`;
    const startDate = formatICSDate(task.start_date);
    const endDate = formatICSDate(task.end_date, true); // End date is exclusive in ICS

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDateTime(new Date())}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${escapeICS(task.name)}`,
      task.description ? `DESCRIPTION:${escapeICS(task.description)}` : '',
      task.owner ? `ORGANIZER;CN=${escapeICS(task.owner)}:mailto:${task.owner.toLowerCase().replace(/\s/g, '')}@example.com` : '',
      `STATUS:${task.status === 'completed' ? 'COMPLETED' : task.status === 'in_progress' ? 'IN-PROCESS' : 'NEEDS-ACTION'}`,
      `X-PROGRESS:${task.progress}`,
      'END:VEVENT'
    );
  }

  // Add milestones as all-day events
  for (const milestone of milestones) {
    const uid = `milestone-${milestone.id}@solarpro`;
    const date = formatICSDate(milestone.date);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDateTime(new Date())}`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:🎯 ${escapeICS(milestone.name)}`,
      milestone.description ? `DESCRIPTION:${escapeICS(milestone.description)}` : '',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  return lines.filter(Boolean).join('\r\n');
}

/**
 * Format a date string for ICS (YYYYMMDD)
 */
function formatICSDate(dateStr: string, addDay = false): string {
  const date = parseISO(dateStr);
  if (addDay) {
    date.setDate(date.getDate() + 1);
  }
  return format(date, 'yyyyMMdd');
}

/**
 * Format a Date for ICS timestamp
 */
function formatICSDateTime(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Download the ICS file
 */
export function downloadICS(
  tasks: GanttTask[],
  milestones: GanttMilestone[],
  projectName: string
): void {
  const content = generateICS(tasks, milestones, projectName);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/[^a-z0-9]/gi, '-')}-schedule.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
