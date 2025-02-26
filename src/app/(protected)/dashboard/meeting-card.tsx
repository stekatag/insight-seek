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
import { Presentation, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

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
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a"],
    },
    multiple: false,
    maxSize: 50_000_000,
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
      className="col-span-2 flex flex-col items-center justify-center"
      {...getRootProps()}
    >
      {!isUploading && (
        <>
          <CardHeader>
            <Presentation className="h-10 w-10 animate-bounce" />
            <CardTitle className="mt-2 text-sm font-semibold text-gray-900">
              Create a new meeting
            </CardTitle>
            <CardDescription>
              Analyze your meeting with InsightSeek.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled={isUploading}>
              <Upload className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              Upload Meeting
              <input className="hidden" {...getInputProps()} />
            </Button>
          </CardContent>
        </>
      )}

      {isUploading && (
        <div>
          <CircularProgressbar
            value={progress}
            text={`${Math.round(progress)}%`}
            className="size-20"
            styles={buildStyles({
              pathColor: "#2563eb",
              textColor: "#2563eb",
            })}
          />
          <p className="mt-3 text-center text-xs text-gray-500">
            Uploading and processing meeting... <br />
            This may take a few minutes...
          </p>
        </div>
      )}
    </Card>
  );
}
