// PDFShift PDF generation service
import { supabase } from "@/integrations/supabase/client";
import { generateReportHTML, ReportData } from './templates/report';
import { generateProposalHTML, ProposalData } from './templates/proposal';
import { generateSandboxHTML, SandboxData } from './templates/sandbox';

export { generateReportHTML, generateProposalHTML, generateSandboxHTML };
export type { ReportData, ProposalData, SandboxData };

interface PDFOptions {
  landscape?: boolean;
  format?: string;
  margin?: string;
}

interface GeneratePDFResult {
  success: boolean;
  error?: string;
}

async function generateAndDownloadPDF(
  type: 'report' | 'proposal' | 'sandbox',
  html: string,
  filename: string,
  options: PDFOptions = {}
): Promise<GeneratePDFResult> {
  try {
    console.log(`Generating ${type} PDF via PDFShift...`);

    const { data, error } = await supabase.functions.invoke('generate-pdf', {
      body: {
        type,
        html,
        filename,
        options,
      },
    });

    if (error) {
      console.error('PDF generation error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      console.error('PDF generation failed:', data.error);
      return { success: false, error: data.error };
    }

    // Convert base64 to blob and download
    const byteCharacters = atob(data.pdf);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`PDF downloaded: ${filename} (${(data.size / 1024).toFixed(1)} KB)`);
    return { success: true };
  } catch (error) {
    console.error('PDF generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Generate and download a professional report PDF
 */
export async function generateReportPDF(data: ReportData): Promise<GeneratePDFResult> {
  const html = generateReportHTML(data);
  const filename = `${data.reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
  return generateAndDownloadPDF('report', html, filename);
}

/**
 * Generate and download a proposal PDF
 */
export async function generateProposalPDF(data: ProposalData): Promise<GeneratePDFResult> {
  const html = generateProposalHTML(data);
  const projectName = data.project?.name || 'Proposal';
  const version = data.proposal?.version || 1;
  const filename = `${projectName.replace(/\s+/g, "_")}_v${version}.pdf`;
  return generateAndDownloadPDF('proposal', html, filename);
}

/**
 * Generate and download a sandbox draft report PDF
 */
export async function generateSandboxPDF(data: SandboxData): Promise<GeneratePDFResult> {
  const html = generateSandboxHTML(data);
  const filename = `${data.sandboxName.replace(/\s+/g, "_")}_DRAFT_Report.pdf`;
  return generateAndDownloadPDF('sandbox', html, filename);
}
