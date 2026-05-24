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

## Worker Process

```nginx
# Worker processes — CPU core এর সমান রাখো
worker_processes auto;
```

`worker_processes auto;` মানে Nginx server-এর CPU core অনুযায়ী automatically worker process চালাবে।

Worker process হলো সেই process যেগুলো client request handle করে। `auto` দিলে Nginx নিজে decide করে কতগুলো worker process চালানো best হবে। এতে CPU resource ভালোভাবে ব্যবহার হয়।

## Events Block

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

এখানে `events` block শেষ হয়েছে।

## HTTP Block

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

## MIME Type Settings

```nginx
  # Basic settings
  include       /etc/nginx/mime.types;
```

এই line Nginx-এর built-in MIME type list include করে।

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

`application/octet-stream` হলো generic binary data type।

## Logging Format

```nginx
  # Logging format
  log_format main '$remote_addr - $remote_user [$time_local] '
                  '"$request" $status $body_bytes_sent '
                  '"$http_referer" "$http_user_agent"';
```

এখানে `main` নামে একটি custom access log format define করা হয়েছে।

এই format অনুযায়ী access log-এ নিচের তথ্যগুলো থাকবে:

- `$remote_addr`: client-এর IP address
- `$remote_user`: authenticated user, যদি থাকে
- `$time_local`: request আসার সময়
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

```nginx
  error_log  /var/log/nginx/error.log warn;
```

Nginx error log `/var/log/nginx/error.log` file-এ save হবে।

`warn` মানে warning level এবং তার চেয়ে serious error log করা হবে।

## Performance Settings

```nginx
  # Performance
  sendfile        on;
```

`sendfile on;` static file serve করার সময় kernel-level optimization ব্যবহার করে। এতে file serving faster হয় এবং CPU usage কমে।

```nginx
  tcp_nopush      on;
```

`tcp_nopush on;` TCP packet optimization করে। সাধারণত `sendfile` এর সাথে ব্যবহার করলে বড় response বা static file efficient ভাবে পাঠানো যায়।

```nginx
  keepalive_timeout 65;
```

Client connection idle থাকলে 65 seconds পর্যন্ত open রাখা হবে।

এর ফলে একই client বারবার request করলে প্রতিবার নতুন TCP connection তৈরি করার প্রয়োজন কমে যায়। এতে performance improve হয়।

## Gzip Compression

```nginx
  # Gzip — response compress করো → কম bandwidth
  gzip on;
```

`gzip on;` response compression enable করে।

Text-based response compress হলে response size কমে যায়। ফলে bandwidth কম লাগে এবং response দ্রুত client-এর কাছে যেতে পারে।

```nginx
  gzip_vary on;
```

এই setting response header-এ `Vary: Accept-Encoding` যোগ করে।

এটি cache/proxy system-কে জানায় যে client gzip support করে কি না তার উপর response ভিন্ন হতে পারে।

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

## Rate Limiting Zone

```nginx
  # Rate limiting zone define করো
  # 10mb memory তে IP গুলো track করো
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
```

এখানে `api` নামে একটি rate limit zone তৈরি করা হয়েছে।

ব্যাখ্যা:

- `$binary_remote_addr`: client IP address memory-efficient binary format-এ store করে
- `zone=api:10m`: `api` নামে 10 MB shared memory zone তৈরি করে
- `rate=30r/m`: প্রতি IP প্রতি minute সর্বোচ্চ 30টি request করতে পারবে

এই zone সাধারণ API route-এর জন্য ব্যবহার করা হয়েছে।

```nginx
  limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
```

এখানে `auth` নামে আরেকটি rate limit zone তৈরি করা হয়েছে।

ব্যাখ্যা:

- এই zone login/register endpoint-এর জন্য ব্যবহার করা হয়েছে
- প্রতি IP প্রতি minute সর্বোচ্চ 5টি request করতে পারবে
- brute-force login attack বা spam registration কমাতে সাহায্য করে

## Upstream Backend

```nginx
  # Upstream — NestJS app
  upstream turfbook_app {
```

`upstream` block backend server group define করে। এখানে group-এর নাম `turfbook_app`।

পরবর্তীতে `proxy_pass http://turfbook_app;` ব্যবহার করে request এই backend group-এ পাঠানো হবে।

```nginx
    server app:3000;  # docker-compose service name
```

Backend application-এর address হলো `app:3000`।

Docker Compose environment-এ `app` সাধারণত backend service/container-এর নাম। একই Docker network-এর মধ্যে Nginx `app` নাম দিয়ে backend container খুঁজে পায়।

`3000` হলো NestJS application-এর port।

```nginx
    keepalive 32;
```

Nginx backend app-এর সাথে maximum 32টি idle keepalive connection maintain করতে পারবে।

এতে repeated API request faster হয়, কারণ প্রতিবার backend-এর সাথে নতুন connection তৈরি করতে হয় না।

```nginx
  }
```

এখানে `upstream turfbook_app` block শেষ হয়েছে।

## Server Block

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

```nginx
    server_name _;
```

`server_name _;` সাধারণত catch-all server name হিসেবে ব্যবহার করা হয়।

মানে, নির্দিষ্ট কোনো domain match না করলেও এই server block request handle করবে।

## Request Size Limit

```nginx
    # Request size limit — কেউ giant payload পাঠাতে পারবে না
    client_max_body_size 10M;
```

Client request body maximum `10M`, অর্থাৎ 10 MB হতে পারবে।

যদি কেউ 10 MB-এর বেশি request body পাঠায়, তাহলে Nginx request reject করতে পারে এবং সাধারণত `413 Request Entity Too Large` response দেয়।

এটি বড় payload attack বা accidental large upload থেকে backend-কে protect করে।

## Proxy Timeout Settings

```nginx
    # Timeout settings
    proxy_connect_timeout 60s;
```

Nginx backend application-এর সাথে connection establish করার জন্য maximum 60 seconds wait করবে।

```nginx
    proxy_send_timeout    60s;
```

Nginx backend application-এর কাছে request পাঠানোর সময় maximum 60 seconds wait করবে।

```nginx
    proxy_read_timeout    60s;
```

Nginx backend application থেকে response read করার জন্য maximum 60 seconds wait করবে।

যদি backend 60 seconds-এর মধ্যে response না দেয়, তাহলে timeout হতে পারে।

## Security Headers

```nginx
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
```

এই header browser-কে বলে, এই site শুধুমাত্র same origin-এর frame/iframe-এর মধ্যে load হতে পারবে।

এটি clickjacking attack কমাতে সাহায্য করে।

```nginx
    add_header X-Content-Type-Options "nosniff" always;
```

এই header browser-কে বলে MIME type guess/sniff না করতে।

Browser declared content type follow করবে। এতে কিছু content-type based security issue কমে।

```nginx
    add_header X-XSS-Protection "1; mode=block" always;
```

এই header পুরনো browser-এর built-in XSS filter enable করে এবং suspicious script detect করলে page block করতে বলে।

Modern browser-এ এই header mostly legacy, তবে পুরনো browser support-এর জন্য রাখা হয়েছে।

```nginx
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

এই header browser referrer information কতটুকু পাঠাবে তা control করে।

`strict-origin-when-cross-origin` মানে:

- Same-origin request হলে full referrer URL পাঠাবে
- Cross-origin HTTPS request হলে শুধু origin পাঠাবে
- HTTPS থেকে HTTP downgrade হলে referrer পাঠাবে না

```nginx
    ...
    always;
```

`always` ব্যবহার করলে error response-এর ক্ষেত্রেও header যোগ করার চেষ্টা করা হয়।

## Location Block কী?

`location` block নির্দিষ্ট route/path handle করে।

যেমন:

- `/api/auth/login` route login request handle করে
- `/api/auth/register` route register request handle করে
- `/api` route general API request handle করে
- `/` route fallback/default request handle করে

Nginx সাধারণত সবচেয়ে specific matching location select করে। তাই `/api/health` route `/api` এর চেয়ে specific হওয়ায় health location match করবে।

## Login Endpoint

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

## Register Endpoint

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

## General API Routes

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

## Health Check Endpoint

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

## Default Route / Fallback

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
{"message":"Not found"}
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
