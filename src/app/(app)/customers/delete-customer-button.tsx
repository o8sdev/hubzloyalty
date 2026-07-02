"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (
      !window.confirm(
        `Delete ${customerName}? This permanently removes their visits and feedback.`
      )
    ) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data: { error?: string } | null = await res
          .json()
          .catch(() => null);
        setError(data?.error ?? "Could not delete customer");
        return;
      }
      router.push("/customers");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="danger" onClick={onDelete} disabled={loading}>
        {loading ? "Deleting…" : "Delete customer"}
      </Button>
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
