import IssuesList from "./issues-list";

type Props = {
  params: Promise<{ meetingId: string }>;
};

export default async function MeetingDetailsPage({ params }: Props) {
  const { meetingId } = await params;

  return <IssuesList meetingId={meetingId} />;
}
