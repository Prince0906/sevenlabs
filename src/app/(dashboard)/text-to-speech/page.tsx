import { Suspense } from "react";
import { TextToSpeechView } from "@/features/text-to-speech/views/text-to-speech-view";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function TextToSpeechPage() {
  return (
    <>
      <PageHeader title="Text to Speech" className="lg:hidden" />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-8">
            <Skeleton className="h-96 w-full max-w-5xl rounded-2xl" />
          </div>
        }
      >
        <TextToSpeechView />
      </Suspense>
    </>
  );
}
