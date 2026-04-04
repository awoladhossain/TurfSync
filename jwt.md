# JWT (JSON Web Token) প্রমাণীকরণ সিস্টেম - বিস্তারিত ব্যাখ্যা

## সূচিপত্র
1. [JWT কী এবং কেন প্রয়োজন](#jwt-কী-এবং-কেন-প্রয়োজন)
2. [দুটি Strategy এর পার্থক্য](#দুটি-strategy-এর-পার্থক্য)
3. [jwt.strategy.ts বিস্তারিত ব্যাখ্যা](#jwtstrategyts-বিস্তারিত-ব্যাখ্যা)
4. [jwt-refresh.strategy.ts বিস্তারিত ব্যাখ্যা](#jwt-refreshstrategyts-বিস্তারিত-ব্যাখ্যা)
5. [কাজের প্রক্রিয়া](#কাজের-প্রক্রিয়া)
6. [নিরাপত্তা বিবেচনা](#নিরাপত্তা-বিবেচনা)

---

## JWT কী এবং কেন প্রয়োজন

### JWT এর ধারণা
JWT হল একটি সুরক্ষিত টোকেন যা ব্যবহারকারীর পরিচয়পত্র হিসেবে কাজ করে। এটি তিনটি অংশ নিয়ে গঠিত:

```
Header.Payload.Signature
```

- **Header**: টোকেনের প্রকার এবং এনকোডিং অ্যালগরিদম
- **Payload**: ব্যবহারকারীর তথ্য (claims)
- **Signature**: নিরাপত্তার জন্য স্বাক্ষর

### কেন দুটি টোকেন ব্যবহার করি?

এই সিস্টেমে আমরা দুটি ভিন্ন টোকেন ব্যবহার করি:

| বৈশিষ্ট্য | Access Token | Refresh Token |
|-----------|--------------|---------------|
| **উদ্দেশ্য** | API এক্সেস করতে | নতুন access token পেতে |
| **স্থায়িত্ব** | ছোট (১৫ মিনিট) | বড় (৭ দিন বা বেশি) |
| **নিরাপত্তা** | কম সংবেদনশীল | বেশি সংবেদনশীল |
| **সংরক্ষণ** | মেমরি/localStorage | secure cookie বা database |
| **স্বয়ংক্রিয় নবায়ন** | না, হ্যাঁ (refresh করে) | হ্যাঁ |

---

## দুটি Strategy এর পার্থক্য

### সংক্ষিপ্ত তুলনা

```
┌─────────────────────────────────────────────────────────┐
│                   JWT প্রবাহ চিত্র                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. লগইন করো                                              │
│     ↓                                                     │
│  2. Access Token + Refresh Token পাও                     │
│     ↓                                                     │
│  3. Access Token দিয়ে API কল করো (jwt strategy)         │
│     ↓                                                     │
│  4. Access Token মেয়াদ শেষ হলে? → Refresh Token দিয়    │
│     নতুন Access Token পাও (jwt-refresh strategy)          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## jwt.strategy.ts বিস্তারিত ব্যাখ্যা

### ফাইলের বিস্তারিত রূপরেখা

```typescript
// ১. প্রয়োজনীয় ইমপোর্টস
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// ২. JWT Payload ইন্টারফেস সংজ্ঞা
export interface JwtPayload {
  sub: string;      // Subject (ব্যবহারকারীর ID)
  email: string;    // ইমেইল
  role: string;     // ভূমিকা (admin, user ইত্যাদি)
}

// ৩. নেস্টজেস ডেকোরেটর - এটি একটি সেবা
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // constructor বাস্তবায়ন...
}
```

### প্রতিটি অংশের গভীর ব্যাখ্যা

#### Step 1: ইমপোর্টস কেন প্রয়োজন?

```typescript
import { PrismaService } from '@/prisma/prisma.service';
```
- **কারণ**: ডাটাবেসে ব্যবহারকারীর তথ্য খুঁজতে প্রয়োজন।

```typescript
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
```
- **কারণ**: Passport.js হল একটি প্রমাণীকরণ লাইব্রেরি যা JWT সামলায়। আমরা এর উপর ভিত্তি করে আমাদের নিজস্ব strategy তৈরি করছি।

#### Step 2: JwtPayload ইন্টারফেস

```typescript
export interface JwtPayload {
  sub: string;      // "sub" মানে Subject (JWT স্ট্যান্ডার্ড)
  email: string;
  role: string;
}
```

**এটি কী?**
- এটি বলে যে JWT টোকেনে কী কী তথ্য থাকবে।
- যখন টোকেন তৈরি করি, এই ফিল্ডগুলো যোগ করা হয়।

**কেন export করা?**
- অন্য ফাইলে ব্যবহার করার জন্য (যেমন jwt-refresh.strategy.ts)।

#### Step 3: Constructor - প্রধান সেটআপ

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }
}
```

**ExtractJwt.fromAuthHeaderAsBearerToken() কী করে?**

```
HTTP Header:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
              │────────────────────────────────────────────────│
              এই অংশটি বের করে
```

**ignoreExpiration: false কেন?**
- `false` = টোকেনের মেয়াদ চেক করো (নিরাপত্তার জন্য অত্যন্ত গুরুত্বপূর্ণ)
- `true` = মেয়াদ সম্পর্কে চিন্তা করবে না (ঝুঁকিপূর্ণ)

**secretOrKey কী?**
- এটি হল পাসওয়ার্ড যা দিয়ে JWT তৈরি করা হয়েছে।
- একই গোপন চাবি ছাড়া টোকেন যাচাই করা যায় না।
- পরিবেশ ভেরিয়েবল (`.env`) থেকে পড়া হয়।

#### Step 4: Validate Method - সবচেয়ে গুরুত্বপূর্ণ অংশ

```typescript
async validate(payload: JwtPayload) {
  // ধাপ 1: টোকেন থেকে ব্যবহারকারী ID পাও
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },  // payload.sub হল ব্যবহারকারী ID
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
    },
  });

  // ধাপ 2: ব্যবহারকারী বিদ্যমান কিনা চেক করো
  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  // ধাপ 3: ব্যবহারকারীর তথ্য ফেরত দাও
  return user; // এটি req.user এ যুক্ত হবে
}
```

**কেন এই পদক্ষেপ?**

1. **পেলোড থেকে পড়া**: JWT টোকেন ডিকোড হয়ে payload পাওয়া যায়।
2. **ডাটাবেস যাচাই**: শুধু টোকেন যাচাই যথেষ্ট নয়। আমরা নিশ্চিত করি ব্যবহারকারী সত্যিই বিদ্যমান এবং সক্রিয়।
3. **তথ্য সংগ্রহ**: সর্বশেষ ব্যবহারকারী তথ্য পাই (যেমন: বর্তমান ভূমিকা বা যাচাইকরণ অবস্থা)।

**কেন সব ফিল্ড নির্বাচন করি না?**

```typescript
select: {
  id: true,
  email: true,
  name: true,
  role: true,
  isVerified: true,
}
```

- **নিরাপত্তা**: পাসওয়ার্ড হ্যাশ বা সংবেদনশীল ডেটা অন্তর্ভুক্ত করি না।
- **কর্মক্ষমতা**: শুধুমাত্র প্রয়োজনীয় ডেটা যাচাই করে নেটওয়ার্ক লোড কমাই।

---

## jwt-refresh.strategy.ts বিস্তারিত ব্যাখ্যা

### ফাইলের বিস্তারিত রূপরেখা

```typescript
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',  // ← ভিন্ন নাম ('jwt' এর পরিবর্তে 'jwt-refresh')
) {
  // পুরো বাস্তবায়ন...
}
```

**'jwt-refresh' নাম কেন?**
- আমরা দুটি ভিন্ন strategy ব্যবহার করছি একই প্যাকেজ থেকে।
- এই নাম দিয়ে আমরা এন্ডপয়েন্টে বলি কোন strategy ব্যবহার করতে হবে:
  ```typescript
  @UseGuards(AuthGuard('jwt'))          // এক্সেস টোকেনের জন্য
  @UseGuards(AuthGuard('jwt-refresh'))  // রিফ্রেশ টোকেনের জন্য
  ```

### Constructor - সেটআপ

```typescript
constructor(
  private configService: ConfigService,
  private prisma: PrismaService,
) {
  super({
    jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
    // ↓ এটি jwt.strategy থেকে ভিন্ন!
    ignoreExpiration: false,
    secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') as string,
    // ↓ সম্পূর্ণ অতিরিক্ত প্যারামিটার
    passReqToCallback: true,
  });
}
```

#### ExtractJwt.fromBodyField('refreshToken') কেন?

```
Access Token: Authorization হেডারে থাকে
Authorization: Bearer <access-token>

Refresh Token: রিকোয়েস্ট বডিতে থাকে
POST /refresh
{
  "refreshToken": "eyJhbGci..."
}
```

**কেন পার্থক্য?**
- **নিরাপত্তা**: Refresh Token বডিতে রাখি কারণ এটি বেশি সংবেদনশীল।
- **নমনীয়তা**: বিভিন্ন কৌশল ব্যবহার করে APIs আরও নমনীয় হয়।

#### passReqToCallback: true কেন?

```typescript
async validate(req: Request, payload: JwtPayload) {
  // ↓ req পাওয়ার জন্য passReqToCallback: true প্রয়োজন
  const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
}
```

**এর মানে?**
- সাধারণত `validate(payload)` মাত্র পায়।
- `true` করলে req অবজেক্ট পায় যাতে প্রকৃত টোকেন বের করতে পারে।

#### JWT_REFRESH_SECRET কেন আলাদা?

```
jwt.strategy:
  secretOrKey: JWT_SECRET

jwt-refresh.strategy:
  secretOrKey: JWT_REFRESH_SECRET
```

**নিরাপত্তা নীতি:**
- প্রতিটি টোকেন টাইপের নিজস্ব গোপন চাবি থাকা উচিত।
- একটি গোপন চাবি ফাঁস হলেও অন্যটি নিরাপদ থাকে।

### Validate Method - ডাটাবেস গুরুত্বপূর্ণ!

```typescript
async validate(req: Request, payload: JwtPayload) {
  // ধাপ 1: Payload যাচাই
  if (!payload) throw new UnauthorizedException();

  // ধাপ 2: বডি থেকে টোকেন বের করো
  const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;

  // ধাপ 3: টোকেন উপস্থিত কিনা চেক করো
  if (!refreshToken) {
    throw new UnauthorizedException(
      'Refresh token is missing in request body',
    );
  }

  // ধাপ 4: ডাটাবেসে টোকেন খুঁজো
  const tokenRecord = await this.prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  // ধাপ 5: মেয়াদ এবং বৈধতা চেক করো
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  // ধাপ 6: ব্যবহারকারী সাথে রিটার্ন করো
  return {
    ...tokenRecord.user,
    refreshToken,
  };
}
```

**এটি jwt.strategy থেকে আলাদা কেন?**

| দিক | jwt.strategy | jwt-refresh.strategy |
|-----|--------------|----------------------|
| **ডাটাবেস চেক** | শুধু user টেবিল | refreshToken টেবিল + user |
| **মেয়াদ চেক** | JWT এ এনকোডেড | ডাটাবেসের expiresAt ফিল্ড |
| **উদ্দেশ্য** | API এ ইতিমধ্যে লগ-ইনকৃত ব্যবহারকারী? | এই রিফ্রেশ টোকেন বৈধ? |

### কেন refreshToken টেবিলে সংরক্ষণ করি?

**কারণ:**

1. **ব্ল্যাকলিস্ট করতে পারি**:
   ```sql
   DELETE FROM "RefreshToken" WHERE token = '...';
   // টোকেন তাৎক্ষণিক অকার্যকর হয়েছে
   ```

2. **ব্যবহারকারী লগআউট**: একাধিক ডিভাইসে লগইন থাকতে পারে, নির্দিষ্ট টোকেন বাতিল করতে পারি।

3. **নিরাপত্তা**: টোকেন চুরি হলে ডাটাবেসে টোকেন ফ্ল্যাগ করে দিতে পারি।

---

## কাজের প্রক্রিয়া

### সম্পূর্ণ প্রবাহ (Step-by-Step)

```
1️⃣  লগইন এন্ডপয়েন্ট কল
    ↓
    [লগইন সফল]
    ↓
2️⃣  JWT তোকেন তৈরি:
    - Access Token (১৫ মিনিট মেয়াদ)
    - Refresh Token (৭ দিন মেয়াদ, ডাটাবেসে সংরক্ষিত)
    ↓
3️⃣  ক্লায়েন্ট গ্রহণ করে এবং সংরক্ষণ করে

4️⃣  API কল করার সময়:
    POST /api/posts
    Authorization: Bearer <Access-Token>
    ↓
    [JwtStrategy চালু হয়]
    ↓
    - Bearer টোকেন বের করো
    - JWT_SECRET দিয়ে যাচাই করো
    - Payload পাও (sub, email, role)
    - ডাটাবেসে ব্যবহারকারী খুঁজো
    - req.user এ যুক্ত করো
    ↓
5️⃣  কন্ট্রোলার/সার্ভিস: req.user ব্যবহার করে

6️⃣  Access Token মেয়াদ শেষ হলে:
    POST /refresh
    {
      "refreshToken": "<Refresh-Token>"
    }
    ↓
    [JwtRefreshStrategy চালু হয়]
    ↓
    - বডি থেকে রিফ্রেশ টোকেন বের করো
    - JWT_REFRESH_SECRET দিয়ে যাচাই করো
    - ডাটাবেসে টোকেন খুঁজো
    - মেয়াদ চেক করো
    - নতুন Access Token তৈরি করো
    ↓
7️⃣  ক্লায়েন্ট নতুন Access Token পায় এবং আবার ব্যবহার করে
```

---

## নিরাপত্তা বিবেচনা

### ১. দুটি আলাদা গোপন চাবি কেন?

```
JWT_SECRET ফাঁস → শুধু Access Token ব্যবহার করতে পারবে (১৫ মিনিট)
JWT_REFRESH_SECRET ফাঁস → শুধু Refresh Token ব্যবহার করতে পারবে

উভয় ফাঁস → সম্পূর্ণ অ্যাক্সেস
```

### ২. মেয়াদ যাচাইকরণ

```typescript
// jwt.strategy: JWT এ এনকোডেড মেয়াদ
// └─ দ্রুত (কোন ডাটাবেস কল প্রয়োজন নেই)

// jwt-refresh.strategy: ডাটাবেসে সংরক্ষিত মেয়াদ
// └─ নমনীয় (টোকেন প্রত্যাহার করতে পারি)
```

### ৩. তথ্য সংগ্রহ নীতি

```typescript
// ❌ এড়িয়ে চলো:
select: {
  password: true,        // পাসওয়ার্ড হ্যাশ কখনো ফেরত দিবে না
  passwordResetToken: true,
  twoFactorSecret: true,
}

// ✅ করো:
select: {
  id: true,
  email: true,
  role: true,
  isVerified: true,
}
```

### ৪. Refresh Token সংরক্ষণ

```
মেমরিতে:   ❌ ব্রাউজার রিলোড হলে হারিয়ে যাবে
localStorage: ❌ XSS আক্রমণে চুরি হতে পারে
httpOnly Cookie: ✅ JavaScript এক্সেস করতে পারে না
Database: ✅ সার্ভার-সাইড নিয়ন্ত্রণ + রিভোকেশন
```

---

## সংক্ষেপ: কেন এই ডিজাইন?

### এক্সেস টোকেন (১৫ মিনিট)
- ✅ দ্রুত যাচাইকরণ (ডাটাবেস বিহীন)
- ✅ স্টেটলেস (মাইক্রোসার্ভিসের জন্য আদর্শ)
- ❌ মেয়াদ শেষ হলে নতুন টোকেন প্রয়োজন

### রিফ্রেশ টোকেন (দীর্ঘমেয়াদী)
- ✅ দীর্ঘ মেয়াদের জন্য উপযুক্ত
- ✅ অপারেশনের ঝামেলা ছাড়াই লগইন রাখে
- ✅ সার্ভার থেকে প্রত্যাহার করতে পারি
- ❌ প্রতিটি ব্যবহারে ডাটাবেস কল (কিন্তু প্রায়ই কল হয় না)

### এই ডিজাইন কেন সেরা?

```
নিরাপত্তা + কর্মক্ষমতা + নমনীয়তা
   │           │           │
   └─────┬─────┴─────┬─────┘
         │           │
    দুটি ভিন্ন      আলাদা
    টোকেন টাইপ    গোপন চাবি
```

---

## বাস্তবিক উদাহরণ: সম্পূর্ণ প্রবাহ

### স্টেপ ১: লগইন
```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### স্টেপ ২: সুরক্ষিত এন্ডপয়েন্ট অ্যাক্সেস
```bash
GET /api/posts
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
           │
           └─→ JwtStrategy শুরু হয়
               - Bearer token বের করো
               - JWT_SECRET দিয়ে যাচাই করো
               - Payload: {sub: 'user-id', email: '...', role: 'user'}
               - ডাটাবেসে user খুঁজো
               - req.user = {...user data}
               - কন্ট্রোলার অ্যাক্সেস
```

### স্টেপ ৩: Access Token মেয়াদ শেষ (১৫ মিনিট পরে)
```bash
GET /api/posts
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
               ↓
               ❌ Token expired!

Response:
{
  "statusCode": 401,
  "message": "Unauthorized"
}

ক্লায়েন্ট স্বয়ংক্রিয়ভাবে রিফ্রেশ করে:
```

### স্টেপ ৪: Refresh করা
```bash
POST /auth/refresh
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

JwtRefreshStrategy শুরু হয়:
- বডি থেকে refreshToken বের করো
- JWT_REFRESH_SECRET দিয়ে যাচাই করো
- "RefreshToken" টেবিলে খুঁজো
- expiresAt > currentDate? ✅
- নতুন accessToken তৈরি করো

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..." (আপডেটেড)
}
```

### স্টেপ ৫: নতুন Token দিয়ে আবার কাজ করা
```bash
GET /api/posts
Authorization: Bearer <NEW-accessToken>
               ↓
               ✅ কাজ করছে!
```

---

## সারসংক্ষেপ টেবিল

| প্রশ্ন | উত্তর |
|------|-------|
| **JwtStrategy কখন কাজ করে?** | API কল করার সময় (প্রতিটি রিকোয়েস্টে) |
| **JwtRefreshStrategy কখন কাজ করে?** | নতুন Access Token চাইলে |
| **কেন দুটি Strategy?** | ভিন্ন উদ্দেশ্য, ভিন্ন নিরাপত্তা স্তর |
| **কেন দুটি গোপন চাবি?** | একটি ফাঁস হলে অন্যটি সুরক্ষিত থাকে |
| **কেন validate method এ ডাটাবেস চেক?** | টোকেন বৈধ কিন্তু ব্যবহারকারী বাতিল হতে পারে |
| **Refresh Token কেন ডাটাবেসে?** | প্রয়োজনে প্রত্যাহার করতে (লগআউট) |

---

## তৈরি করা: ২০২৬ সালের ৪ এপ্রিল
এই ডকুমেন্টেশন TurfBook প্রকল্পের JWT প্রমাণীকরণ সিস্টেম ব্যাখ্যা করে।
