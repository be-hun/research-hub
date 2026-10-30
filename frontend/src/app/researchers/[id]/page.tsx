import Placeholder from "@/components/Placeholder";

export default function Page({ params }: { params: { id: string } }) {
  return <Placeholder title="Researcher Profile" note={`Researcher ${params.id}: not built yet.`} />;
}
