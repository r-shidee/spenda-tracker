"use client";

import { useState, useEffect, useRef } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileDown, Check, X, AlertTriangle } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

interface ImportedRow {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  payment_method_id: string | null;
  category_id: string | null;
  transaction_type: "expense" | "transfer";
  status: "new" | "duplicate";
  selected: boolean;
}

export default function ImportPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [existingTxns, setExistingTxns] = useState<{
    date: string;
    amount: number;
    payment_method_id: string;
  }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberRows } = await supabase
      .from("space_members")
      .select("space_id")
      .eq("user_id", user.id)
      .limit(1);

    const memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;

    if (!memberData) return;
    setSpaceId(memberData.space_id);

    const [cats, pms] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("space_id", memberData.space_id)
        .order("sort_order"),
      supabase
        .from("payment_methods")
        .select("*")
        .eq("space_id", memberData.space_id)
        .eq("is_active", true)
        .order("name"),
    ]);

    if (cats.data) setCategories(cats.data);
    if (pms.data) setPaymentMethods(pms.data);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !spaceId) return;

    setParsing(true);
    setImportedRows([]);

    try {
      // Import pdfjs-dist dynamically
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
      }

      // Simple line-by-line parser
      const lines = fullText.split("\n").filter((l) => l.trim());
      const rows: ImportedRow[] = [];

      // Common date patterns in Malaysian bank statements
      const datePattern = /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*(\d{2,4})?/i;
      const amountPattern = /RM\s*([\d,]+\.?\d*)|(\d[\d,]*\.\d{2})/;

      for (const line of lines) {
        const dateMatch = line.match(datePattern);
        const amountMatch = line.match(amountPattern);

        if (dateMatch && amountMatch) {
          // Extract date
          const day = dateMatch[1].padStart(2, "0");
          const monthMap: Record<string, string> = {
            jan: "01", feb: "02", mar: "03", apr: "04",
            may: "05", jun: "06", jul: "07", aug: "08",
            sep: "09", oct: "10", nov: "11", dec: "12",
          };
          const month = monthMap[dateMatch[2].toLowerCase().slice(0, 3)] || "01";
          const year = dateMatch[3]
            ? dateMatch[3].length === 2
              ? `20${dateMatch[3]}`
              : dateMatch[3]
            : new Date().getFullYear().toString();
          const dateStr = `${year}-${month}-${day}`;

          // Extract amount
          const amountStr = (amountMatch[1] || amountMatch[2]).replace(/,/g, "");
          const amount = parseFloat(amountStr);

          if (isNaN(amount) || amount === 0) continue;

          // Extract merchant (text between date and amount)
          const merchant = line
            .replace(datePattern, "")
            .replace(amountPattern, "")
            .trim()
            .replace(/\s+/g, " ");

          if (!merchant) continue;

          // Auto-reload detection
          const isAutoReload = /auto\s*reload|tng.*top\s*up|e-wallet.*reload/i.test(merchant);

          rows.push({
            id: crypto.randomUUID(),
            date: dateStr,
            merchant: merchant.slice(0, 100),
            amount,
            payment_method_id: null,
            category_id: null,
            transaction_type: isAutoReload ? "transfer" : "expense",
            status: "new",
            selected: true,
          });
        }
      }

      // Dedup against existing transactions
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        .toISOString()
        .split("T")[0];

      const { data: existing } = await supabase
        .from("transactions")
        .select("transaction_date, amount, payment_method_id")
        .eq("space_id", spaceId)
        .gte("transaction_date", threeMonthsAgo);

      if (existing) {
        setExistingTxns(
          existing.map((t) => ({
            date: t.transaction_date,
            amount: Number(t.amount),
            payment_method_id: t.payment_method_id || "",
          }))
        );

        for (const row of rows) {
          const isDuplicate = existing.some(
            (e) =>
              e.transaction_date === row.date &&
              Math.abs(Number(e.amount) - row.amount) < 0.01
          );
          if (isDuplicate) {
            row.status = "duplicate";
            row.selected = false;
          }
        }
      }

      setImportedRows(rows);
    } catch (err) {
      console.error("PDF parsing error:", err);
      alert("Failed to parse PDF. Please check the file format.");
    }

    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleRow(id: string) {
    setImportedRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row
      )
    );
  }

  function toggleAll() {
    const allSelected = importedRows.every((r) => r.selected);
    setImportedRows((prev) =>
      prev.map((row) => ({ ...row, selected: !allSelected }))
    );
  }

  function updateRowMerchant(id: string, merchant: string) {
    setImportedRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, merchant } : row))
    );
  }

  function updateRowCategory(id: string, categoryId: string | null) {
    setImportedRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, category_id: categoryId } : row))
    );
  }

  async function handleBulkSave() {
    if (!spaceId) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const selectedRows = importedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setSaving(false);
      return;
    }

    const inserts = selectedRows.map((row) => ({
      space_id: spaceId,
      user_id: user.id,
      amount: row.amount,
      merchant_name: row.merchant,
      transaction_date: row.date,
      category_id: row.category_id,
      payment_method_id: row.payment_method_id,
      transaction_type: row.transaction_type,
      expense_ownership: "self" as const,
    }));

    const { error } = await supabase.from("transactions").insert(inserts);

    if (!error) {
      setImportedRows([]);
      alert(`Successfully imported ${inserts.length} transactions.`);
    } else {
      alert("Error saving transactions. Please try again.");
    }

    setSaving(false);
  }

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const newCount = importedRows.filter((r) => r.status === "new").length;
  const dupCount = importedRows.filter((r) => r.status === "duplicate").length;

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-4">

      {/* Upload */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <FileDown className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            Upload a bank or credit card statement PDF
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Transactions will be extracted and reviewed before saving.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="pdf-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {parsing ? "Parsing..." : "Select PDF"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {importedRows.length > 0 && (
        <>
          {/* Summary */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {importedRows.filter((r) => r.selected).length} selected
              </Badge>
              {dupCount > 0 && (
                <Badge variant="outline">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {dupCount} duplicates
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {importedRows.every((r) => r.selected) ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {/* Rows */}
          <div className="mb-6 space-y-2">
            {importedRows.map((row) => (
              <Card
                key={row.id}
                className={`transition-colors ${
                  row.selected ? "bg-background" : "bg-muted/50 opacity-60"
                }`}
              >
                <CardContent className="p-3">
                  <div className="mb-2 flex items-start justify-between">
                    <button
                      onClick={() => toggleRow(row.id)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        row.selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-muted-foreground"
                      }`}
                    >
                      {row.selected && <Check className="h-3 w-3" />}
                    </button>
                    <div className="ml-3 flex-1">
                      <Input
                        value={row.merchant}
                        onChange={(e) =>
                          updateRowMerchant(row.id, e.target.value)
                        }
                        className="h-7 border-none p-0 text-sm font-medium shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        row.transaction_type === "transfer"
                          ? "text-muted-foreground line-through"
                          : ""
                      }`}
                    >
                      {formatAmount(row.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{row.date}</span>
                      {row.status === "duplicate" && (
                        <Badge variant="outline" className="text-[10px]">
                          Duplicate
                        </Badge>
                      )}
                      {row.transaction_type === "transfer" && (
                        <Badge variant="outline" className="text-[10px]">
                          Transfer
                        </Badge>
                      )}
                    </div>
                    <select
                      value={row.category_id || ""}
                      onChange={(e) =>
                        updateRowCategory(
                          row.id,
                          e.target.value || null
                        )
                      }
                      className="rounded border bg-transparent px-1 py-0.5 text-[10px]"
                    >
                      <option value="">Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Save button */}
          <div className="mb-8 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setImportedRows([])}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleBulkSave}
              disabled={saving || importedRows.filter((r) => r.selected).length === 0}
            >
              {saving
                ? "Saving..."
                : `Save ${importedRows.filter((r) => r.selected).length} Transactions`}
            </Button>
          </div>
        </>
      )}
    </main>
    </ViewTransition>
  );
}
