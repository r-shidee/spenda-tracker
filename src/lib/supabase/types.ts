export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      spaces: {
        Row: {
          id: string;
          name: string;
          statement_close_day: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          statement_close_day?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          statement_close_day?: number;
          created_at?: string;
        };
      };
      space_members: {
        Row: {
          space_id: string;
          user_id: string;
          role: "owner" | "member";
          created_at: string;
        };
        Insert: {
          space_id: string;
          user_id: string;
          role?: "owner" | "member";
          created_at?: string;
        };
        Update: {
          space_id?: string;
          user_id?: string;
          role?: "owner" | "member";
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          space_id: string;
          name: string;
          icon: string | null;
          color: string | null;
          sort_order: number;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          name: string;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          name?: string;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
          is_default?: boolean;
          created_at?: string;
        };
      };
      payment_methods: {
        Row: {
          id: string;
          space_id: string;
          name: string;
          type: "credit_card" | "ewallet" | "cash";
          is_active: boolean;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          name: string;
          type: "credit_card" | "ewallet" | "cash";
          is_active?: boolean;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          name?: string;
          type?: "credit_card" | "ewallet" | "cash";
          is_active?: boolean;
          color?: string | null;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          amount: number;
          currency: string;
          merchant_name: string;
          transaction_date: string;
          transaction_time: string | null;
          category_id: string | null;
          payment_method_id: string | null;
          transaction_type: "expense" | "transfer";
          expense_ownership:
            | "self"
            | "shared"
            | "gift_spouse"
            | "paid_for_others";
          is_reimbursed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          amount: number;
          currency?: string;
          merchant_name: string;
          transaction_date: string;
          transaction_time?: string | null;
          category_id?: string | null;
          payment_method_id?: string | null;
          transaction_type?: "expense" | "transfer";
          expense_ownership?:
            | "self"
            | "shared"
            | "gift_spouse"
            | "paid_for_others";
          is_reimbursed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          amount?: number;
          currency?: string;
          merchant_name?: string;
          transaction_date?: string;
          transaction_time?: string | null;
          category_id?: string | null;
          payment_method_id?: string | null;
          transaction_type?: "expense" | "transfer";
          expense_ownership?:
            | "self"
            | "shared"
            | "gift_spouse"
            | "paid_for_others";
          is_reimbursed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Enums: {
      transaction_type: "expense" | "transfer";
      expense_ownership: "self" | "shared" | "gift_spouse" | "paid_for_others";
      member_role: "owner" | "member";
      payment_method_type: "credit_card" | "ewallet" | "cash";
    };
  };
}
