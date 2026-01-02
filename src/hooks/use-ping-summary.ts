import { useEffect, useState } from "react";

type PingSummaryItem = {
  name: string;
  current: number | null;
  avg: number | null;
  loss: number | null;
};

type PingSummary = {
  items: PingSummaryItem[];
  loading: boolean;
};

type PingRecord = {
  task_id: number;
  time: string;
  value: number;
};

type PingTask = {
  id?: number;
  name?: string;
  loss?: number;
};

type PingApiResp = {
  data?: {
    records?: PingRecord[];
    tasks?: PingTask[];
  };
};

const emptySummary: PingSummary = {
  items: [],
  loading: true,
};

export function usePingSummary(uuid?: string, hours = 1) {
  const [summary, setSummary] = useState<PingSummary>(emptySummary);

  useEffect(() => {
    if (!uuid) return;
    let active = true;

    setSummary((prev) => ({ ...prev, loading: true }));
    fetch(`/api/records/ping?uuid=${uuid}&hours=${hours}`)
      .then((res) => res.json())
      .then((resp: PingApiResp) => {
        if (!active) return;
        const records = resp?.data?.records ?? [];
        const tasks = resp?.data?.tasks ?? [];
        const sorted = [...records].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        const taskList = tasks.length
          ? tasks.map((task, index) => ({
              id: typeof task.id === "number" ? task.id : index + 1,
              name: task.name || `Task ${index + 1}`,
              loss: typeof task.loss === "number" && Number.isFinite(task.loss) ? task.loss : null,
            }))
          : [];

        const fallbackTaskIds = Array.from(new Set(sorted.map((rec) => rec.task_id)));
        const resolvedTasks = taskList.length
          ? taskList
          : fallbackTaskIds.map((taskId, index) => ({
              id: taskId,
              name: `Task ${index + 1}`,
              loss: null,
            }));

        setSummary({
          items: resolvedTasks.map((task) => {
            const taskRecords = sorted
              .filter((rec) => rec.task_id === task.id)
              .map((rec) => (rec.value === -1 ? null : rec.value))
              .filter((val): val is number => typeof val === "number" && Number.isFinite(val));

            const current = taskRecords.length ? taskRecords[taskRecords.length - 1] : null;
            const avg = taskRecords.length
              ? taskRecords.reduce((acc, val) => acc + val, 0) / taskRecords.length
              : null;

            return {
              name: task.name,
              current,
              avg,
              loss: task.loss,
            };
          }),
          loading: false,
        });
      })
      .catch(() => {
        if (!active) return;
        setSummary({ items: [], loading: false });
      });

    return () => {
      active = false;
    };
  }, [uuid, hours]);

  return summary;
}
