import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ৩০ সেকেন্ডে ইউজার ০ থেকে ২০ এ উঠবে
    { duration: '1m', target: 20 }, // পরবর্তী ১ মিনিট ২০ জন ইউজার টানা রিকোয়েস্ট পাঠাবে
    { duration: '20s', target: 0 }, // শেষ ২০ সেকেন্ডে ইউজার ০ তে নেমে আসবে
  ],
};

export default function () {
  const url = 'http://localhost:3000/api/turfs';
  const res = http.get(url);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'transaction time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1); // প্রতিটি রিকোয়েস্টের মাঝে ১ সেকেন্ডের বিরতি
}
