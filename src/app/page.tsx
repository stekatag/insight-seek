import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Home() {
  return (
    <Button>
      <Link href="/dashboard">Dashboard</Link>
    </Button>
  );
}
