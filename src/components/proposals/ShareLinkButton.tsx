import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Loader2, Link, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShareLinkButtonProps {
  proposalId: string;
  shareToken: string | null;
  status: string;
  projectName?: string;
  onTokenGenerated: (token: string) => void;
}

export function ShareLinkButton({
  proposalId,
  shareToken,
  status,
  projectName,
  onTokenGenerated
}: ShareLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clientEmail, setClientEmail] = useState("");

  const shareUrl = shareToken
    ? `${window.location.origin}/portal/${shareToken}`
    : null;

  const generateToken = async () => {
    setIsGenerating(true);
    try {
      // Generate a random token
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase
        .from("proposals")
        .update({ share_token: token })
        .eq("id", proposalId);

      if (error) throw error;

      onTokenGenerated(token);
      toast.success("Share link generated");
    } catch (error) {
      console.error("Error generating token:", error);
      toast.error("Failed to generate share link");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleGmailShare = () => {
    if (!shareUrl) return;

    const subject = encodeURIComponent(`Solar Proposal: ${projectName || 'New Proposal'}`);
    const body = encodeURIComponent(
      `Hi,\n\nPlease view your solar proposal here:\n${shareUrl}\n\nLet me know if you have any questions.\n\nBest regards,`
    );
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${clientEmail}&su=${subject}&body=${body}`;

    window.open(gmailUrl, '_blank');
  };

  const canShare = status === "approved" || status === "sent";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!canShare}>
          <Share2 className="mr-2 h-4 w-4" />
          Share with Client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Client Portal Link
          </DialogTitle>
          <DialogDescription>
            Share this link with your client so they can view and sign the proposal online.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {shareToken ? (
            <>
              <div className="flex gap-2">
                <Input
                  value={shareUrl || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={copyToClipboard} variant="outline" size="icon">
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Send via Gmail</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="client@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    type="email"
                  />
                  <Button onClick={handleGmailShare} variant="secondary">
                    <Mail className="mr-2 h-4 w-4" />
                    Open Gmail
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This link allows anyone with access to view and sign the proposal.
                Only share with intended recipients.
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Generate a unique link to share this proposal with your client.
              </p>
              <Button onClick={generateToken} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link className="mr-2 h-4 w-4" />
                )}
                Generate Share Link
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
