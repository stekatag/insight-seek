"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDropzone } from "react-dropzone";
import { useState } from "react";
import { uploadFile } from "@/lib/firebase";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css"; // Make sure to import the styles
import { Presentation, Upload, MoveUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";

export default function MeetingCard() {
  const { project } = useProject();
  const processMeeting = useMutation({
    mutationFn: async (data: {
      meetingUrl: string;
      meetingId: string;
      projectId: string;
    }) => {
      const { meetingUrl, meetingId, projectId } = data;
      const response = await axios.post("/api/process-meeting", {
        audio_url: meetingUrl,
        meetingId,
        projectId,
      });
      return response.data;
    },
  });

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const uploadMeeting = api.project.uploadMeeting.useMutation();
  const router = useRouter();

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a"],
    },
    multiple: false,
    maxSize: 50_000_000,
    noClick: true, // Prevent opening the file dialog when clicking the dropzone area
    onDrop: async (acceptedFiles) => {
      if (!project) return;
      setIsUploading(true);

      const file = acceptedFiles[0];
      if (!file) return;

      const downloadURL = (await uploadFile(
        file as File,
        setProgress,
      )) as string;

      uploadMeeting.mutate(
        {
          projectId: project.id,
          meetingUrl: downloadURL,
          name: file.name,
        },
        {
          onSuccess: (meeting) => {
            toast.success("Meeting uploaded successfully!");
            router.push("/meetings");
            processMeeting.mutateAsync({
              meetingUrl: downloadURL,
              meetingId: meeting.id,
              projectId: project.id,
            });
          },
          onError: (error) => {
            toast.error("Failed to upload meeting");
            console.error(error);
          },
        },
      );

      setIsUploading(false);
    },
  });

  return (
    <Card
      className={cn(
        "col-span-2 h-full overflow-hidden transition-all duration-200",
        isDragActive && "border-primary ring-2 ring-primary ring-opacity-50",
        !project && "border-dashed",
      )}
    >
      <div
        className="flex h-full flex-col items-center justify-center p-6 text-center"
        {...getRootProps({ onClick: (e) => e.stopPropagation() })} // Keep dragActive functionality, but prevent click from opening file dialog
      >
        <input {...getInputProps()} />

        {!isUploading ? (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Presentation className="h-7 w-7 text-primary" />
            </div>

            <CardTitle className="mb-2 text-lg font-semibold">
              Create a new meeting
            </CardTitle>

            <CardDescription className="mb-6 max-w-xs">
              Upload your audio recordings and get AI-powered insights and
              summaries from your meetings.
            </CardDescription>

            <Button
              size="lg"
              className="group relative overflow-hidden"
              disabled={isUploading}
              onClick={(e) => {
                e.stopPropagation();
                open(); // Manually open the file dialog when the button is clicked
              }}
            >
              <Upload className="h-4 w-4" />
              <span>Upload Meeting</span>
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">
              Supported formats: .mp3, .wav, .m4a (max 50MB)
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center py-8">
            <div className="relative mb-5 h-28 w-28">
              <CircularProgressbar
                value={progress}
                strokeWidth={8}
                styles={buildStyles({
                  pathColor: "hsl(var(--primary))",
                  trailColor: "hsl(var(--muted))",
                  strokeLinecap: "round",
                  textSize: "16px",
                  textColor: "hsl(var(--foreground))",
                })}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-medium">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            <h3 className="mb-2 text-base font-medium">
              Processing your meeting
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Your audio is being uploaded and analyzed. This might take a few
              minutes depending on file size.
            </p>

            {progress === 100 && (
              <div className="mt-4 flex items-center text-sm text-primary">
                <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-primary"></span>
                Finalizing...
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
