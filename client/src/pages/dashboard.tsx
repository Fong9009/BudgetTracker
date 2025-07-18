import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AddTransactionModal } from "@/components/modals/add-transaction-modal";
import { AddAccountModal } from "@/components/modals/add-account-modal";
import { TransferModal } from "@/components/modals/transfer-modal";
import { ExportModal } from "@/components/export/export-modal";
import { formatCurrency, formatDate, getAccountTypeIcon, getAccountTypeColor, getTransactionTypeColor, groupTransferTransactions } from "@/lib/utils";
import { Plus, Download, ArrowRightLeft, CreditCard, Zap } from "lucide-react";
import type { TransactionWithDetails, Account } from "@shared/schema";

interface AnalyticsSummary {
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  savingsRate: string;
}

interface CategorySpending {
  id: number;
  name: string;
  color: string;
  icon: string;
  amount: string;
  transactionCount: number;
}

export default function Dashboard() {
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<TransactionWithDetails[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: categorySpending = [], isLoading: categoriesLoading } = useQuery<CategorySpending[]>({
    queryKey: ["/api/analytics/spending-by-category"],
  });

  const filteredCategorySpending = categorySpending.filter(c => c.name !== 'Transfer');
  
  // Safety check for transactions
  const groupedTransactions = transactions ? groupTransferTransactions(transactions) : [];
  const recentTransactions = groupedTransactions.slice(0, 4);
  
  // Get recent transfers from grouped transactions
  const recentTransfers = groupedTransactions
    .filter(item => item.type === 'transfer')
    .slice(0, 4);

  return (
    <div className="flex-1 relative overflow-y-auto focus:outline-none">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Page header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground sm:truncate">
              Dashboard
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Overview of your financial activity
            </p>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium text-foreground">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Button
                variant="outline"
                className="h-20 flex-col gap-2 hover:bg-primary/5 hover:border-primary/20"
                onClick={() => setShowAddTransaction(true)}
              >
                <Plus className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">Add Transaction</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-950 dark:hover:border-green-800"
                onClick={() => setShowTransferModal(true)}
              >
                <ArrowRightLeft className="h-6 w-6 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">Transfer Money</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950 dark:hover:border-blue-800"
                onClick={() => setShowAddAccount(true)}
              >
                <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Add Account</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2 hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950 dark:hover:border-purple-800"
                onClick={() => setShowExportModal(true)}
              >
                <Download className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium">Export Data</span>
              </Button>
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="mt-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Balance"
                value={analytics ? formatCurrency(analytics.totalBalance) : "$0.00"}
                icon="fas fa-wallet"
                iconBgColor="bg-primary"
              />
              <StatCard
                title="Monthly Income"
                value={analytics ? `+${formatCurrency(analytics.monthlyIncome)}` : "+$0.00"}
                icon="fas fa-arrow-up"
                iconBgColor="bg-green-500"
                valueColor="text-green-600"
              />
              <StatCard
                title="Monthly Expenses"
                value={analytics ? `-${formatCurrency(analytics.monthlyExpenses)}` : "-$0.00"}
                icon="fas fa-arrow-down"
                iconBgColor="bg-red-500"
                valueColor="text-red-600"
              />
              <StatCard
                title="Savings Rate"
                value={analytics ? `${analytics.savingsRate}%` : "0%"}
                icon="fas fa-piggy-bank"
                iconBgColor="bg-indigo-500"
              />
            </div>
          </div>

          {/* Accounts Overview */}
          <div className="mt-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Accounts Overview</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddAccount(true)}
                  className="text-primary hover:text-primary/80"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Account
                </Button>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-muted rounded-lg" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-24" />
                            <div className="h-3 bg-muted rounded w-20" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-20" />
                          <div className="h-3 bg-muted rounded w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No accounts yet.</p>
                    <Button
                      variant="link"
                      onClick={() => setShowAddAccount(true)}
                      className="mt-2"
                    >
                      Add your first account
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map((account) => (
                      <div
                        key={account._id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 ${getAccountTypeColor(account.type)} rounded-lg flex items-center justify-center`}>
                              <i className={`${getAccountTypeIcon(account.type)} text-white text-sm`} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-foreground">
                              {account.name}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {account.type} Account
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${account.balance < 0 ? 'text-red-600' : 'text-foreground'}`}>
                            {formatCurrency(account.balance.toString())}
                          </p>
                          <p className="text-sm text-muted-foreground">Current Balance</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions and Transfers */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Transactions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Transactions</CardTitle>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  View all
                </Button>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center justify-between p-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-muted rounded-lg" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-24" />
                            <div className="h-3 bg-muted rounded w-16" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-16" />
                          <div className="h-3 bg-muted rounded w-12" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No transactions yet.</p>
                    <Button
                      variant="link"
                      onClick={() => setShowAddTransaction(true)}
                      className="mt-2"
                    >
                      Add your first transaction
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-border">
                    {recentTransactions.map((item) => (
                      <div key={item._id} className="transaction-item">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div
                              className="transaction-icon"
                              style={{ backgroundColor: item.category.color, color: 'white' }}
                            >
                              {item.type === 'transfer' ? (
                                <ArrowRightLeft className="h-4 w-4" />
                              ) : (
                                <i className={`${item.category.icon} text-sm`} />
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-foreground">
                              {item.type === 'transfer' 
                                ? `Transfer: ${item.description}`
                                : item.description
                              }
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.type === 'transfer' 
                                ? `${item.fromAccount!.name} → ${item.toAccount!.name}`
                                : item.category.name
                              }
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            item.type === 'transfer' 
                              ? 'text-foreground'
                              : getTransactionTypeColor(item.type)
                          }`}>
                            {item.type === 'transfer' 
                              ? formatCurrency(item.amount)
                              : `${item.type === 'income' ? '+' : '-'}${formatCurrency(item.amount)}`
                            }
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(item.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Transfers */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center justify-between p-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-muted rounded-lg" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-24" />
                            <div className="h-3 bg-muted rounded w-16" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-16" />
                          <div className="h-3 bg-muted rounded w-12" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentTransfers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No recent transfers.</p>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-border">
                    {recentTransfers.map((item) => (
                      <div key={item._id} className="transaction-item">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div
                              className="transaction-icon"
                              style={{ backgroundColor: item.category.color, color: 'white' }}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-foreground">
                              Transfer: {item.description}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.fromAccount!.name} → {item.toAccount!.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(item.amount)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(item.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Spending */}
          {filteredCategorySpending.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Spending by Category (This Month)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredCategorySpending.map((category) => {
                      const totalSpending = filteredCategorySpending.reduce((sum, cat) => sum + parseFloat(cat.amount), 0);
                      const percentage = totalSpending > 0 ? (parseFloat(category.amount) / totalSpending) * 100 : 0;
                      
                      return (
                        <div key={category.id.toString()} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-foreground">
                                {category.name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="w-32 bg-muted rounded-full h-2 mr-4">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: category.color,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {formatCurrency(category.amount)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddTransactionModal
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
      />
      <AddAccountModal
        open={showAddAccount}
        onOpenChange={setShowAddAccount}
      />
      <TransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
      />
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />
    </div>
  );
}

