"use client";

import useProject from "@/hooks/use-project";
import { api } from "@/trpc/react";
import Image from "next/image";

export default function TeamMembers() {
  const { projectId } = useProject();
  const { data: members } = api.project.getTeamMembers.useQuery({ projectId });

  return (
    <div className="flex items-center gap-2">
      {members?.map((member) => (
        <Image
          key={member.id}
          src={member.user.imageUrl || ""}
          alt={member.user.firstName ?? "User avatar"}
          width={30}
          height={30}
          className="rounded-full"
        />
      ))}
    </div>
  );
}
