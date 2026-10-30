import Placeholder from "@/components/Placeholder";

export default function Page({ params }: { params: { id: string } }) {
  return <Placeholder title="Project Detail" note={`Project ${params.id}: not built yet.`} />;
}
