'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { MeasurementForm } from '@/components/field/MeasurementForm';

interface Measurement {
  id: string;
  room: string | null;
  piece: string | null;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  finishedEdges: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

interface FieldJob {
  id: string;
  projectName: string | null;
  jobNumber: string | null;
}

export default function MeasurementsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [job, setJob] = useState<FieldJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchMeasurements = useCallback(async () => {
    try {
      const response = await fetch(`/api/field/jobs/${jobId}/measurements`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setMeasurements(data.measurements);
      setJob(data.job);
    } catch {
      console.error('Failed to load measurements');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  function handleEdit(measurement: Measurement) {
    setEditingMeasurement(measurement);
    setShowForm(true);
  }

  function handleAdd() {
    setEditingMeasurement(null);
    setShowForm(true);
  }

  function handleFormSave() {
    setShowForm(false);
    setEditingMeasurement(null);
    fetchMeasurements();
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingMeasurement(null);
  }

  async function handleDelete(measurementId: string) {
    if (!confirm('Delete this measurement?')) return;

    setDeleting(measurementId);
    try {
      const response = await fetch(
        `/api/field/jobs/${jobId}/measurements/${measurementId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete');
      await fetchMeasurements();
    } catch {
      alert('Failed to delete measurement');
    } finally {
      setDeleting(null);
    }
  }

  function formatDimensions(m: Measurement) {
    return `${m.lengthMm} × ${m.widthMm} × ${m.thicknessMm}mm`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading measurements...</p>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">
            {editingMeasurement ? 'Edit Measurement' : 'Add Measurement'}
          </h1>
          {job?.projectName && (
            <p className="text-sm text-gray-500">{job.projectName}</p>
          )}
        </div>
        <MeasurementForm
          jobId={jobId}
          initialData={
            editingMeasurement
              ? {
                  id: editingMeasurement.id,
                  room: editingMeasurement.room ?? undefined,
                  piece: editingMeasurement.piece ?? undefined,
                  length: editingMeasurement.lengthMm,
                  width: editingMeasurement.widthMm,
                  thickness: editingMeasurement.thicknessMm,
                  finishedEdges: editingMeasurement.finishedEdges ?? undefined,
                  notes: editingMeasurement.notes ?? undefined,
                }
              : undefined
          }
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Measurements</h1>
          {job?.projectName && (
            <p className="text-sm text-gray-500">{job.projectName}</p>
          )}
        </div>
        <span className="text-sm text-gray-400">
          {measurements.length} {measurements.length === 1 ? 'piece' : 'pieces'}
        </span>
      </div>

      {/* Measurement list */}
      <div className="p-4 space-y-3">
        {measurements.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-3">📐</div>
            <p className="text-gray-500 mb-1">No measurements yet</p>
            <p className="text-gray-400 text-sm">
              Tap the button below to add your first measurement
            </p>
          </div>
        ) : (
          measurements.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => handleEdit(m)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {m.room && (
                        <span className="text-xs font-medium bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                          {m.room}
                        </span>
                      )}
                      {m.piece && (
                        <span className="text-sm font-medium text-gray-900">
                          {m.piece}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 font-mono">
                      {formatDimensions(m)}
                    </p>
                    {m.finishedEdges && (
                      <p className="text-xs text-gray-500 mt-1">
                        Edges: {m.finishedEdges}
                      </p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {m.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-300 ml-2">›</span>
                </div>
              </button>
              <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deleting === m.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {deleting === m.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add button */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4">
        <button
          type="button"
          onClick={handleAdd}
          className="bg-primary-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-primary-700 font-medium"
        >
          + Add Measurement
        </button>
      </div>
    </div>
  );
}
