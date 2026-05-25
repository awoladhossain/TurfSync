# Nginx ব্যাখ্যা

এই ডকুমেন্টে দুইটি বিষয় বিস্তারিতভাবে ব্যাখ্যা করা হয়েছে:

1. Nginx কী এবং কেন ব্যবহার করা হয়
2. এই প্রজেক্টের `nginx/nginx.conf` ফাইলের প্রতিটি গুরুত্বপূর্ণ লাইন কী কাজ করে

## Nginx কী?

Nginx হলো একটি high-performance web server। তবে শুধু web server না, এটি reverse proxy, load balancer, HTTP cache, static file server হিসেবেও ব্যবহার করা যায়।

সহজভাবে বললে, client/browser থেকে request আসলে Nginx প্রথমে request গ্রহণ করে। তারপর configuration অনুযায়ী সিদ্ধান্ত নেয় request কোথায় পাঠাবে, কী header যোগ করবে, rate limit দেবে কি না, compression করবে কি না, অথবা সরাসরি response ফেরত দেবে কি না।

এই প্রজেক্টে Nginx মূলত reverse proxy হিসেবে ব্যবহার করা হয়েছে।

Request flow:

```text
Client -> Nginx -> NestJS App
```

Response flow:

```text
NestJS App -> Nginx -> Client
```

## Reverse Proxy কী?

Reverse proxy মানে client সরাসরি backend application-এর সাথে কথা বলে না। Client request পাঠায় Nginx-এর কাছে। এরপর Nginx সেই request backend application-এর কাছে forward করে।

উদাহরণ:

```text
Client request: http://domain.com/api/users
Nginx request গ্রহণ করে
Nginx request forward করে: http://app:3000/api/users
Backend response দেয়
Nginx response client-এর কাছে পাঠায়
```

Reverse proxy ব্যবহারের সুবিধা:

- Backend application-এর real address client থেকে hide থাকে
- Rate limiting করা যায়
- Security headers যোগ করা যায়
- Gzip compression করা যায়
- একাধিক backend থাকলে load balancing করা যায়
- Static file serve করা যায়
- SSL/TLS certificate handle করা যায়
- Backend application-এর সামনে একটি protective layer তৈরি হয়

## Nginx Configuration Structure

Nginx configuration সাধারণত কয়েকটি block দিয়ে সাজানো থাকে:

```nginx
worker_processes ...

events {
  ...
}

http {
  ...

  upstream ...

  server {
    ...

    location ... {
      ...
    }
  }
}
```

এই প্রজেক্টের config-এ মূল অংশগুলো হলো:

- `worker_processes`: Nginx কতগুলো worker process চালাবে
- `events`: connection handling settings
- `http`: HTTP request/response related settings
- `upstream`: backend application/server group define করে
- `server`: কোন port/domain handle করবে তা define করে
- `location`: কোন route কীভাবে handle হবে তা define করে

## এই প্রজেক্টে Nginx কীভাবে কাজ করছে

এই project-এ Nginx port `80`-তে request listen করছে। যদি request `/api` route-এ আসে, তাহলে সেটি NestJS backend app-এ proxy করে পাঠানো হচ্ছে। Backend app Docker Compose network-এর মধ্যে `app:3000` নামে পাওয়া যাচ্ছে।

Overall flow:

```text
Client
  |
  v
Nginx port 80
  |
  |-- /api/auth/login    -> strict auth rate limit -> app:3000
  |-- /api/auth/register -> strict auth rate limit -> app:3000
  |-- /api/health        -> health check, access log off -> app:3000
  |-- /api/...           -> normal API rate limit -> app:3000
  |
  `-- অন্য সব route       -> 404 JSON response
```

## `nginx.conf` ফাইলের সম্পূর্ণ ব্যাখ্যা

নিচে `nginx/nginx.conf` ফাইলের প্রতিটি অংশ line-by-line ব্যাখ্যা করা হলো।

### Worker Process

```nginx
# Worker processes — CPU core এর সমান রাখো
worker_processes auto;
```

`worker_processes auto;` মানে Nginx server-এর CPU core অনুযায়ী automatically worker process চালাবে।

Worker process হলো সেই process যেগুলো client request handle করে। `auto` দিলে Nginx নিজে decide করে কতগুলো worker process চালানো best হবে। এতে CPU resource ভালোভাবে ব্যবহার হয়। Nginx যখন রান করে, তখন সে ব্যাকগ্রাউন্ডে কিছু রিয়েল-ওয়ার্ল্ড লিনাক্স প্রসেস বা "শ্রমিক" তৈরি করে। এই শ্রমিকদের কাজই হলো বাইরে থেকে আসা ইউজারদের রিকোয়েস্টগুলো রিসিভ করা এবং NestJS-এর কাছে পাঠানো। এদেরকে বলা হয় `Wrker Process`।

**লিনাক্স বা যেকোনো অপারেটিং সিস্টেমের নিয়ম হলো—১টি CPU কোর (Core) একই সময়ে সর্বোচ্চ ১টি Worker Process-কে ফুল স্পিডে চালাতে পারে।**

#### ❌ যদি তুই এখানে auto না লিখে কোনো সংখ্যা লিখতি?

1. `ধরে নে তুই লিখলি: worker_processes 1;`
   কিন্তু তোর ক্লায়েন্ট সার্ভার কিনেছে 4-Core CPU-র (যেমন Hostinger KVM VPS 2)। তুই যেহেতু ১ লিখেছিস, এনগিন্স মাত্র ১টি কোর ব্যবহার করবে। বাকি ৩টি কোর অলস বসে থাকবে! হাজার হাজার ইউজার একসাথে টার্ফ বুক করতে আসলে ১টি কোরের ওপর চাপ পড়বে এবং সাইট স্লো হয়ে যাবে।

2. `ধরে নে তুই লিখলি: worker_processes 8;`
   কিন্তু তোর সার্ভারটি মাত্র 2-Core CPU-র। তখন ২টি কোরের ওপর ৮টি প্রসেস একসাথে জায়গা নেওয়ার জন্য মারামারি `(Context Switching)` করবে। এতে সার্ভারের পারফরম্যান্স আরও কমে যাবে।

### Events Block

```nginx
events {
```

`events` block-এর মধ্যে connection handling related configuration থাকে।

```nginx
  # প্রতিটা worker কতটা connection handle করবে
  worker_connections 1024;
```

প্রতিটি worker সর্বোচ্চ 1024টি simultaneous connection handle করতে পারবে।

যদি server-এ 4টি worker process থাকে, তাহলে theoretical maximum connection হতে পারে:

```text
4 * 1024 = 4096 connections
```

```nginx
}
```

#### 🧠 কনসেপ্ট: Connection মানে কী?

একটি কানেকশন মানে শুধু একজন ইউজার নয়। একজন ইউজার যখন তোর টার্ফ বুকিং সাইটে ঢুকবে, তখন তার ব্রাউজার এনগিন্সের সাথে একটা কানেকশন তৈরি করে। আবার এনগিন্স যখন ওই রিকোয়েস্টটা ভেতরের NestJS অ্যাপে পাঠায়, সেখানেও আরেকটা কানেকশন তৈরি হয়। অর্থাৎ, একজন একটিভ ইউজারের জন্য এনগিন্সে `সাধারণত ২টি বা তার বেশি` কানেকশন ওপেন হতে পারে।

এখানে 1024 লেখার মানে হলো, প্রতিটা সিঙ্গেল ওয়ার্কার প্রসেস একসাথে ১০২৪টি ওপেন কানেকশন হ্যান্ডেল করতে পারবে।

#### 🧮 আসল হিসাব: তোর সার্ভার একসাথে কত ট্রাফিক নিতে পারবে? (The Math)

এনগিন্স একসাথে টোটাল কতগুলো কানেকশন হ্যান্ডেল করতে পারবে, তার একটি সহজ সূত্র আছে:

$$\text{Max Connections} = \text{worker\_processes} \times \text{worker\_connections}$$

ধরে নে, ক্লায়েন্ট তোকে 4-Core CPU-র একটা হোস্টিংজার বা ডিজিটাল ওশান সার্ভার কিনে দিল।

1. `worker_processes auto`;-এর কারণে এনগিন্স ব্যাকগ্রাউন্ডে ৪টি ওয়ার্কার চালু করবে।
2. প্রতিটা ওয়ার্কারের ক্ষমতা `১০২৪ টি` কানেকশন হ্যান্ডেল করার।

তাহলে তোর এনগিন্স একসাথে সর্বোচ্চ $4 \times 1024 = 4096$ টি কানেকশন হ্যান্ডেল করতে পারবে।
যদি প্রতি ইউজারের জন্য ২টি করে কানেকশনও হিসাব করিস, তোর এই চিপ সার্ভারটি দিয়েই এনগিন্স একসাথে প্রায় ২,০০০ জন একটিভ ইউজারকে কোনো ল্যাগ ছাড়া হ্যান্ডেল করতে পারবে!

#### 🛡️ কেন ১০২৪-ই রাখা হয়? (কেন ১ লাখ লিখে দিলাম না?)

তোর মনে প্রশ্ন আসতেই পারে, "ভাইয়া, আমি এখানে ১০২৪ না লিখে ১,০০,০০০ লিখে দিলে সমস্যা কী? তাহলে তো লাখ লাখ ট্রাফিক একসাথে হ্যান্ডেল হবে!"

- সমস্যা হলো লিনাক্সের লিমিট `(OS Limit)`: তোর মেইন উবুন্টু অপারেটিং সিস্টেমের একটা নিয়ম আছে। সে প্রতিটা প্রসেসকে একটা নির্দিষ্ট সংখ্যার বেশি ফাইল বা কানেকশন ওপেন করতে দেয় না `(যাকে বলে ulimit বা Open Files Limit)`।

- তুই যদি লিনাক্সের ক্ষমতা না বাড়িয়ে nginx জোর করে বড় সংখ্যা বসিয়ে দিস, তবে সার্ভার ক্র্যাশ করবে এবং লগ ফাইলে এরর দেখাবে: `worker_connections exceed open file resource limit`।

এখানে `events` block শেষ হয়েছে।

### HTTP Block

```nginx
http {
```

`http` block-এর মধ্যে HTTP request এবং response related সব configuration থাকে। যেমন:

- MIME type
- Logging
- Gzip compression
- Rate limiting
- Upstream backend
- Server block
- Location/route handling

### MIME Type Settings

```nginx
  # Basic settings
  include       /etc/nginx/mime.types;
```

এই line Nginx-এর built-in MIME type list include করে। সহজ কথা: "পৃথিবীতে যত রকমের ফাইল ফরম্যাট আছে, তাদের একটা অফিশিয়াল ডিকশনারি বা ক্যাটালগ এই ফাইলে ইমপোর্ট (Include) করো।"

**`ব্যাকগ্রাউন্ড কনসেপ্ট (MIME Types কী?)`**: ইন্টারনেটের দুনিয়ায় ব্রাউজার (যেমন Chrome বা Safari) যখন সার্ভার থেকে কোনো ফাইল পায়, সে কিন্তু ফাইলের নাম বা এক্সটেনশন (.css বা .js) দেখে বোঝে না ওটা কী জিনিস। ব্রাউজারকে বোঝানোর জন্য সার্ভারকে একটা স্পেশাল সিগন্যাল হেডার পাঠাতে হয়, যেটিকে বলে `MIME Type (Multipurpose Internet Mail Extensions)`।

- যেমন: ফাইলটা যদি CSS হয়, তবে হেডার দিতে হয় `text/css`।
- ফাইলটা যদি আমাদের NestJS এর ডেটা হয়, তবে হেডার দিতে হয় `application/json`।
- এই লাইনের কাজ: লিনাক্স সার্ভারের ভেতরে `/etc/nginx/mime.types` নামে একটা অফিশিয়াল ফাইল অলরেডি বানানো থাকে। ওই ফাইলের ভেতর একটা বিশাল ম্যাপ বা লিস্ট আছে `(যেমন: .html মানে text/html, .js মানে application/javascript)`।
- `include` করার কারণে nginx সেই পুরো লিস্টটা মুখস্থ করে নেয়। এর ফলে ফ্রন্টএন্ড বা ব্যাকএন্ড থেকে যখনই কোনো ফাইল ইউজারের কাছে যাবে, nginx নিজে থেকেই ফাইলের ধরন বুঝে ব্রাউজারকে সঠিক হেডারটা পাঠাতে পারবে।

#### যদি এই লাইনটা না লিখতিস কী হতো?

তুই হয়তো ফ্রন্টএন্ডে Next.js এর কোনো সুন্দর স্টাইলশিট (style.css) লোড করতে চাচ্ছিস। এনগিন্স ফাইলটা ব্রাউজারে পাঠাবে ঠিকই, কিন্তু ব্রাউজার ওটাকে নরমাল টেক্সট ফাইল মনে করে স্ক্রিনে কোনো কালার বা ডিজাইন দেখাবে না (পুরো সাইট ভেঙে যাবে)।

MIME type browser-কে বলে response body কোন ধরনের file/data।
উদাহরণ:

- `.html` file হলে `text/html`
- `.css` file হলে `text/css`
- `.js` file হলে `application/javascript`
- `.json` file হলে `application/json`

```nginx
  default_type  application/octet-stream;
```

যদি Nginx কোনো file বা response-এর MIME type detect করতে না পারে, তাহলে default type হিসেবে `application/octet-stream` ব্যবহার করবে।

#### 📦 ৩. default_type application/octet-stream;

- সহজ কথা: "যদি কোনো ফাইলের জাত-কুল বা ফরম্যাট Nginx খুঁজে না পায়, তবে ওটাকে একটা বাইনারি ফাইল বা ডাউনলোডযোগ্য ফাইল হিসেবে ধরে নাও।"
- মেকানিজম: মাঝেমধ্যে তোর সার্ভারে এমন কিছু কাস্টম ফাইল থাকতে পারে (যেমন কোনো ডট-ফাইল বা আননোন এক্সটেনশনের ফাইল), যা ওপরের mime.types ডিকশনারিতে কোথাও লেখা নেই। Nginx তখন কনফিউজড হয়ে যায় যে ব্রাউজারকে কী হেডার পাঠাবে।
- এই লাইনের মাধ্যমে তুই Nginx কে একটা ব্যাকআপ প্ল্যান দিয়ে দিলি: "যদি ডিকশনারিতে মিল খুঁজে না পাও, তবে ওটার গায়ে `application/octet-stream` স্ট্যাম্প মেরে দাও।" লিনাক্স আর ব্রাউজারের ভাষায় এটার মানে হলো—এটি একটি `র-বাইনারি (Raw Binary) ফাইল, কোনো ওয়েবপেজ না`। ইউজার লিংকে ক্লিক করলে ওটা ডিসপ্লে করার চেষ্টা না করে ডিরেক্ট পিসিতে ডাউনলোড করে নাও।

`application/octet-stream` হলো generic binary data type।

### Logging Format

```nginx
  # Logging format
  log_format main '$remote_addr - $remote_user [$time_local] '
                  '"$request" $status $body_bytes_sent '
                  '"$http_referer" "$http_user_agent"';
```

এখানে `main` নামে একটি custom access log format define করা হয়েছে।

এই format অনুযায়ী access log-এ নিচের তথ্যগুলো থাকবে:

- `$remote_addr`: client-এর IP address `(যেমন: 103.45.67.89)`
- `$remote_user`: authenticated user, যদি থাকে
- `$time_local`: request আসার সময় `(যেমন: [24/May/2026:23:55:04 +0600])`
- `$request`: full HTTP request, যেমন `GET /api/users HTTP/1.1`
- `$status`: response status code, যেমন `200`, `404`, `500`
- `$body_bytes_sent`: response body কত bytes পাঠানো হয়েছে
- `$http_referer`: request কোন page/source থেকে এসেছে
- `$http_user_agent`: client browser/tool information

Example log:

```text
192.168.1.10 - - [24/May/2026:10:15:30 +0600] "GET /api/health HTTP/1.1" 200 32 "-" "curl/8.0"
```

```nginx
  access_log /var/log/nginx/access.log main;
```

সব access request `/var/log/nginx/access.log` file-এ save হবে। এখানে `main` log format ব্যবহার করা হয়েছে।

Access log থেকে বোঝা যায়:

- কোন route hit হয়েছে
- কোন IP request করেছে
- response status কী ছিল
- request কত সময়ে এসেছে

#### 🧠 ব্যাকএন্ড ইঞ্জিনিয়ার হিসেবে এটি কেন লাইফ-সেভার?

ধর, কোনো একদিন সকালবেলা তোর ক্লায়েন্ট ফোন দিয়ে চিল্লাপাল্লা শুরু করলো—"ভাইয়া! আমার টার্ফ বুকিং অ্যাপ হুট করে স্লো হয়ে গেছে, কাজ করছে না!" তুই তখন সাথে সাথে সার্ভারে ঢুকে এই লগ ফাইলটা ওপেন করবি। যদি দেখিস এক সেকেন্ডের মধ্যে একই `আইপি ($remote_addr)` থেকে অনবরত হাজার হাজার `POST /api/auth/login` রিকোয়েস্ট আসছে এবং স্ট্যাটাস কোড `($status) 429 বা 500` হয়ে যাচ্ছে, তুই ১ সেকেন্ডে বুঝে যাবি—"কোনো একটা নির্দিষ্ট আইপি থেকে আমাদের অ্যাপে `ব্রুট-ফোর্স বা ডিডিওএস (DDOS)` অ্যাটাক করা হচ্ছে!" তুই সাথে সাথে ওই আইপিটাকে সার্ভার থেকে ব্লক করে দিতে পারবি।

```nginx
  error_log  /var/log/nginx/error.log warn;
```

Nginx error log `/var/log/nginx/error.log` file-এ save হবে।

`warn` মানে warning level এবং তার চেয়ে serious error log করা হবে।

### Performance Settings

```nginx
  # Performance
  sendfile        on;
```

`sendfile on;` static file serve করার সময় kernel-level optimization ব্যবহার করে। এতে file serving faster হয় এবং CPU usage কমে।

**সাধারণত কী হয়:** এনগিন্স যখন সার্ভার থেকে কোনো ফাইল (যেমন: টার্ফের ছবি বা কোনো স্ট্যাটিক ফাইল) ইউজারের ব্রাউজারে পাঠাতে চায়, তখন লিনাক্স অপারেটিং সিস্টেম প্রথমে ফাইলটি হার্ডডিস্ক থেকে রিড করে মেমোরির (RAM) একটা কোণায় নেয়, সেখান থেকে আবার কপি করে এনগিন্স অ্যাপ্লিকেশনের মেমোরিতে আনে, তারপর সেখান থেকে নেটওয়ার্ক কার্ডে পাঠায়। এই যে র‍্যামের ভেতর বারবার ডেটা কপি-পেস্ট হচ্ছে, এতে প্রসেসরের বেশ খাটনি হয়।

**`sendfile on;` করলে কী হয়:** এটি অন থাকলে এনগিন্স লিনাক্স কার্নেলের একটা স্পেশাল ডিরেক্ট রুট ব্যবহার করে। ফাইলটি হার্ডডিস্ক থেকে রিড হয়ে মাঝখানের কোনো মেমোরিতে কপি হওয়া ছাড়াই সরাসরি নেটওয়ার্ক কার্ডে (Socket) চলে যায়। একে ডেভঅপ্সের ভাষায় বলে Zero-Copy মেকানিজম। এর ফলে ফাইল ট্রান্সফার স্পিড বহুগুণ বেড়ে যায় এবং তোর সার্ভারের CPU একদম রিল্যাক্স থাকে।

```nginx
  tcp_nopush      on;
```

`tcp_nopush on;` TCP packet optimization করে। সাধারণত `sendfile` এর সাথে ব্যবহার করলে বড় response বা static file efficient ভাবে পাঠানো যায়।

**সাধারণত কী হয়:** ইন্টারনেট বা নেটওয়ার্কে ডেটা যখন এক জায়গা থেকে অন্য জায়গায় যায়, তখন সে ছোট ছোট প্যাকেটে ভাগ হয়ে যায়। এনগিন্স যদি প্রতিটা ছোট ছোট ডেটার টুকরো বা রেসপন্স তৈরি হওয়ামাত্রই আলাদা আলাদা প্যাকেটে ইন্টারনেটে পাঠাতে থাকে, তবে নেটওয়ার্কে Header-এর জ্যাম তৈরি হয় এবং ব্যান্ডউইথ নষ্ট হয়।

**`tcp_nopush on;` করলে কী হয়:** এটা একটা কুরিয়ার সার্ভিসের মতো কাজ করে। কুরিয়ারওয়ালারা যেমন একটা ছোট পার্সেল পেলেই বাইক নিয়ে রওনা দেয় না, বরং পুরো ট্রাক লোড হওয়া পর্যন্ত অপেক্ষা করে এবং একসাথে সব ডেলিভারি দেয়—ঠিক তেমনি এই অপশনটি অন থাকলে এনগিন্স সবগুলো ছোট ডেটার টুকরোকে একসাথে জমা করে। যখন প্যাকেটটি ডেটায় পুরোপুরি ফুল হয়ে যায়, তখন সে এক ধাক্কায় পুরো বড় প্যাকেটটি ইন্টারনেটে পুশ করে। এতে নেটওয়ার্কের কার্যক্ষমতা অনেক বেড়ে যায়। (নোট: এটি কাজ করার জন্য ওপরের `sendfile on;` অন থাকা আবশ্যক)।

```nginx
  keepalive_timeout 65;
```

Client connection idle থাকলে 65 seconds পর্যন্ত open রাখা হবে।

এর ফলে একই client বারবার request করলে প্রতিবার নতুন TCP connection তৈরি করার প্রয়োজন কমে যায়। এতে performance improve হয়।

**সাধারণত কী হয়:** একজন ইউজার যখন তোর টার্ফ বুকিং সাইটে ঢোকে, তখন তার ব্রাউজারকে তোর সার্ভারের সাথে একটা সিকিউর কানেকশন বা টানেল তৈরি করতে হয় (যাকে বলে TCP Handshake)। এখন ইউজার যদি হোমপেজে ঢোকার পর ১ সেকেন্ড পর আবার বুকিং পেজে ক্লিক করে, আর প্রতিবার যদি নতুন করে এই টানেল বানাতে হয়, তবে অ্যাপ অনেক স্লো ফিল হবে।

**`keepalive_timeout 65;` করলে কী হয়:** এই লাইনের মাধ্যমে তুই এনগিন্সকে বললি—"কোনো ইউজার একটা রিকোয়েস্ট করার পর তার সাথে কানেকশনের দরজাটা সাথে সাথে বন্ধ না করে ৬৫ সেকেন্ড পর্যন্ত জ্যান্ত বা ওপেন রাখো।" এই ৬৫ সেকেন্ডের মধ্যে ইউজার যদি অন্য কোনো পেজে বা এপিআইতে ক্লিক করে, তবে নতুন করে কানেকশন বানানোর ঝামেলা ছাড়াই অলরেডি খোলা থাকা টানেল দিয়ে ডেটা চোখের পলকে চলে যাবে। আর ৬৫ সেকেন্ড পার হওয়ার পরও ইউজার যদি কোনো নড়াচড়া না করে, তবে সার্ভারের র‍্যাম খালি করার জন্য এনগিন্স নিজে থেকেই কানেকশনটি ক্লোজ করে দেবে।

### Gzip Compression

```nginx
  # Gzip — response compress করো → কম bandwidth
  gzip on;
```

`gzip on;` response compression enable করে।

Text-based response compress হলে response size কমে যায়। ফলে bandwidth কম লাগে এবং response দ্রুত client-এর কাছে যেতে পারে।

**সহজ কথা:** জিপ কম্প্রেশনের মেইন ইঞ্জিনটা অন করো।

**কাজ:** এনগিন্সকে বলা হলো—"এখন থেকে ব্যাকএন্ড থেকে কোনো বড় ডাটা বা ফাইল ইউজারের কাছে যাওয়ার আগে, তুমি ওটাকে ব্যাকগ্রাউন্ডে অটোমেটিক জিপ (.zip এর মতো কমপ্রেস) করে সাইজ ছোট করে ফেলবা।"

```nginx
  gzip_vary on;
```

এই setting response header-এ `Vary: Accept-Encoding` যোগ করে।

এটি cache/proxy system-কে জানায় যে client gzip support করে কি না তার উপর response ভিন্ন হতে পারে।

**কাজ:** পৃথিবীর সব ব্রাউজার কিন্তু জিপ ফাইল ডিকোড বা আনজিপ করতে পারে না (যদিও মডার্ন Chrome, Safari, Firefox সবাই পারে)। এই লাইনটি অন থাকলে এনগিন্স রেসপন্সের সাথে একটা হেডার পাঠায়: `Vary: Accept-Encoding`। এর মাধ্যমে ব্রাউজার বুঝতে পারে যে ফাইলটি জিপ করা অবস্থায় আসছে, এবং ব্রাউজার সেটাকে মোবাইলের স্ক্রিনে দেখানোর আগে নিজে থেকেই আনজিপ (Decompress) করে নেয়।

```nginx
  gzip_min_length 1024;
```

শুধুমাত্র 1024 bytes বা তার বেশি size-এর response gzip করা হবে।

খুব ছোট response compress করলে benefit কম, কিন্তু processing overhead থাকে। তাই minimum length set করা হয়েছে।

```nginx
  gzip_types text/plain application/json application/javascript
             text/css application/xml;
```

কোন কোন content type gzip করা হবে তা define করা হয়েছে।

এই config অনুযায়ী gzip হবে:

- plain text
- JSON
- JavaScript
- CSS
- XML

### Rate Limiting Zone - Leaky Bucket

```nginx
  # Rate limiting zone define করো
  # 10mb memory তে IP গুলো track করো
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
```

এখানে `api` নামে একটি rate limit zone তৈরি করা হয়েছে।

ব্যাখ্যা:

- `$binary_remote_addr`: client IP address memory-efficient binary format-এ store করে, `$binary_remote_addr`: এর মানে হলো এনগিন্স ইউজারের আইপি অ্যাড্রেস (IP Address) ট্র্যাক করবে। তবে র-টেক্সট আইপি (যেমন: `103.45.67.89`) হিসেবে সেভ না করে ওটাকে বাইনারি ফরম্যাটে (কম্পিউটারের ভাষায়) কনভার্ট করে মেমোরিতে রাখবে। কেন? কারণ নরমাল আইপি মেমোরিতে ৩২ থেকে ১২৮ বাইট জায়গা নেয়, কিন্তু বাইনারি করে ফেললে মাত্র ৪ থেকে ১৬ বাইট জায়গা লাগে। অর্থাৎ, মেমোরি বাঁচানোর জন্য এই ট্রিক!

- `zone=api:10m`: `api` নামে 10 MB shared memory zone তৈরি করে, `zone=api:10m`: তুই এনগিন্সের র‍্যামের ভেতর api নামে একটা স্পেশাল জোন বা ব্ল্যাকবোর্ড বানাচ্ছিস, যেটার সাইজ দিচ্ছিস 10 Megabytes (10 MB)। এনগিন্সের অফিশিয়াল হিসাব অনুযায়ী, ১ মেগাবাইটে প্রায় ১৬,০০০ আইপি ট্র্যাক করা যায়। তার মানে এই ১০ এমবি মেমোরিতে তুই একসাথে ১ লাখ ৬০ হাজার ইউনিক ইউজারের আইপি লাইভ ট্র্যাক করতে পারবি!

- `rate=30r/m`: প্রতি IP প্রতি minute সর্বোচ্চ 30টি request করতে পারবে, `rate=30r/m`: এর মানে হলো 30 requests per minute (মিনিটে ৩০টি রিকোয়েস্ট)। অর্থাৎ, সাধারণ এপিআই রাউটগুলোতে (যেমন টার্ফের লিস্ট দেখা বা প্রোফাইল দেখা) একজন ইউজার গড়ে প্রতি ২ সেকেন্ডে ১ বারের বেশি হিট করতে পারবে না ($30 / 60 \text{ seconds} = 1\text{ request every } 2\text{ seconds}$)।

এই zone সাধারণ API route-এর জন্য ব্যবহার করা হয়েছে।

```nginx
  limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
```

এখানে `auth` নামে আরেকটি rate limit zone তৈরি করা হয়েছে।

ব্যাখ্যা:

- এই zone login/register endpoint-এর জন্য ব্যবহার করা হয়েছে
- প্রতি IP প্রতি minute সর্বোচ্চ 5টি request করতে পারবে
- brute-force login attack বা spam registration কমাতে সাহায্য করে

### Upstream Backend

```nginx
  # Upstream — NestJS app
  upstream turfbook_app {
```

`upstream` block backend server group define করে। এখানে group-এর নাম `turfbook_app`।

পরবর্তীতে `proxy_pass http://turfbook_app;` ব্যবহার করে request এই backend group-এ পাঠানো হবে।

**সহজ কথা:** তুই এনগিন্সের ভেতর একটা কাল্পনিক "গ্রুপ" বা "টার্গেট জোন" বানাচ্ছিস যার নাম দিলি turfbook_app।

**কেন এটা দরকার:** ভবিষ্যতে যখন তোর অ্যাপে লাখ লাখ ট্রাফিক আসবে এবং ক্লায়েন্ট বলবে একটা সার্ভারে লোড নিচ্ছে না, তখন তোকে হয়তো ৩টা আলাদা আলাদা ব্যাকএন্ড সার্ভার বা কন্টেইনার চালাতে হবে। তখন তুই এই upstream ব্লকের ভেতরেই ৩টা সার্ভারের আইপি বসিয়ে দিতে পারবি। এনগিন্স তখন অটোমেটিক ট্রাফিক ভাগ করে (Load Balancing) তিন সার্ভারে পাস করবে। তোর মেইন কোডের অন্য কোথাও কোনো হাত দেওয়া লাগবে না!

```nginx
    server app:3000;  # docker-compose service name
```

Backend application-এর address হলো `app:3000`।

Docker Compose environment-এ `app` সাধারণত backend service/container-এর নাম। একই Docker network-এর মধ্যে Nginx `app` নাম দিয়ে backend container খুঁজে পায়।

`3000` হলো NestJS application-এর port।

**সহজ কথা:** "এনগিন্স ভাই, আমাদের আসল NestJS অ্যাপটা ডকার কন্টেইনারের ভেতরে 3000 পোর্টে রানিং আছে, রিকোয়েস্টগুলো ওখানে পাঠাও।"

**ভেতরের আসল মেকানিজম (Service Discovery):** তুই যদি সাধারণ কোনো সার্ভারে ডকার ছাড়া অ্যাপ চালাতিস, তবে তোকে এখানে সার্ভারের আইপি লিখতে হতো (যেমন: `server 127.0.0.1:3000;`)। কিন্তু তুই যেহেতু প্রজেক্টটা Docker Compose দিয়ে চালাচ্ছিস, ডকারের নিজস্ব একটা ইন্টারনাল নেটওয়ার্কিং সিস্টেম আছে।

তোর `docker-compose.yml` ফাইলে তোর NestJS অ্যাপের যে সার্ভিস নাম দিবি (ধরে নিলাম তুই নাম দিয়েছিস app), ডকার এনগিন্সকে একটা স্পেশাল পাওয়ার দেয় যেন এনগিন্স সরাসরি ওই app নাম ধরেই তোর ব্যাকএন্ড কন্টেইনারকে চিনে ফেলতে পারে। তোকে কোনো আইপি মুখস্থ রাখা লাগবে না।

```nginx
    keepalive 32;
```

Nginx backend app-এর সাথে maximum 32টি idle keepalive connection maintain করতে পারবে।

এতে repeated API request faster হয়, কারণ প্রতিবার backend-এর সাথে নতুন connection তৈরি করতে হয় না।

**সহজ কথা:** "এনগিন্স থেকে ভেতরের NestJS অ্যাপে যাওয়ার যে ভেতরের রাস্তা, সেখানে একসাথে ৩২টি কানেকশন সবসময় রেডি বা ওপেন রাখো, যেন রিকোয়েস্ট আসামাত্রই কোনো ল্যাগ ছাড়া পাস হতে পারে।"

**ভেতরের ডিপ মেকানিজম:** সাধারণত বাইরে থেকে যখন কোনো রিকোয়েস্ট এনগিন্সে আসে, এনগিন্স প্রতিবার ভেতরের NestJS অ্যাপের সাথে নতুন করে একটা কানেকশন তৈরি করে, ডেটা পাস করে, আবার কানেকশনটা বন্ধ করে দেয়। এই নতুন করে কানেকশন তৈরি করা আর বন্ধ করার প্রসেসে (TCP handshake) সামান্য হলেও সময় নষ্ট হয়।

যখন তুই `keepalive 32;` লিখে দিলি, এনগিন্স তোর NestJS অ্যাপের সাথে ব্যাকগ্রাউন্ডে ৩২টি কানেকশনের "স্থায়ী পাইপলাইন" বা টানেল সবসময় জ্যান্ত (Alive) রাখবে। বাইরে থেকে ট্রাফিক আসামাত্রই এনগিন্স অলরেডি রেডি থাকা ওই ৩২টি লাইনের যেকোনো একটি দিয়ে ডেটা সাথে সাথে নেস্ট অ্যাপে পুশ করে দেবে। এর ফলে তোর ব্যাকএন্ডের রেসপন্স টাইম (Latency) মারাত্মক লেভেলে কমে যাবে এবং অ্যাপ আরও ফাস্ট কাজ করবে।

```nginx
  }
```

এখানে `upstream turfbook_app` block শেষ হয়েছে।

### Server Block

```nginx
  server {
```

`server` block একটি virtual server define করে।

এখানে বলা হয়:

- কোন port listen করবে
- কোন domain/server name handle করবে
- request কোন route অনুযায়ী কীভাবে process হবে

```nginx
    listen 80;
```

Nginx HTTP port `80`-তে request listen করবে।

Port `80` হলো default HTTP port।

**সহজ কথা:** এনগিন্সকে বলা হচ্ছে—"সার্ভারে দাঁড়িয়ে ইন্টারনেট থেকে আসা 80 নম্বর পোর্টের সমস্ত সাধারণ রিকোয়েস্টগুলোর দিকে কান খাড়া করে রাখো (Listen করো)।"

**ভেতরের মেকানিজম:** ইন্টারনেটে আমরা যত ওয়েবসাইট ব্রাউজ করি (যেমন: google.com বা তোর টার্ফ সাইট), তার সবগুলোর ডিফল্ট ব্যাকগ্রাউন্ড পোর্ট থাকে 80 (HTTP-র জন্য) অথবা 443 (HTTPS-র জন্য)। ইউজার যখন ব্রাউজারে তোর সাইটের লিংক লিখবে, সেই রিকোয়েস্টটা সোজা এসে এই ৮০ নম্বর পোর্টের দরজায় নক করবে। এনগিন্স তখন এই রিকোয়েস্টটা রিসিভ করে ভেতরে প্রসেস করা শুরু করবে।

```nginx
    server_name _;
```

`server_name _;` সাধারণত catch-all server name হিসেবে ব্যবহার করা হয়।

মানে, নির্দিষ্ট কোনো domain match না করলেও এই server block request handle করবে।

**সহজ কথা:** "এই সার্ভারের আইপি (IP) বা যে ডোমেইন দিয়েই হিট করা হোক না কেন, তুমি সব রিকোয়েস্ট এক্সেপ্ট করো।"

**ভেতরের মেকানিজম:** সাধারণত এখানে প্রজেক্টের আসল ডোমেইন নাম লিখতে হয় (যেমন: `server*name api.turfbook.com;`)। কিন্তু তুই যখন এখানে একটা আন্ডারস্কোর * (Wildcard catch-all) দিয়ে দিবি, এনগিন্স তখন একটা গ্লোবাল বাউন্সার হয়ে যাবে। এর মানে হলো, ক্লায়েন্ট এখনো ডোমেইন না কিনলেও, তুই যদি ব্রাউজারে সরাসরি সার্ভারের আইপি অ্যাড্রেসও লিখিস (যেমন: `http://103.45.67.89`), এনগিন্স ওই রিকোয়েস্টটা রিজেক্ট না করে লুফে নেবে।

### Request Size Limit

```nginx
    # Request size limit — কেউ giant payload পাঠাতে পারবে না
    client_max_body_size 10M;
```

Client request body maximum `10M`, অর্থাৎ 10 MB হতে পারবে।

যদি কেউ 10 MB-এর বেশি request body পাঠায়, তাহলে Nginx request reject করতে পারে এবং সাধারণত `413 Request Entity Too Large` response দেয়।

এটি বড় payload attack বা accidental large upload থেকে backend-কে protect করে।

**সহজ কথা:** "বাইরে থেকে কোনো ইউজার একবারে ১০ মেগাবাইট (10 MB) এর চেয়ে বড় সাইজের কোনো ডেটা বা ফাইল আপলোড করতে পারবে না।"

**কেন এটি ব্যাকএন্ডের জন্য জীবন-মরণ সমস্যা:** তোর টার্ফ বুকিং অ্যাপে ইউজাররা বড় জোর কী আপলোড করবে? একটা প্রোফাইল পিকচার, অথবা মাঠের মালিকরা মাঠের ২-৩ টা ছবি (images: String[]) আপলোড করবে। একটা ছবির সাইজ সাধারণত ২ থেকে ৫ এমবি-র বেশি হয় না।

যদি এই লাইনটা না লিখতিস কী হতো?

কোনো দুষ্টু ইউজার বা হ্যাকার তোর অ্যাপের ইমেজ আপলোড এপিআইতে গিয়ে একটা ২ গিগাবাইট (2 GB) সাইজের ফালতু মুভি বা বিশাল ফাইল আপলোড করে দিত। তোর NestJS ব্যাকএন্ড তখন ওই বিশাল ফাইল প্রসেস করতে গিয়ে পুরো র‍্যাম (RAM) জ্যাম করে ফেলত, সার্ভার হ্যাং হয়ে যেত এবং বাকি সাধারণ কাস্টমাররা সাইটে ঢুকতে পারত না (একে বলে Denial of Service বা DOS অ্যাটাক)।

**এনগিন্সের বাউন্সারি:** এখানে ১০ এমবি সেট করার কারণে, হ্যাকার যখনই কোনো ১০ এমবির বড় ফাইল পাঠাবে, এনগিন্স ফাইলটা তোর NestJS কোড পর্যন্ত যেতেই দেবে না! সে মেইন গেটেই রিকোয়েস্টটা কেটে দিয়ে ইউজারের স্ক্রিনে 413 Request Entity Too Large এরর ছুড়ে মারবে। এতে তোর NestJS ব্যাকএন্ড থাকবে একদম সেফ আর কুল।

### Proxy Timeout Settings

```nginx
    # Timeout settings
    proxy_connect_timeout 60s;
```

Nginx, backend application-এর সাথে connection establish করার জন্য maximum 60 seconds wait করবে।

**সহজ কথা:** "এনগিন্স থেকে ভেতরের NestJS অ্যাপের সাথে কানেকশন তৈরি বা হ্যান্ডশেক করার জন্য সর্বোচ্চ ৬০ সেকেন্ড ট্রাই করো।"

**ভেতরের মেকানিজম:** বাইরে থেকে রিকোয়েস্ট আসার পর এনগিন্স যখন ভেতরের ডকার কন্টেইনারে (`app:3000`) নক করে, তখন তাদের মধ্যে একটা ইন্টারনাল কানেকশন তৈরি হতে হয়। কোনো কারণে যদি তোর NestJS অ্যাপ মারাত্মক ডাউন থাকে, বা মেমোরি ফুল হয়ে ক্র্যাশ করে বসে থাকে—তবে এনগিন্স অনবরত ট্রাই করতেই থাকবে না। সে সর্বোচ্চ ৬০ সেকেন্ড ট্রাই করবে, যদি দেখে নেস্ট অ্যাপের কোনো সাড়া শব্দ নেই, সে হাল ছেড়ে দিয়ে ইউজারকে 504 Gateway Timeout এরর দেখিয়ে দেবে।

```nginx
    proxy_send_timeout    60s;
```

Nginx backend application-এর কাছে request পাঠানোর সময় maximum 60 seconds wait করবে।

**সহজ কথা:** "এনগিন্স যখন ইউজারের ডেটাগুলো ভেতরের NestJS অ্যাপের কাছে ট্রান্সফার (Send) করবে, তখন প্রতিটা ডেটার টুকরো পাঠানোর মাঝখানের গ্যাপ যেন ৬০ সেকেন্ড এর বেশি না হয়।"

**ভেতরের মেকানিজম:** ধর, কোনো ওনার একটা বড় ফাইল বা ডেটা আপলোড করছে। এনগিন্স সেই ডেটাটা রিসিভ করে ভেতরের NestJS অ্যাপের পাইপলাইনে পুশ করছে। এই পুশ করার প্রসেস চলাকালীন যদি মাঝপথে নেটওয়ার্ক স্লো হয়ে যায় বা ডেটা ট্রান্সফার প্রসেস টানা ৬০ সেকেন্ডের জন্য একদম স্তব্ধ (Idle) হয়ে থমকে থাকে, তবে এনগিন্স বুঝবে কোথাও কোনো বড় ঝামেলা হয়েছে। সে তখন ফালতু মেমোরি নষ্ট না করে কানেকশনটি কেটে দেবে।

```nginx
    proxy_read_timeout    60s;
```

Nginx backend application থেকে response read করার জন্য maximum 60 seconds wait করবে।

যদি backend 60 seconds-এর মধ্যে response না দেয়, তাহলে timeout হতে পারে।

**সহজ কথা:** "NestJS অ্যাপের কাছে রিকোয়েস্ট জমা দেওয়ার পর, NestJS-এর উত্তরের (Response) জন্য এনগিন্স সর্বোচ্চ ৬০ সেকেন্ড হা করে বসে থাকবে।"

**কেন এটি তোর অ্যাপের জন্য লাইফ-সেভার:** ধর, তোর কোনো একটা এপিআই রাউটে একটা বড় বাগ (Bug) আছে। কাস্টমার যখন POST /api/bookings এ হিট করলো, তোর NestJS কোড ডাটাবেজে কুয়েরি করতে গিয়ে একটা ইনফিনিট লুপে (Infinite Loop) পড়ে গেল বা কোনো একটা await প্রমিজ আটকে গিয়ে কোডটা চিরকালের জন্য স্তব্ধ হয়ে গেল।

যদি তুই এই proxy_read_timeout সেট না করতিস, তবে এনগিন্স ওই একটা রিকোয়েস্টের পেছনে ঘণ্টার পর ঘণ্টা আশা নিয়ে বসে থাকতো। এতে সার্ভারের মেমোরি ব্লক হয়ে যেত এবং নতুন কোনো ইউজার সাইটেই ঢুকতে পারতো না।

এখন ৬০ সেকেন্ড সেট করার কারণে—NestJS যদি ৬০ সেকেন্ডের মধ্যে কোনো উত্তর এনগিন্সকে ফেরত না দেয়, তবে এনগিন্স আর এক মুহূর্তও অপেক্ষা করবে না। সে কাস্টমারকে বলবে, "ভাই, ভেতরের সার্ভার রেসপন্স করছে না (504 Gateway Timeout)" এবং কানেকশনটা কেটে দিয়ে নিজের মেমোরি একদম খালি ও ফ্রি করে ফেলবে পরের ইউজারদের সার্ভিস দেওয়ার জন্য।

### Security Headers

```nginx
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
```

এই header browser-কে বলে, এই site শুধুমাত্র same origin-এর frame/iframe-এর মধ্যে load হতে পারবে।

এটি clickjacking attack কমাতে সাহায্য করে।

**হ্যাকার কী ক্রাইম করতে পারে (Clickjacking):** ধর, একজন হ্যাকার একটা ফালতু ওয়েবসাইট বানালো (যেমন: free-iphone.com)। সেই সাইটে সে একটা বড় বাটন রাখলো—"ক্লিক করে আইফোন জিতুন"। কিন্তু হ্যাকার চালাকি করে ওই বাটনের ঠিক ওপরে একটা অদৃশ্য বা ইনভিজিবল (Opacity 0 করে) আইফ্রেম `<iframe>` বসিয়ে দিল, যার ভেতরে তোর আসল টার্ফ বুকিং অ্যাপের স্লট বুকিং বা পেমেন্ট পেজটা লোড হয়ে আছে। ইউজার ভাববে সে আইফোনের বাটনে ক্লিক করছে, কিন্তু ব্যাকগ্রাউন্ডে ব্রাউজার আসলে তোর সাইটের পেমেন্ট বাটনে ক্লিক করিয়ে দেবে! একে বলে Clickjacking।

**এই হেডার কী করে:** যখন তুই SAMEORIGIN সেট করে দিবি, তখন এনগিন্স ব্রাউজারকে বলে দেবে—"এই টার্ফ বুকিং অ্যাপের কোনো পেজকে আমার নিজের ওয়েবসাইট ছাড়া অন্য কোনো থার্ড-পার্টি ওয়েবসাইটের আইফ্রেমের (`<iframe>`) ভেতর ডিসপ্লে বা লোড করা যাবে না।" হ্যাকার তখন তার ফেক সাইটে তোর পেজ আর লুকাতে পারবে না। অ্যাটাক ব্লক!

```nginx
    add_header X-Content-Type-Options "nosniff" always;
```

এই header browser-কে বলে MIME type guess/sniff না করতে।

Browser declared content type follow করবে। এতে কিছু content-type based security issue কমে।

**হ্যাকার কী ক্রাইম করতে পারে (MIME Sniffing):** তোর টার্ফ অ্যাপে ইমেজ আপলোডের অপশন আছে। কোনো হ্যাকার একটা মারাত্মক পাইথন স্ক্রিপ্ট বা ভাইরাস কোড বানিয়ে ওটার এক্সটেনশন বদলে দিল virus.png। তোর ব্যাকএন্ড হয়তো ভাবলো এটা একটা ছবি এবং ওটা সার্ভারে সেভ করলো। কাস্টমার যখন ওই ছবিটা ব্রাউজারে দেখতে যাবে, ব্রাউজার যদি বোকামি করে ফাইলের ভেতরের কোড শুঁকে (Sniff করে) দেখে ওটা ছবি না, ওটা আসলে একটা জাভাস্ক্রিপ্ট কোড, তখন ব্রাউজার ওটা রান করে কাস্টমারের কুকি বা টোকেন চুরি করে নিতে পারে।

**এই হেডার কী করে:** যখন তুই nosniff লিখে দিবি, তুই ব্রাউজারকে ধমক দিয়ে বললি—"বেশি পণ্ডিতি করে ফাইলের ভেতর শুঁকতে যাবা না! সার্ভার যদি বলে এটা ইমেজ বা টেক্সট, তবে ওটাকে ইমেজ বা টেক্সট হিসেবেই ট্রিট করো, ওটার ভেতরের স্ক্রিপ্ট এক্সিকিউট করার কোনো দরকার নাই।" হ্যাকারের ম্যালিসিয়াস কোড তখন ব্রাউজারে ডেড ফাইল হয়ে পড়ে থাকবে।

```nginx
    add_header X-XSS-Protection "1; mode=block" always;
```

এই header পুরনো browser-এর built-in XSS filter enable করে এবং suspicious script detect করলে page block করতে বলে।

Modern browser-এ এই header mostly legacy, তবে পুরনো browser support-এর জন্য রাখা হয়েছে।

**হ্যাকার কী ক্রাইম করতে পারে (XSS):** হ্যাকার যদি কোনোভাবে তোর ওয়েবসাইটের ইনপুট বক্সে বা ইউআরএলে একটা ক্ষতিকর জাভাস্ক্রিপ্ট কোড ইঞ্জেক্ট করে দিতে পারে (যেমন: `<script>steal_token()</script>`), এবং ব্রাউজার যদি ওই কোডটা স্ক্রিনে রান করে ফেলে, তবে কাস্টমারের পুরো অ্যাকাউন্ট হ্যাক হয়ে যাবে। একে বলে XSS অ্যাটাক।

**এই হেডার কী করে:** এই হেডারটি মডার্ন ব্রাউজারের ভেতরের ইন-বিল্ট XSS ফিল্টারকে ওয়েক-আপ (Wake up) করে দেয়। 1; mode=block এর মানে হলো—ব্রাউজার যদি দেখে ইউআরএল বা পেজের কোথাও কোনো মেলিসিয়াস স্ক্রিপ্ট রিফ্লেক্ট হচ্ছে, তবে সে পেজটার ওই অংশটুকু ক্লিন করার চেষ্টা না করে, নিরাপত্তার স্বার্থে পুরো পেজটাকেই লোড হওয়া ব্লক (Block) করে দেবে।

```nginx
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

এই header browser referrer information কতটুকু পাঠাবে তা control করে।

**ঝামেলাটা কোথায়:** ধর, কাস্টমার তোর অ্যাপের একটা সিকিউরড পেজে আছে—`https://turfbook.com/api/bookings/secret-token-123`। এই পেজের ভেতরে কোনো কারণে একটা এক্সটার্নাল লিংক আছে (যেমন ফেসবুক বা স্ট্রাইপ পেমেন্টের লিংক)। কাস্টমার যখন ওই লিংকে ক্লিক করে অন্য সাইটে যাবে, ব্রাউজার ডিফল্ট নিয়মে ওই অন্য সাইটের মালিককে জানিয়ে দেয় যে ইউজার ঠিক কোন পুরো ইউআরএল লিংক থেকে ক্লিক করে এসেছে (Referrer)। এতে তোর এপিআই-এর সিক্রেট টোকেন বা ইউআরএল ডেটা অন্য ওয়েবসাইটের লগে লিক হয়ে যেতে পারে।

**এই হেডার কী করে:** যখন তুই strict-origin-when-cross-origin দিবি, তুই ব্রাউজারকে রুলস শিখিয়ে দিলি—"ইউজার যদি আমার সাইট থেকে অন্য কোনো থার্ড-পার্টি সাইটে ক্লিক করে যায়, তবে তাকে শুধু আমার মেইন ডোমেইন নামটা (`https://turfbook.com`) দেখাও। পেজের ভেতরের কোনো সিক্রেট ইউআরএল বা আইডি যেন ভুলেও অন্য সাইটের কাছে পাস না হয়।" তোর ইন্টারনাল এপিআই রাউট থাকবে সম্পূর্ণ গোপন।

`strict-origin-when-cross-origin` মানে:

- Same-origin request হলে full referrer URL পাঠাবে
- Cross-origin HTTPS request হলে শুধু origin পাঠাবে
- HTTPS থেকে HTTP downgrade হলে referrer পাঠাবে না

```nginx
    ...
    always;
```

`always` ব্যবহার করলে error response-এর ক্ষেত্রেও header যোগ করার চেষ্টা করা হয়।

### Location Block কী?

`location` block নির্দিষ্ট route/path handle করে।

যেমন:

- `/api/auth/login` route login request handle করে
- `/api/auth/register` route register request handle করে
- `/api` route general API request handle করে
- `/` route fallback/default request handle করে

Nginx সাধারণত সবচেয়ে specific matching location select করে। তাই `/api/health` route `/api` এর চেয়ে specific হওয়ায় health location match করবে।

### Login Endpoint

```nginx
    # Auth endpoints — extra strict rate limit
    location /api/auth/login {
```

এই block `/api/auth/login` route-এর request handle করবে।

```nginx
      limit_req zone=auth burst=3 nodelay;
```

এই route-এ `auth` rate limit zone apply করা হয়েছে।

ব্যাখ্যা:

- Base limit হলো প্রতি IP প্রতি minute 5 request
- `burst=3` মানে short spike হিসেবে অতিরিক্ত 3টি request allow/reject logic-এর মধ্যে রাখা যায়
- `nodelay` মানে burst request delay না করে immediately process করা হবে, limit cross করলে reject করা হবে

এই strict rate limit login brute-force attack কমাতে সাহায্য করে।

```nginx
      limit_req_status 429;
```

Rate limit exceed করলে Nginx `429 Too Many Requests` status code return করবে।

```nginx
      proxy_pass http://turfbook_app;
```

Request backend upstream `turfbook_app`-এ forward করা হবে।

কারণ `turfbook_app` upstream-এ `app:3000` define করা আছে, তাই request শেষ পর্যন্ত NestJS app-এ যাবে।

```nginx
      proxy_set_header Host              $host;
```

Original request-এর `Host` header backend-এ pass করা হবে।

Backend এর মাধ্যমে জানতে পারবে request কোন domain/host দিয়ে এসেছে।

```nginx
      proxy_set_header X-Real-IP         $remote_addr;
```

Client-এর real IP address backend-এ পাঠানো হবে।

```nginx
      proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

Proxy chain-এর IP list backend-এ পাঠানো হবে।

যদি আগে থেকেই `X-Forwarded-For` header থাকে, তাহলে তার সাথে current client IP add করা হবে।

```nginx
      proxy_set_header X-Forwarded-Proto $scheme;
```

Original request কোন protocol দিয়ে এসেছে তা backend-এ পাঠানো হবে।

Example:

- `http`
- `https`

```nginx
    }
```

এখানে login location block শেষ হয়েছে।

### Register Endpoint

```nginx
    location /api/auth/register {
```

এই block `/api/auth/register` route-এর request handle করবে।

```nginx
      limit_req zone=auth burst=3 nodelay;
```

Register endpoint-এও `auth` rate limit zone apply করা হয়েছে।

এটি spam registration বা automated fake account creation কমাতে সাহায্য করে।

```nginx
      limit_req_status 429;
```

Rate limit exceed করলে `429 Too Many Requests` response দেওয়া হবে।

```nginx
      proxy_pass http://turfbook_app;
```

Register request backend NestJS app-এ forward করা হবে।

```nginx
      proxy_set_header Host              $host;
      proxy_set_header X-Real-IP         $remote_addr;
      proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
```

এই header গুলো backend-এ original request-এর context পাঠায়:

- কোন host/domain দিয়ে request এসেছে
- client-এর real IP কী
- proxy chain-এ কোন কোন IP আছে
- request HTTP নাকি HTTPS দিয়ে এসেছে

```nginx
    }
```

এখানে register location block শেষ হয়েছে।

### General API Routes

```nginx
    # All other API routes
    location /api {
```

এই block `/api` দিয়ে শুরু হওয়া সব general API request handle করবে।

উদাহরণ:

- `/api/users`
- `/api/bookings`
- `/api/turfs`
- `/api/profile`

```nginx
      limit_req zone=api burst=20 nodelay;
```

General API route-এর জন্য `api` rate limit zone apply করা হয়েছে।

ব্যাখ্যা:

- Base limit হলো প্রতি IP প্রতি minute 30 request
- `burst=20` মানে temporary spike হিসেবে অতিরিক্ত 20 request handle করা যাবে
- `nodelay` মানে burst request delay না করে immediately process করা হবে

```nginx
      limit_req_status 429;
```

Rate limit exceed করলে `429 Too Many Requests` response দেওয়া হবে।

```nginx
      proxy_pass http://turfbook_app;
```

Request backend NestJS application-এ forward করা হবে।

```nginx
      proxy_set_header Host              $host;
      proxy_set_header X-Real-IP         $remote_addr;
      proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
```

এই header গুলো backend application-কে original client/request information দেয়।

```nginx
      proxy_http_version 1.1;
```

Backend-এর সাথে proxy request করার সময় HTTP version `1.1` ব্যবহার করা হবে।

Keepalive connection properly কাজ করার জন্য এটি important।

```nginx
      proxy_set_header Connection "";  # keepalive enable
```

`Connection` header empty করে দেওয়া হয়েছে, যাতে upstream keepalive properly কাজ করে।

এর ফলে backend connection reuse করা যায় এবং performance improve হয়।

```nginx
    }
```

এখানে general `/api` location block শেষ হয়েছে।

### Health Check Endpoint

```nginx
    # Health check — rate limit ছাড়া
    location /api/health {
```

এই block `/api/health` route handle করে।

Health check endpoint সাধারণত Docker, load balancer, monitoring tool, uptime checker ইত্যাদি নিয়মিত hit করে app alive আছে কি না check করার জন্য।

```nginx
      proxy_pass http://turfbook_app;
```

Health check request backend NestJS app-এ forward করা হবে।

```nginx
      proxy_set_header Host $host;
```

Original host header backend-এ পাঠানো হবে।

```nginx
      access_log off;  # health check log এ ভরে যাবে না
```

Health check request access log-এ save করা হবে না।

কারণ monitoring tool ঘন ঘন health endpoint hit করতে পারে। এগুলো log করলে access log unnecessary বড় হয়ে যেতে পারে।

```nginx
    }
```

এখানে health check location block শেষ হয়েছে।

Note: এই config-এ `/api/health` block `/api` block-এর পরে আছে। তবুও Nginx prefix matching-এ longest matching prefix select করে, তাই `/api/health` সাধারণত `/api` এর চেয়ে বেশি specific match পাবে।

### Default Route / Fallback

```nginx
    # 404 for everything else
    location / {
```

যে request কোনো API route-এর সাথে match করবে না, তা এই default location block-এ আসবে।

```nginx
      return 404 '{"message":"Not found"}';
```

Nginx সরাসরি `404 Not Found` response return করবে।

Response body হবে:

```json
{ "message": "Not found" }
```

```nginx
      add_header Content-Type application/json;
```

Response-এর content type JSON হিসেবে set করা হয়েছে।

```nginx
    }
```

এখানে default location block শেষ হয়েছে।

```nginx
  }
```

এখানে `server` block শেষ হয়েছে।

```nginx
}
```

এখানে `http` block শেষ হয়েছে।

## এই Config-এর Main Purpose

এই Nginx configuration backend application-এর সামনে একটি gateway/protective layer হিসেবে কাজ করছে।

Main কাজগুলো:

- Port `80`-তে client request receive করা
- `/api` request backend NestJS app-এ forward করা
- Login/register endpoint-এ strict rate limit দেওয়া
- General API endpoint-এ normal rate limit দেওয়া
- বড় request body block করা
- Gzip compression enable করা
- Security headers add করা
- Health check endpoint-এর access log বন্ধ রাখা
- Unknown route-এ JSON `404` response দেওয়া

## Production Notes

- এই config বর্তমানে HTTP port `80` ব্যবহার করছে। Production environment-এ HTTPS ব্যবহার করতে হলে SSL certificate এবং `listen 443 ssl;` configuration add করতে হবে।
- `app:3000` Docker Compose service name-এর উপর depend করে। Backend service name change হলে এই value update করতে হবে।
- `client_max_body_size 10M` file upload feature থাকলে requirement অনুযায়ী বাড়াতে হতে পারে।
- `X-XSS-Protection` একটি legacy security header। Modern setup-এ Content Security Policy বা `CSP` যোগ করা ভালো।
- Rate limit value real traffic অনুযায়ী tune করা উচিত।
- যদি API-তে long-running request থাকে, তাহলে `proxy_read_timeout` adjust করতে হতে পারে।
