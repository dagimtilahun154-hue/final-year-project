# Ankelba Backend Documentation — TypeScript Models, DTOs & Enums

**Target Audience:** Frontend Architects, TypeScript Developers, Mobile Developers  
**Purpose:** Ready-to-copy TypeScript interfaces, DTOs, Enums, and API Client setup to build type-safe UI components.

---

## 1. Domain Enums

```typescript
// Authentication & Roles
export type Role = 'admin' | 'caregiver' | 'parent';
export type UserStatus = 'active' | 'inactive';

// Children & Classroom
export type Gender = 'male' | 'female';
export type EnrollmentStatus = 'active' | 'inactive' | 'graduated';
export type CareInstructionType = 'allergy' | 'diet' | 'medical' | 'general';

// Attendance & Daily Reports
export type AttendanceType = 'checkin' | 'checkout';
export type Mood = 'happy' | 'playful' | 'fussy' | 'tired' | 'calm';
export type MealType = 'breakfast' | 'lunch' | 'snack';
export type PortionConsumed = 'all' | 'most' | 'half' | 'little' | 'none';
export type ActivityType =
  | 'arts_and_crafts'
  | 'outdoor_play'
  | 'reading'
  | 'nap'
  | 'sensory'
  | 'other';

// Health & Communication
export type HealthRecordType = 'illness' | 'injury' | 'observation';
export type Severity = 'low' | 'medium' | 'high';
export type Audience = 'all' | 'parents' | 'caregivers';

// Store & Payments
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PaymentMethod = 'pay_at_daycare' | 'digital';

// Biometrics
export type BiometricModality = 'fingerprint' | 'facial';
export type VerificationMode = 'biometric' | 'manual_fallback';
export type VerificationStatus = 'verified' | 'rejected';
```

---

## 2. Core Entity Interfaces

```typescript
// ─── USER & AUTH ───
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  role_id: number;
  status: UserStatus;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface UserProfileMe extends User {
  linked_children?: ChildSummary[];
  assigned_children?: ChildSummary[];
}

export interface ChildSummary {
  id: number;
  full_name: string;
  dob?: string;
  gender?: Gender;
  enrollment_status: EnrollmentStatus;
  relationship?: string;
  group_name?: string;
}

// ─── CLASS GROUPS ───
export interface ClassGroup {
  id: number;
  name: string;
  description?: string;
  active_children_count: number;
  created_at: string;
}

// ─── CHILDREN & GUARDIANS ───
export interface EmergencyContact {
  id: number;
  child_id?: number;
  name: string;
  relationship: string;
  phone: string;
  is_primary: boolean;
}

export interface CareInstruction {
  id: number;
  child_id?: number;
  instruction_type: CareInstructionType;
  description: string;
  created_at: string;
}

export interface GuardianLink {
  id: number;
  child_id: number;
  parent_user_id: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  relationship: string;
  is_primary: boolean;
  can_pickup: boolean;
  biometric_enrolled: boolean;
  created_at: string;
}

export interface Child {
  id: number;
  full_name: string;
  dob: string;
  gender: Gender;
  enrollment_status: EnrollmentStatus;
  group_id?: number;
  group_name?: string;
  caregiver_id?: number;
  caregiver_name?: string;
  emergency_contacts?: EmergencyContact[];
  care_instructions?: CareInstruction[];
  created_at: string;
}

// ─── ATTENDANCE ───
export interface AttendanceEvent {
  id: number;
  child_id: number;
  recorded_by: number;
  recorded_by_name?: string;
  attendance_type: AttendanceType;
  timestamp: string;
  notes?: string;
}

export interface AttendanceGridItem {
  child_id: number;
  full_name: string;
  group_name?: string;
  caregiver_name?: string;
  latest_event_type: AttendanceType | null;
  latest_event_time: string | null;
}

export interface AttendanceSummaryChild {
  child_id: number;
  child_name: string;
  total_days_evaluated: number;
  days_present: number;
  days_absent: number;
  attendance_rate_percent: number;
  average_daily_stay_hours: number;
}

export interface AttendanceSummaryCenter {
  total_active_children: number;
  total_recorded_events_30d: number;
  overall_attendance_rate: string;
  average_daily_stay_hours: number;
}

// ─── DAILY ACTIVITY REPORTS ───
export interface ReportMeal {
  id?: number;
  report_id?: number;
  meal_type: MealType;
  food_items: string;
  portion_consumed: PortionConsumed;
  notes?: string;
}

export interface ReportActivity {
  id?: number;
  report_id?: number;
  activity_type: ActivityType;
  description: string;
  location?: string;
}

export interface DailyReport {
  id: number;
  child_id: number;
  child_name?: string;
  caregiver_id: number;
  caregiver_name?: string;
  report_date: string;
  mood: Mood;
  sleep_duration_min: number;
  activities_summary?: string;
  general_notes?: string;
  submitted_at: string;
  meals: ReportMeal[];
  activities: ReportActivity[];
}

export interface CaregiverMonitorItem {
  caregiver_id: number;
  caregiver_name: string;
  assigned_children: number;
  reports_submitted: number;
  reports_missing: number;
}

// ─── HEALTH & INCIDENTS ───
export interface HealthRecord {
  id: number;
  child_id: number;
  recorded_by?: number;
  recorded_by_name?: string;
  record_type: HealthRecordType;
  severity: Severity;
  description: string;
  symptoms?: string;
  action_taken?: string;
  parent_notified: boolean;
  notified_at?: string;
  created_at: string;
  disclaimer?: string;
}

// ─── COMMUNICATION ───
export interface Announcement {
  id: number;
  title: string;
  content: string;
  audience: Audience;
  is_pinned: boolean;
  author_name?: string;
  created_at: string;
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  sender_name?: string;
  recipient_id: number;
  recipient_name?: string;
  body: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface CenterAlert {
  id: number;
  title: string;
  message: string;
  urgency: Severity;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

// ─── EVENTS ───
export interface CenterEvent {
  id: number;
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  is_cancelled: boolean;
  created_at: string;
}

// ─── STORE & PAYMENTS ───
export interface ProductCategory {
  id: number;
  name: string;
  description?: string;
  product_count: number;
  created_at: string;
}

export interface Product {
  id: number;
  category_id?: number;
  category_name?: string;
  name: string;
  description: string;
  price: string;
  stock_quantity: number;
  image_url?: string;
  is_active: boolean;
}

export interface OrderItem {
  id?: number;
  product_id: number;
  product_name?: string;
  unit_price: string;
  quantity: number;
  subtotal: string;
}

export interface StoreOrder {
  id: number;
  user_id: number;
  user_name?: string;
  total_amount: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  notes?: string;
  items: OrderItem[];
  created_at: string;
}

export interface PaymentRecord {
  id: number;
  order_id: number;
  amount: string;
  currency: string;
  payment_method: PaymentMethod;
  status: string;
  gateway_tx_ref?: string;
  paid_at?: string;
}

// ─── AI PARENT GUIDE ───
export interface AIGuideResponse {
  question: string;
  child_context: {
    name: string;
    age_years: number;
    group_name?: string;
  } | null;
  answer: string;
  disclaimer: string;
  safety_redirected: boolean;
  is_medical_query: boolean;
}

// ─── NOTIFICATIONS & SEARCH ───
export interface NotificationsBadgeSummary {
  total_badges: number;
  breakdown: Record<string, number>;
  timestamp: string;
}

export interface SearchResultItem {
  id: number;
  type: 'user' | 'child' | 'product' | 'announcement';
  title: string;
  subtitle: string;
  link: string;
}

export interface GlobalSearchResponse {
  query: string;
  total_matches: number;
  results: {
    users: SearchResultItem[];
    children: SearchResultItem[];
    products: SearchResultItem[];
    announcements: SearchResultItem[];
  };
}

// ─── PAGINATION WRAPPER ───
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages?: number;
}
```

---

## 3. Ready-To-Use Axios API Client Snippet

```typescript
// src/services/apiClient.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // Mandates HttpOnly cookie transmission
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT header if token is stored in localStorage/state
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Global 401 handling (auto logout on session expiry)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```
