import React, { createContext, useContext, useState, useCallback } from 'react';

export type JobStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface PrepareResponse {
  jobId: string;
  status: string;
  url?: string;
  expiresAt?: string;
}

export interface StatusResponse {
  status: string;
  url?: string;
  expiresAt?: string;
  error?: string;
}

export interface DownloadJob {
  id: string;
  folderId: string;
  folderName: string;
  status: JobStatus;
  url?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  prepareFn: () => Promise<PrepareResponse>;
  statusFn: (jobId: string) => Promise<StatusResponse>;
}

interface DownloadsContextValue {
  jobs: DownloadJob[];
  addJob: (job: DownloadJob) => void;
  updateJob: (id: string, updates: Partial<Omit<DownloadJob, 'id' | 'prepareFn' | 'statusFn'>>) => void;
  removeJob: (id: string) => void;
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

const MAX_JOBS = 10;

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  const addJob = useCallback((job: DownloadJob) => {
    setJobs((prev) => [job, ...prev].slice(0, MAX_JOBS));
  }, []);

  const updateJob = useCallback(
    (id: string, updates: Partial<Omit<DownloadJob, 'id' | 'prepareFn' | 'statusFn'>>) => {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
    },
    []
  );

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return (
    <DownloadsContext.Provider value={{ jobs, addJob, updateJob, removeJob }}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads(): DownloadsContextValue {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads must be used within DownloadsProvider');
  return ctx;
}
