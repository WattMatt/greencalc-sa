import * as XLSX from 'xlsx';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { GanttTask, GanttMilestone, GanttTaskDependency } from '@/types/gantt';
import { format, parseISO, differenceInDays } from 'date-fns';

// Excel Export
export function exportToExcel(
  tasks: GanttTask[],
  milestones: GanttMilestone[],
  dependencies: GanttTaskDependency[],
  projectName: string
) {
  const workbook = XLSX.utils.book_new();

  // Tasks sheet
  const taskData = tasks.map((task, index) => ({
    '#': index + 1,
    'Task Name': task.name,
    'Description': task.description || '',
    'Start Date': format(parseISO(task.start_date), 'yyyy-MM-dd'),
    'End Date': format(parseISO(task.end_date), 'yyyy-MM-dd'),
    'Duration (Days)': differenceInDays(parseISO(task.end_date), parseISO(task.start_date)) + 1,
    'Status': task.status.replace('_', ' '),
    'Progress (%)': task.progress,
    'Owner': task.owner || '',
    'Color': task.color || '',
  }));

  const tasksSheet = XLSX.utils.json_to_sheet(taskData);
  XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Tasks');

  // Milestones sheet
  if (milestones.length > 0) {
    const milestoneData = milestones.map((m, index) => ({
      '#': index + 1,
      'Milestone Name': m.name,
      'Date': format(parseISO(m.date), 'yyyy-MM-dd'),
      'Description': m.description || '',
    }));

    const milestonesSheet = XLSX.utils.json_to_sheet(milestoneData);
    XLSX.utils.book_append_sheet(workbook, milestonesSheet, 'Milestones');
  }

  // Dependencies sheet
  if (dependencies.length > 0) {
    const taskMap = new Map(tasks.map(t => [t.id, t.name]));
    const dependencyData = dependencies.map((dep, index) => ({
      '#': index + 1,
      'Predecessor': taskMap.get(dep.predecessor_id) || dep.predecessor_id,
      'Successor': taskMap.get(dep.successor_id) || dep.successor_id,
      'Type': dep.dependency_type.replace(/_/g, ' '),
    }));

    const dependenciesSheet = XLSX.utils.json_to_sheet(dependencyData);
    XLSX.utils.book_append_sheet(workbook, dependenciesSheet, 'Dependencies');
  }

  // Download
  const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_schedule.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// Image Export (PNG/JPEG)
export async function exportToImage(
  elementId: string,
  format: 'png' | 'jpeg',
  projectName: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Chart element not found');
  }

  const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_schedule.${format}`;
  
  let dataUrl: string;
  if (format === 'png') {
    dataUrl = await toPng(element, { 
      backgroundColor: '#ffffff',
      pixelRatio: 2,
    });
  } else {
    dataUrl = await toJpeg(element, { 
      backgroundColor: '#ffffff',
      quality: 0.95,
      pixelRatio: 2,
    });
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

// PDF Export
export async function exportToPDF(
  elementId: string,
  projectName: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Chart element not found');
  }

  // Capture as image first
  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
  });

  // Create PDF
  const img = new Image();
  img.src = dataUrl;
  
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  // Calculate dimensions (A4 landscape)
  const pdfWidth = 297; // mm
  const pdfHeight = 210; // mm
  
  const imgAspect = img.width / img.height;
  const pageAspect = pdfWidth / pdfHeight;
  
  let width: number, height: number, x: number, y: number;
  
  if (imgAspect > pageAspect) {
    // Image is wider
    width = pdfWidth - 20; // 10mm margin each side
    height = width / imgAspect;
    x = 10;
    y = (pdfHeight - height) / 2;
  } else {
    // Image is taller
    height = pdfHeight - 20;
    width = height * imgAspect;
    x = (pdfWidth - width) / 2;
    y = 10;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Add title
  pdf.setFontSize(16);
  pdf.text(`${projectName} - Project Schedule`, 10, 15);
  pdf.setFontSize(10);
  pdf.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 10, 22);

  // Add chart image
  pdf.addImage(dataUrl, 'PNG', x, y + 15, width, height - 15);

  // Download
  const filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_schedule.pdf`;
  pdf.save(filename);
}

// Word Export (HTML format that Word can open)
export function exportToWord(
  tasks: GanttTask[],
  milestones: GanttMilestone[],
  projectName: string
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${projectName} - Project Schedule</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .status-completed { color: #22c55e; }
        .status-in_progress { color: #3b82f6; }
        .status-not_started { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h1>${projectName}</h1>
      <p>Project Schedule Report - Generated ${format(new Date(), 'MMMM d, yyyy')}</p>
      
      <h2>Tasks</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Task Name</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map((task, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${task.name}</td>
              <td>${format(parseISO(task.start_date), 'MMM d, yyyy')}</td>
              <td>${format(parseISO(task.end_date), 'MMM d, yyyy')}</td>
              <td class="status-${task.status}">${task.status.replace('_', ' ')}</td>
              <td>${task.progress}%</td>
              <td>${task.owner || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${milestones.length > 0 ? `
        <h2>Milestones</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>Date</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${milestones.map((m, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${m.name}</td>
                <td>${format(parseISO(m.date), 'MMM d, yyyy')}</td>
                <td>${m.description || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_schedule.doc`;
  link.click();
  URL.revokeObjectURL(url);
}
