# Implementation Plan: Ankelba Parent & Guardian Mobile App (Exact Figma Match)

Develop the complete cross-platform mobile application for **Ankelba** dedicated to parents and guardians. Every single screen is built to be a **100% pixel-perfect match** to the visual designs exported in `frontend/design/`, utilizing vanilla React Native `StyleSheet.create`, Phosphor vector icons, and direct backend API integration.

---

## 🎨 Design System Specifications (Extracted from Figma Mocks)

| Token | Value | Applied To |
|---|---|---|
| **App Background** | `#FFFDF8` | Universal screen background (warm light cream) |
| **Card Surface** | `#FFFFFF` | All content cards, child profile cards, white chat bubbles |
| **Primary Navy** | `#061224` | Primary pill CTA buttons, active navigation states, strong headings |
| **Caregiver Navy** | `#081E38` | Special dark card surface for Caregiver Notes |
| **Input Surface** | `#ECE8E1` | Text field background on Login, Forms, and OTP |
| **Meals Yellow** | `#FEF7E6` (Text: `#B7791F`) | Meal highlight cards & timeline nodes |
| **Sleep Lavender** | `#F3EEF9` (Text: `#7E57C2`) | Nap highlight cards, AI chat bubbles |
| **Learning Cyan** | `#E6F8F9` (Text: `#00838F`) | Learning activity cards |
| **Play Sage Green** | `#EDF7ED` (Text: `#2E7D32`) | Outdoor play cards |
| **Mood Rose** | `#FDECEE` (Text: `#C2185B`) | Mood badges & absent status pills |
| **Observation Blush** | `#FCEEF2` (Text: `#AD1457`) | Caregiver observation card |
| **Verified Green** | `#E8F8EE` (Text: `#2E7D32`) | "● AT DAYCARE", "✓ Auth", pickup verified badges |
| **Pill Radius** | `9999` | Buttons, category filters, quick action pills |
| **Card Radius** | `22` | Content containers, child cards, highlights |

---

## 📅 Phased Execution Breakdown

### ✅ Phase 1: Core Foundation & Scaffolding [COMPLETED]
- [x] Initialized Expo SDK with TypeScript in [frontend/](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/).
- [x] Installed dependencies: React Navigation, `phosphor-react-native`, `react-native-svg`, `axios`, `expo-secure-store`, `lottie-react-native`.
- [x] Created design tokens: [src/theme/tokens.ts](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/theme/tokens.ts).
- [x] Created TypeScript domain contracts: [src/types/index.ts](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/types/index.ts).
- [x] Created Axios API client: [src/api/client.ts](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/api/client.ts).
- [x] Created [AuthContext.tsx](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/context/AuthContext.tsx) & [ChildContext.tsx](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/context/ChildContext.tsx).
- [x] Type check verified: 0 errors.

---

### Phase 2: Design System Primitives & Global Navigation Shell
Build the reusable UI components and the custom 5-tab floating bottom navigation.

#### Reusable Components:
1. **`PillButton`**: Dark navy pill (`#061224`, `borderRadius: 9999`) with white text, bold font, and optional trailing arrow (`➔`).
2. **`TopBar`**: Left brand logo mark + "Ankelba" wordmark, right notification bell with unread indicator (`BellSimple`), and circular parent avatar with colored rim.
3. **`HighlightCard`**: 2-column pastel card with rounded icon badge, uppercase category label (`MEALS`, `SLEEP`, `PLAY`, etc.), and large status copy.
4. **`ConnectedTimelineNode`**: Chronological vertical line connecting each event with category-tinted circular icon, timestamp badge, title, and description.
5. **`StatusBadge`**: Pill badge (`● AT DAYCARE`, `● Present`, `● Absent`, `READY`).
6. **`SafetyDisclaimer`**: Alert card with amber/red icon and mandatory legal compliance text (SRS FR-HIR-06, FR-AI-05, FR-BIO-01).

#### Navigation Shell:
* **[src/navigation/MainTabNavigator.tsx](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/navigation/MainTabNavigator.tsx)**:
  * Custom 5-tab floating bottom bar matching [Home Dashboradapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Home%20Dashboradapp-layout.png):
    * **HOME** (`House`)
    * **REPORTS** (`ClipboardText`)
    * **MESSAGES** (`ChatCircleDots`)
    * **CALENDAR** (`CalendarBlank`)
    * **PROFILE** (`User`)
  * Active state: Dark icon, bold label, soft active background square.
  * Inactive state: Outlined icon, muted grey text.
* **[src/navigation/RootNavigator.tsx](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/src/navigation/RootNavigator.tsx)**: Stack navigator for Auth + Detail Modals.

---

### Phase 3: Auth & Onboarding Flow (Pixel-for-Pixel Matching)

| Screen | Target Figma Mock | Layout & Visual Elements | Backend API |
|---|---|---|---|
| **Splash Screen** | [Splash Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Splash%20Pageapp-layout.png) | Cultural *ankelba* mother/child wrap illustration, "Ankelba — CONNECT • SHARE • NURTURE", tagline, progress dots, "Get Started ➔" button. | Validates local stored token |
| **Onboarding Walkthrough** | [Onboardingapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Onboardingapp-layout.png), [Onboarding 1](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Onboarding%201app-layout.png), [Onboarding 2](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Onboarding%202app-layout.png) | 3-slide carousel: *Know Their Day* (blocks), *Safe & Supportive* (shield), *Stay Connected* (dialogue). Indicator dots, "Next ➔", and "Skip" link. | None (Client storage) |
| **Login Screen** | [Login Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Login%20Pageapp-layout.png) | "Welcome Back", input field with user icon, password field with lock + eye toggle, "Forgot Password?", "Sign In ➔" button, admin notice at bottom. | `POST /api/auth/login` |
| **Forgot Password** | [Forgot Password Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Forgot%20Password%20Pageapp-layout.png) | Email input, instructional text, "Send Verification Code ➔". | `POST /api/auth/forgot-password` |
| **OTP Verification** | [OTP Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Verification%20Code/OTP%20Pageapp-layout.png) | 4-digit code entry boxes, timer countdown, "Verify & Proceed ➔". | `POST /api/auth/verify-otp` |

---

### Phase 4: Core Parent Dashboard & Activity Tracking

| Screen | Target Figma Mock | Layout & Visual Elements | Backend API |
|---|---|---|---|
| **Home Dashboard** | [Home Dashboradapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Home%20Dashboradapp-layout.png) | • Greeting *"Good morning, Hana 👋"*<br>• Child card: Liya, `● AT DAYCARE` green badge, check-in 8:04 AM<br>• 4 Quick Actions (Message, Report, Ask AI, Calendar)<br>• 2×3 Highlights (Meals, Sleep, Learning, Play, Mood, Observation)<br>• Latest Activity photo preview (*"Painting Time 🎨"* 10:30 AM)<br>• Caregiver quote card with *"↩ Reply to Sara"* button<br>• Upcoming event card (*"Parent Meeting AUG 28"*) | • `GET /api/auth/me`<br>• `GET /api/attendance/child/:id`<br>• `GET /api/reports/daily/child/:id`<br>• `GET /api/events` |
| **Full Daily Report** | [Full Daily Reportapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Full%20Daily%20Reportapp-layout.png) | • Header: Liya's Day, Tuesday August 25<br>• Attendance: Checked in 8:04 AM, Check-out: Not yet<br>• Vertical timeline (Check In ➔ Breakfast ➔ Learning ➔ Play ➔ Lunch ➔ Nap ➔ Art)<br>• Daily Summary matrix (Mood, Behavior, Health, General)<br>• Dark navy Caregiver Note card from Sara<br>• Button: *"💬 Message Caregiver"* | • `GET /api/reports/daily/:id`<br>• `GET /api/attendance/child/:id` |
| **Reports History** | [Report Historyapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Report%20Historyapp-layout.png) | • Child selector dropdown<br>• Filter chips: Today, This Week, This Month, All<br>• Cards with `● Present` or `● Absent` badges, mood chips, update count (`⏱ 6 updates`), *"View Report ➔"* | • `GET /api/reports/daily/child/:id` |
| **Child Profile Page** | [Child Profile Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Child%20Profile%20Pageapp-layout.png) | • Child photo, `● At Daycare`, 4 years • Sunflower Group<br>• Basic Info: DOB (May 12, 2020), Amharic/English, 92% attendance bar<br>• Care & Safety: Lead caregiver Sara M., Meal preferences (mild food/injera), care instructions, allergy alert<br>• Family & Contacts: Mother (Primary), Father (Authorized) + *"👥 View All Authorized Pickups"* | • `GET /api/children/:id`<br>• `GET /api/attendance/summary?child_id=:id` |

---

### Phase 5: Safety, Biometrics & Communication

| Screen | Target Figma Mock | Layout & Visual Elements | Backend API |
|---|---|---|---|
| **Authorized Guardians** | [Authorized Guardiansapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Authorized%20Guardiansapp-layout.png) | List of authorized pickup adults with relationship badges and biometric enrollment checkmark + *"Add Guardian"* button. | `GET /api/children/:id/guardians` |
| **Add Guardian** | [Add Guardianapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Guardian%20Details/Add%20Guardianapp-layout.png) | Form: Full Name, Relationship dropdown, Phone (+251), Email, legal security banner ("Child biometrics are not used"), *"Save Guardian"* CTA. | `POST /api/children/:id/guardians` |
| **Pickup Status Page** | [Pickup Status Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Pickup%20Verification/Pickup%20Status%20Pageapp-layout.png) | • 3-step progress bar (Identified ➔ Verified ➔ Check-out)<br>• Green glow card: *"Verified Successfully — Hana Tesfaye has been confirmed"*<br>• Child card + Guardian card<br>• Pickup Status card (*"READY"* badge, *"Liya can now be checked out"*), verified by Sara at 4:28 PM<br>• *"Complete Check-out ➔"* button | • `GET /api/biometric/guardian/:id`<br>• `POST /api/attendance` (checkout) |
| **Messages Hub** | [Messagesapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Messagesapp-layout.png) | Conversation threads list with caregiver avatars, online status, last message preview, unread badges. | `GET /api/messages` |
| **1-on-1 Caregiver Chat** | [Chat Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Chat%20Pageapp-layout.png) | Active thread with Sara (Caregiver): security note banner, blue caregiver bubbles with embedded activity photo card, white parent bubbles, text composer with attachment `(+)` icon and send button. | • `GET /api/messages/:threadId`<br>• `POST /api/messages` |

---

### Phase 6: Extended Modules (AI Guide, Store, Calendar, Profile)

| Screen | Target Figma Mock | Layout & Visual Elements | Backend API |
|---|---|---|---|
| **AI Parent Guide** | [AI chatapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/AI%20chatapp-layout.png) | • Subtitle *"Helpful everyday guidance..."*<br>• Child context pill (*"GUIDANCE FOR: Liya • 4 years"* )<br>• Quick pills (🎨 Activity Ideas, 🍴 Meals, 👕 Clothing, 🎒 Daycare Prep, ⏰ Routines)<br>• Chat stream with quick follow-ups (*"Another activity"*, *"Indoor ideas"*)<br>• Mandatory Medical Disclaimer alert box<br>• Input field with circular navy send button | `POST /api/ai/guide` |
| **Daycare Store** | [Daycare Store Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Daycare%20Store%20Pageapp-layout.png) | Search bar, category filters (All, Learning Materials, Hygiene, Art Supplies), 2-column cards with price in **ETB** (Exercise Book 120 ETB, Color Pencils 180 ETB), floating bottom cart summary (*"2 items • 300 ETB / View Cart"*). | • `GET /api/store/categories`<br>• `GET /api/store/products` |
| **Shopping Cart** | [Shopping Cart Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Shopping%20Cart%20Pageapp-layout.png) | Item cards with quantity incrementors (`- 1 +`), remove links, subtotal/total calculation in ETB, *"Proceed to Checkout ➔"*. | Local cart state |
| **Checkout Screen** | [checkoutapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/checkoutapp-layout.png) | Recipient card (*Order for Liya*), order summary, payment method radio: **Pay at Daycare** (selected default) vs. **Digital Payment**, security note, optional order note textarea, *"Place Order ✓"*. | `POST /api/store/orders` |
| **Payment Success** | [Payment Successapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Order%20Confirmation/Payment%20Successapp-layout.png) | Order confirmed checkmark, order ID, payment status, "Return to Home" button. | Order confirmation |
| **Events Calendar** | [Html Events Calendar Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Html%20%20Events%20Calendar%20Pageapp-layout.png) | August 2026 month picker, calendar date matrix with event dots, categorized upcoming events (Parent Meeting, Family Day, Holiday) with colored left bars. | `GET /api/events` |
| **Event Detail** | [Event Detailapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Event%20Detailapp-layout.png) | Detailed event agenda, room location, time range, "Add to Calendar" button. | `GET /api/events/:id` |
| **Parent Profile & Settings** | [Parent Profile & Settings Pageapp-layout.png](file:///c:/Users/Mistire/Desktop/final%20year%20project/frontend/design/Parent%20Profile%20&%20Settings%20Pageapp-layout.png) | Parent card (Hana Tesfaye, +251 91 123 4567), linked children card, quick cards (Guardians, My Orders), notification switches (Child Activity, Messages, Announcements), language, *"Log Out"* button. | • `GET /api/auth/me`<br>• `POST /api/auth/logout` |

---

### Phase 7: Polish, Lottie Animations & Final Verification
- Wire the `.lottie` animations from `assets/animations/` (`Baby & Mom Love.lottie` on Splash/Home, `Learning.lottie` on Learning Activity).
- Run full automated TypeScript type checks (`npx tsc --noEmit`).
- Validate end-to-end user navigation flows on both Web and Mobile previews.
- Ensure all SRS business rules (ETB currency, child biometrics prevention, medical interception, Pay at Daycare) are active.

---

## Verification Plan

### Automated Verification
1. `npx tsc --noEmit` on every phase completion to verify zero TypeScript regressions.
2. `npm run web` / `npx expo start` to test bundling and runtime execution.

### Visual Comparison Verification
Compare each rendered screen directly against its corresponding PNG in `frontend/design/` to guarantee identical spacing, borders, colors, icons, and typography.
