export default function FieldDashboard() {
  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-4">Stone Henge Field</h1>
      <p className="text-zinc-400 mb-6">Field capture dashboard</p>

      <div className="grid gap-4">
        <div className="bg-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Today&apos;s Jobs</h2>
          <p className="text-zinc-400 text-sm">No jobs scheduled for today.</p>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Recent Captures</h2>
          <p className="text-zinc-400 text-sm">No recent captures.</p>
        </div>
      </div>
    </div>
  );
}
