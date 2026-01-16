import { AppLayout } from "@/components/layout/AppLayout";
import { CodeReviewPanel } from "@/components/code-review/CodeReviewPanel";

export default function CodeReview() {
  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <CodeReviewPanel />
      </div>
    </AppLayout>
  );
}
