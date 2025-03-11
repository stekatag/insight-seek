"use client";

import { useRef, useState } from "react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import { useDropzone } from "react-dropzone";

import { uploadFile } from "@/lib/firebase";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

import "react-circular-progressbar/dist/styles.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  Check,
  Clock,
  CreditCard,
  Info,
  Presentation,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import {
  calculateMeetingCredits,
  formatMeetingDuration,
  getDurationMinutes,
} from "@/lib/credits";
import { cn } from "@/lib/utils";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Spinner } from "./ui/spinner";

export default function MeetingCard() {
  const { project } = useProject();
  const router = useRouter();

  const [isUploading, setIsUploading] = useState(false);
  const [showCreditCheck, setShowCreditCheck] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [fileUrl, setFileUrl] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refetch = useRefetch();

  const uploadMeeting = api.meeting.uploadMeeting.useMutation();
  const checkCredits = api.meeting.checkMeetingCredits.useMutation();

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

  const getDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration);
      });

      // Create object URL for the file
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;

      // Store refs for later cleanup
      audioRef.current = audio;
    });
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a"],
    },
    multiple: false,
    maxSize: 50_000_000, // 50MB max size
    noClick: true,
    onDrop: async (acceptedFiles) => {
      if (!project || acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setSelectedFile(file as File);

      try {
        // Get audio duration
        const duration = await getDuration(file as File);
        setAudioDuration(duration);

        // Calculate credits needed
        const durationMinutes = getDurationMinutes(duration);
        checkCredits.mutate(
          { durationMinutes },
          {
            onSuccess: (data) => {
              setShowCreditCheck(true);
            },
            onError: (error) => {
              toast.error("Failed to check credits required");
            },
          },
        );
      } catch (error) {
        toast.error("Failed to read audio file");
        console.error(error);
        setSelectedFile(null);
      }
    },
  });

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setAudioDuration(0);
    setShowCreditCheck(false);

    // Clean up audio element and object URL
    if (audioRef.current) {
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
  };

  const handleProcessUpload = async () => {
    if (!project || !selectedFile) return;

    setShowCreditCheck(false);
    setIsUploading(true);

    try {
      // Upload file to Firebase
      const downloadURL = (await uploadFile(
        selectedFile,
        setProgress,
      )) as string;
      setFileUrl(downloadURL);

      // Calculate credits to charge
      const durationMinutes = getDurationMinutes(audioDuration);
      const creditsToCharge = calculateMeetingCredits(durationMinutes);

      // Create meeting and charge credits
      uploadMeeting.mutate(
        {
          projectId: project.id,
          meetingUrl: downloadURL,
          name: selectedFile.name,
          durationMinutes,
          creditsToCharge,
        },
        {
          onSuccess: (meeting) => {
            toast.success("Meeting uploaded successfully!");

            // Process the meeting
            processMeeting
              .mutateAsync({
                meetingUrl: downloadURL,
                meetingId: meeting.id,
                projectId: project.id,
              })
              .then(() => {
                router.push("/meetings");
                // Refetch meetings data
                refetch();
              });
          },
          onError: (error) => {
            if (error.message.includes("Insufficient credits")) {
              toast.error("Not enough credits to upload this meeting");
            } else {
              toast.error("Failed to upload meeting");
            }
            console.error(error);
          },
          onSettled: () => {
            setIsUploading(false);
            setSelectedFile(null);
            setAudioDuration(0);
          },
        },
      );
    } catch (error) {
      toast.error("Failed to upload file");
      console.error(error);
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const durationMinutes = getDurationMinutes(audioDuration);
  const creditsNeeded = calculateMeetingCredits(durationMinutes);
  const hasEnoughCredits = checkCredits.data?.hasEnoughCredits ?? false;
  const creditsShortage = checkCredits.data
    ? Math.max(0, creditsNeeded - checkCredits.data.userCredits)
    : 0;

  return (
    <>
      <Card
        className={cn(
          "col-span-2 h-full overflow-hidden transition-all duration-200 border-primary/35 border-dashed border-2",
          isDragActive && "border-primary ring-2 ring-primary ring-opacity-50",
        )}
      >
        <div
          className="flex h-full flex-col items-center justify-center p-6 text-center"
          {...getRootProps({ onClick: (e) => e.stopPropagation() })}
        >
          <input {...getInputProps()} />

          {!isUploading ? (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Presentation className="h-7 w-7 text-primary" />
              </div>

              <CardTitle className="mb-2 text-lg font-semibold">
                Upload a new meeting
              </CardTitle>

              <CardDescription className="mb-6 max-w-xs">
                Upload your audio recordings and get AI-powered insights and
                summaries from your meetings.
              </CardDescription>

              <Button
                size="lg"
                disabled={!project}
                onClick={(e) => {
                  e.stopPropagation();
                  open();
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

      {/* Credit Check Dialog */}
      <Dialog
        open={showCreditCheck}
        onOpenChange={(open) => {
          if (!open) handleCancelUpload();
          setShowCreditCheck(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meeting Upload Credits</DialogTitle>
            <DialogDescription>
              Credits will be charged based on the meeting length
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Meeting Info */}
            <div className="flex items-center gap-x-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Presentation className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{selectedFile?.name}</p>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  <span>Duration: {formatMeetingDuration(audioDuration)}</span>
                </div>
              </div>
            </div>

            {/* Credits Required */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Credits Required</AlertTitle>
              <AlertDescription>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span>Meeting Duration:</span>
                    <span>{durationMinutes} minutes</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Credits Required:</span>
                    <span>{creditsNeeded} credits</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Available Credits:</span>
                    <span>
                      {checkCredits.data?.userCredits || "Loading..."}
                    </span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {checkCredits.data && !hasEnoughCredits && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Credits</AlertTitle>
                <AlertDescription>
                  You need {creditsShortage} more credits to upload this
                  meeting.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
            <DialogClose asChild>
              <Button
                className="mt-2 sm:mt-0"
                variant="outline"
                onClick={handleCancelUpload}
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            </DialogClose>

            <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
              {checkCredits.data && !hasEnoughCredits && (
                <Link href="/billing">
                  <Button>
                    <CreditCard className="h-4 w-4" />
                    <span>Buy Credits</span>
                  </Button>
                </Link>
              )}

              {hasEnoughCredits && (
                <Button
                  onClick={handleProcessUpload}
                  disabled={
                    !checkCredits.data ||
                    !hasEnoughCredits ||
                    uploadMeeting.isPending
                  }
                >
                  {uploadMeeting.isPending ? (
                    <Spinner size="small" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Confirm Upload
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
