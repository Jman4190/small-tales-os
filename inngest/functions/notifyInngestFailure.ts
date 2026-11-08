import { inngest } from "../client";
import { notifyInngestFailure } from "@/lib/slack";

export const notifyInngestFailureTrigger = inngest.createFunction(
  { id: "notify-inngest-failure" },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const { function_id, function_name, run_id, error } = event.data as any;

    if (function_id === "notify-inngest-failure" || function_name === "notify-inngest-failure") {
      return { notified: false };
    }

    let errorMessage: string;
    if (typeof error === "string") {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    } else {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    }

    await step.run("Send Slack notification", async () => {
      await notifyInngestFailure({
        functionId: function_id,
        functionName: function_name,
        runId: run_id,
        error: errorMessage,
      });
    });

    return { notified: true };
  }
);

