export interface Member {
  id: string;
  phone: string;
  name: string;
  role: 'member' | 'admin';
  status: 'pending' | 'active' | 'inactive';
  created_at: string;
  approved_at: string | null;
  auth_user_id: string | null;
}

export interface Voucher {
  id: string;
  member_id: string;
  total_count: number;
  remaining_count: number;
  purchase_date: string;
  expiry_date: string;
  status: 'active' | 'expired' | 'used_up';
  created_at: string;
}

export interface AttendanceRow {
  id: string;
  member_id: string;
  voucher_id: string;
  checked_at: string;
  checked_by: string;
  reverted_at: string | null;
}
