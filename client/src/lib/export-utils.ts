import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatCurrency } from "./utils";

interface Transaction {
  _id: string;
  amount: number;
  description: string;
  type: string;
  date: string;
  accountId: string;
  categoryId: string;
  account?: { name: string };
  category?: { name: string };
}

interface Account {
  _id: string;
  name: string;
  type: string;
  balance: number;
}

interface Category {
  _id: string;
  name: string;
  color: string;
  icon: string;
}

export async function exportToCsv(
  transactions: Transaction[], 
  accounts: Account[], 
  categories: Category[], 
  dateRange: { from: Date; to: Date }
) {
  // Create a map for quick lookups
  const accountMap = new Map(accounts.map(acc => [acc._id, acc]));
  const categoryMap = new Map(categories.map(cat => [cat._id, cat]));

  // Prepare CSV data
  const csvData = transactions.map(transaction => ({
    Date: format(new Date(transaction.date), "yyyy-MM-dd"),
    Description: transaction.description,
    Type: transaction.type,
    Amount: transaction.amount,
    Account: accountMap.get(transaction.accountId)?.name || "Unknown",
    Category: categoryMap.get(transaction.categoryId)?.name || "Unknown",
  }));

  // Convert to CSV
  const csv = Papa.unparse(csvData);
  
  // Create and download file
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `transactions_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPdf(
  transactions: Transaction[], 
  accounts: Account[], 
  categories: Category[], 
  dateRange: { from: Date; to: Date }
) {
  const doc = new jsPDF();
  
  // Create a map for quick lookups
  const accountMap = new Map(accounts.map(acc => [acc._id, acc]));
  const categoryMap = new Map(categories.map(cat => [cat._id, cat]));

  // Title
  doc.setFontSize(20);
  doc.text("Transaction Report", 20, 20);
  
  // Date range
  doc.setFontSize(12);
  doc.text(`Period: ${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`, 20, 30);
  
  // Summary statistics
  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const netAmount = totalIncome - totalExpenses;
  
  doc.text(`Total Income: ${formatCurrency(totalIncome)}`, 20, 40);
  doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`, 20, 50);
  doc.text(`Net Amount: ${formatCurrency(netAmount)}`, 20, 60);
  
  // Transactions table
  const tableData = transactions.map(transaction => [
    format(new Date(transaction.date), "MM/dd/yyyy"),
    transaction.description,
    transaction.type,
    formatCurrency(transaction.amount),
    accountMap.get(transaction.accountId)?.name || "Unknown",
    categoryMap.get(transaction.categoryId)?.name || "Unknown",
  ]);

  autoTable(doc, {
    head: [["Date", "Description", "Type", "Amount", "Account", "Category"]],
    body: tableData,
    startY: 70,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 40 },
      2: { cellWidth: 20 },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
    },
  });

  // Category breakdown
  const categoryBreakdown = new Map<string, number>();
  transactions.forEach(transaction => {
    const categoryName = categoryMap.get(transaction.categoryId)?.name || "Unknown";
    categoryBreakdown.set(categoryName, (categoryBreakdown.get(categoryName) || 0) + transaction.amount);
  });

  if (categoryBreakdown.size > 0) {
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(14);
    doc.text("Category Breakdown", 20, finalY + 20);
    
    const categoryData = Array.from(categoryBreakdown.entries()).map(([category, amount]) => [
      category,
      formatCurrency(amount),
    ]);

    autoTable(doc, {
      head: [["Category", "Amount"]],
      body: categoryData,
      startY: finalY + 30,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40, halign: "right" },
      },
    });
  }

  // Save the PDF
  doc.save(`transactions_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}.pdf`);
}