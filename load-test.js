import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '20s', target: 0 },
  ],
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const thresholdMs = parseInt(__ENV.THRESHOLD_MS || '500', 10);
  const url = `${baseUrl}/api/turfs`;
  const res = http.get(url);
  check(res, {
    'status is 200': (r) => r.status === 200,
    [`transaction time < ${thresholdMs}ms`]: (r) =>
      r.timings.duration < thresholdMs,
  });
  sleep(1);
}

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
  };
}
