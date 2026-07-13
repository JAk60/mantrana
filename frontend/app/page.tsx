import GridMap from "@/components/atlasMap";


export default function Page() {
  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <GridMap initialCenter={[77.0, 16.5]} initialZoom={4.2} showGrid />
    </main>
  );
}